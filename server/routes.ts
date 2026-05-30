import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { insertTenantSchema, insertFormTemplateSchema, insertApplicationSchema, insertDemoCodeSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { setupAuth, isAuthenticated, hashPassword, verifyPassword, generateToken, hashToken } from "./auth";
import rateLimit from "express-rate-limit";
import { emailService } from "./emailService";
import { buildEmailTemplate } from "./emailTemplates";
import { provisionDemoEcosystem } from "./provision";
import { seedWorkflowTemplates } from "./seed-workflows";
import { AdditionalInfoService } from "./additionalInfoService";
import { azureBlobStorage } from "./azureBlobStorage";
import { workflowEngine } from "./workflowEngine";
import { z } from "zod";
import * as schema from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import multer from "multer";
import crypto from "crypto";
import { promptRegistry } from "./prompts/promptRegistry";
import { sanitizeText, sanitizeFormData } from "./lib/sanitize";
import { createMcpRouter } from "./mcp";
import { REVIEWER_ROLES } from "./mcp/auth";
import {
  authorizationServerMetadata,
  createOauthRouter,
  protectedResourceMetadata,
} from "./oauth";

// Configure multer for in-memory file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Initialize services
const additionalInfoService = new AdditionalInfoService(storage);

// Subdomain detection middleware
function subdomainMiddleware(req: any, res: any, next: any) {
  // Extract subdomain from hostname
  const hostname = req.hostname;
  const parts = hostname.split('.');

  // Check for subdomain in query param first (for Replit testing)
  // Usage: ?subdomain=markland
  if (req.query.subdomain) {
    req.subdomain = req.query.subdomain;
    console.log('Subdomain from query param:', req.subdomain);
    return next();
  }

  // Skip subdomain detection for known hosting platforms
  // Replit uses: *.replit.dev, *.repl.co, *.replit.app
  // Also skip localhost and other dev environments
  const skipDomains = ['replit.dev', 'repl.co', 'replit.app', 'localhost', '127.0.0.1'];
  const isHostingPlatform = skipDomains.some(domain => hostname.endsWith(domain) || hostname === domain);

  if (isHostingPlatform) {
    // No subdomain detection for hosting platforms - use ?subdomain= param instead
    next();
    return;
  }

  // Check for actual subdomain in hostname
  // Example: markland.poassociation.com -> parts = ['markland', 'poassociation', 'com']
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Exclude common non-tenant subdomains
    if (subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'admin') {
      req.subdomain = subdomain;
      console.log('Subdomain from hostname:', req.subdomain);
    }
  }

  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Referenced from Replit Auth integration: blueprint:javascript_log_in_with_replit
  await setupAuth(app);

  // MCP reviewer endpoint — mounted BEFORE subdomain / auth-gated routes so
  // bearer-token clients (Claude Desktop, Cursor, etc.) never touch session
  // middleware. Feature-flagged by MCP_ENABLED; default enabled.
  if (process.env.MCP_ENABLED !== "false") {
    app.use("/mcp", createMcpRouter());

    // OAuth discovery (RFC 8414 / RFC 9728) — must be reachable without auth.
    app.get("/.well-known/oauth-protected-resource", protectedResourceMetadata);
    app.get("/.well-known/oauth-authorization-server", authorizationServerMetadata);

    // OAuth 2.1 authorization server endpoints for DCR + auth-code + PKCE.
    app.use("/oauth", createOauthRouter());
  }

  // Apply subdomain detection to all routes
  app.use(subdomainMiddleware);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          return res.json(user);
        }
      }
      // Not authenticated
      res.status(401).json({ message: "Not authenticated" });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ============================================
  // Email + password authentication
  // ============================================
  const LOCKOUT_THRESHOLD = 5;
  const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
  const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
  const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  // Brute-force / abuse floor on the credential endpoints. Per-account lockout
  // (failedLoginAttempts / lockedUntil) is the second layer.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many attempts. Please try again later." },
  });

  // Matches the app-wide convention for email links (invites, billing, etc.).
  // APP_URL is set in the environment; fall back to the request host.
  const baseUrl = (req: any): string =>
    process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

  // Establish the authenticated session (mirrors the demo-login flow).
  async function establishSession(req: any, user: schema.User): Promise<void> {
    req.session.userId = user.id;
    const userTenants = await storage.getUserTenants(user.id);
    if (userTenants.length > 0) {
      req.session.currentUserRole = userTenants[0].role;
    }
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: any) => (err ? reject(err) : resolve()));
    });
  }

  app.post('/api/auth/register', authLimiter, async (req: any, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().trim().email().toLowerCase(),
        password: z.string().min(8).max(200),
        firstName: z.string().trim().min(1).max(100).optional(),
        lastName: z.string().trim().min(1).max(100).optional(),
      });
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const { email, password, firstName, lastName } = parsed.data;

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await hashPassword(password);
      const user = await storage.createUserWithPassword({
        email,
        passwordHash,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      });

      // Email verification (soft gate — login is allowed immediately).
      const rawToken = generateToken();
      await storage.createEmailVerificationToken(
        user.id,
        hashToken(rawToken),
        new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      );
      const verifyUrl = `${baseUrl(req)}/verify-email?token=${rawToken}`;
      emailService
        .send({
          to: email,
          subject: "Verify your POAssociation email",
          html: buildEmailTemplate({
            title: "Welcome to POAssociation",
            preheader: "Confirm your email address to finish setting up your account.",
            mainContent: "Thanks for signing up. Please confirm your email address to secure your account.",
            actionButton: { text: "Verify email", url: verifyUrl },
            recipientName: firstName || undefined,
            status: "action",
          }),
        })
        .catch((e) => console.error("[auth] verification email failed (non-fatal):", e));

      await establishSession(req, user);
      res.status(201).json(user);
    } catch (error: any) {
      console.error("Error during registration:", error);
      res.status(500).json({ error: "Failed to register" });
    }
  });

  app.post('/api/auth/login', authLimiter, async (req: any, res) => {
    try {
      const bodySchema = z.object({
        email: z.string().trim().email().toLowerCase(),
        password: z.string().min(1).max(200),
      });
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const { email, password } = parsed.data;

      const user = await storage.getUserByEmail(email);
      // Generic error — never reveal whether the account/credential exists.
      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.lockedUntil && user.lockedUntil > new Date()) {
        return res.status(429).json({ error: "Account temporarily locked. Try again later." });
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        const attempts = await storage.incrementFailedLogins(user.id);
        if (attempts >= LOCKOUT_THRESHOLD) {
          await storage.setLockedUntil(user.id, new Date(Date.now() + LOCKOUT_MS));
        }
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await storage.resetFailedLogins(user.id);
      await establishSession(req, user);
      res.json(user);
    } catch (error: any) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Failed to log in" });
    }
  });

  app.post('/api/auth/forgot-password', authLimiter, async (req: any, res) => {
    try {
      const bodySchema = z.object({ email: z.string().trim().email().toLowerCase() });
      const parsed = bodySchema.safeParse(req.body ?? {});
      // Always respond 200 — never reveal whether an account exists.
      if (!parsed.success) {
        return res.json({ success: true });
      }
      const user = await storage.getUserByEmail(parsed.data.email);
      if (user && user.passwordHash) {
        const rawToken = generateToken();
        await storage.createPasswordResetToken(
          user.id,
          hashToken(rawToken),
          new Date(Date.now() + RESET_TOKEN_TTL_MS),
        );
        const resetUrl = `${baseUrl(req)}/reset-password?token=${rawToken}`;
        emailService
          .send({
            to: parsed.data.email,
            subject: "Reset your POAssociation password",
            html: buildEmailTemplate({
              title: "Reset your password",
              preheader: "A password reset was requested for your account.",
              mainContent: "We received a request to reset your password. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
              actionButton: { text: "Reset password", url: resetUrl },
              recipientName: user.firstName || undefined,
              status: "action",
            }),
          })
          .catch((e) => console.error("[auth] reset email failed (non-fatal):", e));
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error during forgot-password:", error);
      // Still respond success to avoid leaking state.
      res.json({ success: true });
    }
  });

  app.post('/api/auth/reset-password', authLimiter, async (req: any, res) => {
    try {
      const bodySchema = z.object({
        token: z.string().min(1),
        password: z.string().min(8).max(200),
      });
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }
      const row = await storage.getPasswordResetTokenByHash(hashToken(parsed.data.token));
      if (!row || row.usedAt || row.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired reset link" });
      }
      const passwordHash = await hashPassword(parsed.data.password);
      await storage.setUserPassword(row.userId, passwordHash);
      await storage.markPasswordResetTokenUsed(row.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error during reset-password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.post('/api/auth/verify-email', async (req: any, res) => {
    try {
      const bodySchema = z.object({ token: z.string().min(1) });
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid verification link" });
      }
      const row = await storage.getEmailVerificationTokenByHash(hashToken(parsed.data.token));
      if (!row || row.usedAt || row.expiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired verification link" });
      }
      await storage.setEmailVerified(row.userId);
      await storage.markEmailVerificationTokenUsed(row.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error during verify-email:", error);
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  // ============================================
  // MCP Reviewer Token Management
  // ============================================
  // Session-authed CRUD for the bearer tokens that external LLM clients use
  // to reach /mcp. Users generate one token per community they review for.
  // Reviewer-role gate is enforced per-endpoint against the :tenantId param.

  async function resolveSessionUserId(req: any): Promise<string | null> {
    return req.session?.userId ?? null;
  }

  async function requireReviewerInTenant(req: any, res: any, tenantId: string): Promise<string | null> {
    const userId = await resolveSessionUserId(req);
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return null;
    }
    const roles = await storage.getUserRolesForTenant(userId, tenantId);
    const hasReviewerRole = roles.some((r) =>
      (REVIEWER_ROLES as readonly string[]).includes(r.role),
    );
    if (!hasReviewerRole) {
      res.status(403).json({ error: "No reviewer role in this community" });
      return null;
    }
    return userId;
  }

  app.get("/api/tenants/:tenantId/mcp-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await requireReviewerInTenant(req, res, req.params.tenantId);
      if (!userId) return;
      const tokens = await storage.listMcpTokensForUserInTenant(userId, req.params.tenantId);
      // Never return the plaintext token after creation.
      res.json(
        tokens.map((t) => ({
          id: t.id,
          label: t.label,
          isActive: t.isActive,
          createdAt: t.createdAt,
          lastUsedAt: t.lastUsedAt,
          accessCount: t.accessCount,
          expiresAt: t.expiresAt,
        })),
      );
    } catch (err: any) {
      console.error("listMcpTokens error", err);
      res.status(500).json({ error: err?.message || "Failed to list tokens" });
    }
  });

  app.post("/api/tenants/:tenantId/mcp-tokens", isAuthenticated, async (req: any, res) => {
    try {
      const userId = await requireReviewerInTenant(req, res, req.params.tenantId);
      if (!userId) return;

      const bodySchema = z.object({
        label: z.string().trim().min(1).max(100).optional(),
      });
      const parsed = bodySchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        return res.status(400).json({ error: fromZodError(parsed.error).toString() });
      }

      // Enforce partial unique index: revoke any existing active token first.
      const existing = await storage.listMcpTokensForUserInTenant(userId, req.params.tenantId);
      for (const t of existing.filter((t) => t.isActive)) {
        await storage.revokeMcpToken(t.id, userId);
      }

      const tokenValue = `mcpr_${crypto.randomBytes(32).toString("hex")}`;
      const created = await storage.createMcpToken({
        userId,
        tenantId: req.params.tenantId,
        token: tokenValue,
        label: parsed.data.label ?? null,
      });

      // Plaintext token returned ONCE — response body is redacted in logs.
      res.json({
        id: created.id,
        token: tokenValue,
        label: created.label,
        createdAt: created.createdAt,
      });
    } catch (err: any) {
      console.error("createMcpToken error", err);
      res.status(500).json({ error: err?.message || "Failed to create token" });
    }
  });

  app.delete(
    "/api/tenants/:tenantId/mcp-tokens/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = await requireReviewerInTenant(req, res, req.params.tenantId);
        if (!userId) return;
        const revoked = await storage.revokeMcpToken(req.params.id, userId);
        if (!revoked) {
          return res.status(404).json({ error: "Token not found" });
        }
        res.status(204).end();
      } catch (err: any) {
        console.error("revokeMcpToken error", err);
        res.status(500).json({ error: err?.message || "Failed to revoke token" });
      }
    },
  );

  // Logout endpoint - properly destroys session for both demo and Replit auth users
  app.post('/api/auth/logout', async (req: any, res) => {
    try {
      // Destroy the session (clears both demo and Replit auth)
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
          return res.status(500).json({ error: 'Failed to logout' });
        }
        // Clear the session cookie
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    } catch (error: any) {
      console.error('Error during logout:', error);
      res.status(500).json({ error: 'Failed to logout' });
    }
  });

  // GET /api/auth/logout-redirect - Force logout and redirect to home
  // Usage: Just navigate to /logout in your browser (client redirects here)
  app.get('/api/auth/logout-redirect', async (req: any, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Error destroying session:', err);
        }
        // Clear the session cookie
        res.clearCookie('connect.sid');
        // Redirect to home page
        res.redirect('/');
      });
    } catch (error: any) {
      console.error('Error during logout:', error);
      res.redirect('/');
    }
  });

  // Switch current user role in session
  app.post('/api/auth/switch-role', isAuthenticated, async (req: any, res) => {
    try {
      const { role } = req.body;

      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }

      // Update the current role in the session
      req.session.currentUserRole = role;

      // Save session to ensure it's persisted
      req.session.save((err: any) => {
        if (err) {
          console.error('Error saving session with new role:', err);
          return res.status(500).json({ error: 'Failed to switch role' });
        }

        console.log('[switch-role] Updated session role to:', role);
        res.json({ success: true, role });
      });
    } catch (error: any) {
      console.error('Error switching role:', error);
      res.status(500).json({ error: 'Failed to switch role' });
    }
  });

  // Debug endpoint - check session state
  app.get('/api/debug/session', (req: any, res) => {
    res.json({
      hasSession: !!req.session,
      sessionId: req.sessionID,
      userId: req.session?.userId,
      hasUser: !!req.user,
      cookies: req.headers.cookie,
      isAuthenticated: req.isAuthenticated?.(),
    });
  });

  // Get subdomain context (public endpoint for frontend to check)
  app.get('/api/subdomain', (req: any, res) => {
    res.json({
      subdomain: req.subdomain || null,
      hostname: req.hostname,
    });
  });

  // Public community info endpoint - for community landing pages
  // GET /api/public/:subdomain/info - Returns tenant info + next upcoming event without auth
  app.get('/api/public/:subdomain/info', async (req, res) => {
    try {
      const { subdomain } = req.params;

      // Get tenant by subdomain
      const tenant = await storage.getTenantBySubdomain(subdomain);

      if (!tenant) {
        return res.status(404).json({ error: 'Community not found' });
      }

      // Only expose communities, not management companies
      if (tenant.type !== 'community') {
        return res.status(404).json({ error: 'Community not found' });
      }

      // Get upcoming scheduled events for this community (next 5)
      const now = new Date();
      const allUpcoming = await storage.listEvents({
        tenantId: tenant.id,
        status: 'scheduled',
        startAfter: now,
      });

      const formatEvent = (e: typeof allUpcoming[0]) => ({
        id: e.id,
        title: e.title,
        startDatetime: e.startDatetime,
        endDatetime: e.endDatetime,
        location: e.location || null,
        meetingUrl: e.meetingUrl || null,
        eventType: e.eventType ? {
          name: e.eventType.name,
          slug: e.eventType.slug,
        } : null,
      });

      // First event as featured, up to 5 total for the list
      const nextEvent = allUpcoming.length > 0 ? formatEvent(allUpcoming[0]) : null;
      const upcomingEvents = allUpcoming.slice(0, 5).map(formatEvent);

      // Get active AI context sources (guidelines/reference docs) for public display
      const contextSources = await storage.listAiContextSources(tenant.id, false);
      const guidelines = contextSources.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        sourceType: s.sourceType,
        sourceUrl: s.sourceUrl,
        fileName: s.fileName,
        mimeType: s.mimeType,
      }));

      // Return sanitized public info (no internal IDs, settings, etc.)
      res.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          heroImageUrl: tenant.heroImageUrl || null,
          designGuidelinesUrl: tenant.designGuidelinesUrl || null,
          communitySettings: tenant.communitySettings || null,
        },
        guidelines,
        nextEvent,
        upcomingEvents,
      });
    } catch (error: any) {
      console.error('Error fetching public community info:', error);
      res.status(500).json({ error: 'Failed to fetch community info' });
    }
  });

  // Public view/download for AI context source documents (guidelines)
  // No auth required - these are community reference documents meant to be public
  app.get('/api/public/tenants/:tenantId/guidelines/:id/view', async (req, res) => {
    try {
      const { tenantId, id } = req.params;

      const source = await storage.getAiContextSource(id);
      if (!source || !source.isActive) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Tenant isolation check
      if (source.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (source.sourceType === 'url' && source.sourceUrl) {
        return res.redirect(source.sourceUrl);
      }

      if (source.sourceType === 'uploaded_document' && source.blobPath && source.containerName) {
        if (!azureBlobStorage.isAvailable()) {
          return res.status(503).json({ error: 'Storage not configured' });
        }

        const buffer = await azureBlobStorage.downloadFile(source.containerName, source.blobPath);
        const mimeType = source.mimeType || 'application/octet-stream';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${source.fileName || 'document'}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(buffer);
      }

      return res.status(400).json({ error: 'Document has no viewable content' });
    } catch (error: any) {
      console.error('Error viewing public guideline document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public management company info endpoint - for management landing pages
  // GET /api/public/management/:subdomain/info - Returns management company info + managed communities
  app.get('/api/public/management/:subdomain/info', async (req, res) => {
    try {
      const { subdomain } = req.params;

      // Get tenant by subdomain
      const tenant = await storage.getTenantBySubdomain(subdomain);

      if (!tenant) {
        return res.status(404).json({ error: 'Management company not found' });
      }

      // Only expose management companies
      if (tenant.type !== 'management_company') {
        return res.status(404).json({ error: 'Management company not found' });
      }

      // Get communities managed by this management company
      const managedCommunities = await storage.getTenantsByManagementCompany(tenant.id);

      // Return sanitized public info
      res.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          heroImageUrl: tenant.heroImageUrl || null,
          communitySettings: tenant.communitySettings || null,
        },
        managedCommunities: managedCommunities.map(c => ({
          id: c.id,
          name: c.name,
          subdomain: c.subdomain,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching public management info:', error);
      res.status(500).json({ error: 'Failed to fetch management company info' });
    }
  });

  // Public search endpoint - search for communities that allow self-service registration
  // GET /api/public/search?q=searchterm
  app.get('/api/public/search', async (req, res) => {
    try {
      const query = (req.query.q as string || '').trim();

      if (!query || query.length < 2) {
        return res.json({ results: [] });
      }

      // Use storage method that filters by allowPublicApplications
      const communities = await storage.searchPublicCommunities(query);

      const results = communities.map(t => ({
        id: t.id,
        name: t.name,
        subdomain: t.subdomain,
        type: t.type,
        heroImageUrl: t.heroImageUrl,
        communitySettings: t.communitySettings ? {
          description: t.communitySettings.description,
          legalEntityType: t.communitySettings.legalEntityType,
        } : undefined,
      }));

      res.json({ results });
    } catch (error: any) {
      console.error('Error searching tenants:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  // Self-service community join endpoint
  // POST /api/public/communities/:tenantId/join - Join a community as an unverified homeowner
  app.post('/api/public/communities/:tenantId/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { tenantId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Use storage method which validates and creates the role
      const role = await storage.selfServiceJoinCommunity(userId, tenantId);

      // Get tenant info for response
      const tenant = await storage.getTenant(tenantId);

      res.json({
        success: true,
        message: 'Successfully joined community as homeowner. Submit an application to get verified.',
        role,
        tenant: tenant ? {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
        } : null,
      });
    } catch (error: any) {
      console.error('Error joining community:', error);
      res.status(400).json({ error: error.message || 'Failed to join community' });
    }
  });

  // Public contact form endpoint - sends to POA_CONTACT_EMAIL
  // POST /api/public/contact - Submit contact form or demo request
  app.post('/api/public/contact', async (req, res) => {
    try {
      const { mode, email } = req.body;
      const name = sanitizeText(req.body.name);
      const phone = sanitizeText(req.body.phone);
      const company = sanitizeText(req.body.company);
      const communitySize = sanitizeText(req.body.communitySize);
      const message = sanitizeText(req.body.message);
      const preferredTime = sanitizeText(req.body.preferredTime);

      // Validate required fields
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Demo mode requires phone and company
      if (mode === 'demo' && (!phone || !company)) {
        return res.status(400).json({ error: 'Phone and company are required for demo requests' });
      }

      // Contact mode requires message
      if (mode === 'contact' && !message) {
        return res.status(400).json({ error: 'Message is required for contact form' });
      }

      // Get destination email from secret
      const contactEmail = process.env.POA_CONTACT_EMAIL;
      if (!contactEmail) {
        console.error('POA_CONTACT_EMAIL not configured');
        // Still return success to user but log the error
        return res.json({ success: true, message: 'Thank you for your submission' });
      }

      // Send email
      const { emailService } = await import('./emailService');
      const { contactFormTemplate } = await import('./emailTemplates');

      const html = contactFormTemplate(mode === 'demo' ? 'demo' : 'contact', {
        name,
        email,
        phone,
        company,
        communitySize,
        message,
        preferredTime,
      });

      const result = await emailService.send({
        to: contactEmail,
        subject: mode === 'demo'
          ? `[Demo Request] ${name} from ${company || 'Unknown'}`
          : `[Contact Form] ${name}`,
        html,
        replyTo: email,
      }, {
        templateId: 'contactForm',
        templateParameters: { name, email, mode: mode || 'contact', phone: phone || '', company: company || '', communitySize: communitySize || '', message: message || '', preferredTime: preferredTime || '' },
      });

      if (!result.success) {
        console.error('Failed to send contact email:', result.error);
        // Still return success to user - we don't want to expose internal errors
      }

      res.json({ success: true, message: 'Thank you for your submission' });
    } catch (error: any) {
      console.error('Error processing contact form:', error);
      res.status(500).json({ error: 'Failed to process submission' });
    }
  });

  // Check if current user is super admin
  app.get('/api/auth/is-super-admin', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      const user = await storage.getUser(userId);

      if (!user || !user.email) {
        return res.json({ isSuperAdmin: false });
      }

      const superAdminEmails = process.env.SUPER_ADMIN_EMAILS || '';
      const allowedEmails = superAdminEmails
        .split(';')
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0);

      res.json({ isSuperAdmin: allowedEmails.includes(user.email.toLowerCase()) });
    } catch (error: any) {
      console.error("Error checking super admin:", error);
      res.status(500).json({ message: "Failed to check admin status" });
    }
  });

  // Tenants - Protected routes
  app.get("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const tenants = await storage.listTenants();
      res.json(tenants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tenants/subdomain/:subdomain", isAuthenticated, async (req, res) => {
    try {
      const tenant = await storage.getTenantBySubdomain(req.params.subdomain);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get properties/communities managed by current user
  // Optional ?role= query param to filter by specific role context
  app.get("/api/properties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const role = req.query.role as string | undefined;

      let properties;
      if (role) {
        // Filter properties by specific role
        properties = await storage.getPropertiesByRole(userId, role);
      } else {
        // Return all properties user has access to
        properties = await storage.getManagedProperties(userId);
      }

      res.json(properties);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const validated = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(validated);
      res.status(201).json(tenant);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/tenants/:id", isAuthenticated, async (req, res) => {
    try {
      const tenant = await storage.updateTenant(req.params.id, req.body);
      res.json(tenant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/tenants/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteTenant(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Hero Image Upload - Upload and optionally sharpen hero image for community
  app.post("/api/tenants/:tenantId/hero-image", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({
          error: "Image storage is not configured. Please configure Azure Blob Storage."
        });
      }

      const { tenantId } = req.params;
      const { sharpen } = req.body; // 'true' or 'false' as string from FormData
      const shouldSharpen = sharpen === 'true';
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          error: "Invalid file type. Allowed types: JPEG, PNG, WebP, GIF"
        });
      }

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Community not found" });
      }

      // Get current user ID
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      let imageBuffer = file.buffer;
      let imageMimeType = file.mimetype;
      let wasSharpened = false;
      let sharpeningError: string | undefined;

      // If sharpening requested, process (free service, no credit cost)
      if (shouldSharpen) {
        const { imageSharpeningService } = await import('./services/imageSharpeningService');

        if (imageSharpeningService.isConfigured()) {
          console.log(`[HeroImage] Sharpening image for tenant ${tenantId}`);
          const sharpenResult = await imageSharpeningService.sharpenImage(
            file.buffer,
            file.mimetype,
            file.originalname
          );

          if (sharpenResult.success && sharpenResult.sharpenedImageBase64) {
            imageBuffer = Buffer.from(sharpenResult.sharpenedImageBase64, 'base64');
            imageMimeType = sharpenResult.mimeType;
            wasSharpened = true;
            console.log(`[HeroImage] Image sharpened successfully. Original: ${file.buffer.length} bytes, Enhanced: ${imageBuffer.length} bytes`);
          } else {
            sharpeningError = sharpenResult.error || 'Sharpening failed';
            console.warn(`[HeroImage] Sharpening failed: ${sharpeningError}. Uploading original.`);
          }
        } else {
          sharpeningError = 'Image sharpening service not configured';
          console.warn('[HeroImage] Sharpening service not configured. Uploading original.');
        }
      }

      // Generate unique path for hero image
      const fileExtension = imageMimeType.split('/')[1] || 'jpg';
      const blobPath = `${tenantId}/hero-image.${fileExtension}`;

      // Upload to Azure Blob Storage
      const uploadResult = await azureBlobStorage.uploadFile(
        'community-assets',
        imageBuffer,
        `hero-image.${fileExtension}`,
        imageMimeType,
        blobPath
      );

      // Store proxy URL with filename so the view endpoint knows exact blob path
      const heroImageUrl = `/api/tenants/${tenantId}/hero-image/view/hero-image.${fileExtension}`;
      const updatedTenant = await storage.updateTenant(tenantId, {
        heroImageUrl,
      });

      res.json({
        success: true,
        heroImageUrl,
        wasSharpened,
        sharpeningError: wasSharpened ? undefined : sharpeningError,
        originalSize: file.buffer.length,
        finalSize: imageBuffer.length,
        tenant: updatedTenant,
      });
    } catch (error: any) {
      console.error('[HeroImage] Upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete hero image
  app.delete("/api/tenants/:tenantId/hero-image", isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;

      // Verify tenant exists
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Community not found" });
      }

      // Update tenant to remove hero image URL
      const updatedTenant = await storage.updateTenant(tenantId, {
        heroImageUrl: null,
      });

      // Note: We don't delete the blob as it may be referenced in cached pages
      // Azure lifecycle policies can clean up old blobs

      res.json({
        success: true,
        tenant: updatedTenant,
      });
    } catch (error: any) {
      console.error('[HeroImage] Delete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve hero image (public proxy - streams from private Azure blob storage)
  app.get("/api/tenants/:tenantId/hero-image/view/:fileName", async (req, res) => {
    try {
      const { tenantId, fileName } = req.params;

      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({ error: "Storage not configured" });
      }

      const blobPath = `${tenantId}/${fileName}`;
      const ext = fileName.split('.').pop()?.toLowerCase() || 'jpeg';
      const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      const imageBuffer = await azureBlobStorage.downloadFile('community-assets', blobPath);

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(imageBuffer);
    } catch (error: any) {
      console.error('[HeroImage] View error:', error);
      res.status(404).json({ error: "Hero image not found" });
    }
  });

  // Generate public records & resources using AI
  app.post("/api/tenants/:tenantId/generate-public-resources", isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      const physicalAddress = (tenant.communitySettings as any)?.physicalAddress;
      if (!physicalAddress || (!physicalAddress.city && !physicalAddress.state && !physicalAddress.zip)) {
        return res.status(400).json({ error: "Physical address (city/state/zip) must be configured in Community Settings before generating public resources." });
      }

      const addressParts = [physicalAddress.city, physicalAddress.state, physicalAddress.zip].filter(Boolean).join(', ');

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || '',
        timeout: 2 * 60 * 1000,
      });

      const promptContent = promptRegistry.getPrompt('public-resources-generation', {
        ADDRESS_PARTS: addressParts,
      });

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: promptContent,
        }],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        return res.status(500).json({ error: "Unexpected AI response format" });
      }

      res.json({ content: content.text });
    } catch (error: any) {
      console.error('[PublicResources] Generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate public resources" });
    }
  });

  // Management Company Settings - Protected routes
  app.get("/api/management-company/:id/settings", isAuthenticated, async (req: any, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Management company not found" });
      }
      if (tenant.type !== 'management_company') {
        return res.status(400).json({ error: "Tenant is not a management company" });
      }
      res.json({
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        settings: tenant.settings || {},
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/management-company/:id/settings", isAuthenticated, async (req: any, res) => {
    try {
      const { name, settings } = req.body;
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Management company not found" });
      }
      if (tenant.type !== 'management_company') {
        return res.status(400).json({ error: "Tenant is not a management company" });
      }

      // Check if tenant has access to Custom Branding feature
      const featureAccess = await storage.checkFeatureAccess(req.params.id, 'custom_branding');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Branding is not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

      // Validate settings schema
      const { managementCompanySettingsSchema } = await import("@shared/schema");
      const validatedSettings = managementCompanySettingsSchema.parse(settings || {});
      
      // Update the tenant
      const updatedTenant = await storage.updateTenant(req.params.id, {
        name: name || tenant.name,
        settings: validatedSettings,
      });
      
      res.json({
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain,
        settings: updatedTenant.settings || {},
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // PROPERTY REP ASSIGNMENT ROUTES
  // ============================================

  // Middleware to check if user can manage rep assignments (management_manager, account_admin, super_admin)
  const requireRepManagementAccess = async (req: any, res: any, next: any) => {
    const userId = req.session?.userId || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userTenants = await storage.getUserTenants(userId);
    const userRoles = userTenants.map(ut => ut.role);

    const allowedRoles = ['management_manager', 'account_admin', 'super_admin'];

    if (!allowedRoles.some(r => userRoles.includes(r))) {
      return res.status(403).json({ error: 'Insufficient permissions to manage property rep assignments' });
    }

    req.userId = userId;
    req.userTenants = userTenants;
    next();
  };

  // Get rep assignments for a property
  app.get('/api/properties/:propertyId/reps', isAuthenticated, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const reps = await storage.getPropertyRepAssignments(propertyId);
      res.json(reps);
    } catch (error: any) {
      console.error('Error fetching property reps:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get rep info for homeowner display (includes fallback)
  app.get('/api/properties/:propertyId/rep-info', isAuthenticated, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const repInfo = await storage.getPropertyRepInfo(propertyId);
      res.json(repInfo);
    } catch (error: any) {
      console.error('Error fetching property rep info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Assign rep to property
  app.post('/api/properties/:propertyId/reps', isAuthenticated, requireRepManagementAccess, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const { userId, designation, title, notes } = req.body;
      const assignedByUserId = req.userId;

      // Get demo code from property if it has one
      const property = await storage.getTenant(propertyId);

      const assignment = await storage.createPropertyRepAssignment({
        propertyId,
        userId,
        designation: designation || 'primary',
        title,
        notes,
        assignedByUserId,
        demoCodeId: property?.demoCodeId,
      });

      res.status(201).json(assignment);
    } catch (error: any) {
      console.error('Error assigning rep to property:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update rep assignment
  app.patch('/api/property-rep-assignments/:id', isAuthenticated, requireRepManagementAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { designation, title, notes, isActive } = req.body;

      const assignment = await storage.updatePropertyRepAssignment(id, {
        designation,
        title,
        notes,
        isActive,
      });

      res.json(assignment);
    } catch (error: any) {
      console.error('Error updating rep assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove rep from property
  app.delete('/api/property-rep-assignments/:id', isAuthenticated, requireRepManagementAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.removePropertyRepAssignment(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing rep assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk assign rep to multiple properties
  app.post('/api/reps/:userId/bulk-assign', isAuthenticated, requireRepManagementAccess, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { propertyIds, designation } = req.body;
      const assignedByUserId = req.userId;

      const assignments = await storage.bulkAssignRepToProperties(
        userId,
        propertyIds,
        designation || 'primary',
        assignedByUserId
      );

      res.json(assignments);
    } catch (error: any) {
      console.error('Error bulk assigning rep:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get properties assigned to a user
  app.get('/api/users/:userId/property-assignments', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const assignments = await storage.getUserPropertyAssignments(userId);
      res.json(assignments);
    } catch (error: any) {
      console.error('Error fetching user property assignments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get default fallback rep for management company
  app.get('/api/management-companies/:id/default-rep', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const tenant = await storage.getTenant(id);

      let defaultRep = null;
      if (tenant?.settings?.defaultRepUserId) {
        defaultRep = await storage.getUser(tenant.settings.defaultRepUserId);
      }

      res.json({
        defaultRepUserId: tenant?.settings?.defaultRepUserId || null,
        defaultRepTitle: tenant?.settings?.defaultRepTitle || null,
        defaultRep,
      });
    } catch (error: any) {
      console.error('Error fetching default rep:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set default fallback rep for management company
  app.put('/api/management-companies/:id/default-rep', isAuthenticated, requireRepManagementAccess, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { userId, title } = req.body;

      const tenant = await storage.setDefaultFallbackRep(id, userId, title);
      res.json(tenant);
    } catch (error: any) {
      console.error('Error setting default rep:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check if current user is assigned to a property (for frontend permission checks)
  app.get('/api/properties/:propertyId/is-assigned', isAuthenticated, async (req: any, res) => {
    try {
      const { propertyId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      if (!userId) {
        return res.json({ isAssigned: false });
      }

      const isAssigned = await storage.isUserAssignedToProperty(userId, propertyId);
      res.json({ isAssigned });
    } catch (error: any) {
      console.error('Error checking assignment:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Subscriptions - Protected routes
  // Get all available plans (filtered by tenant type)
  app.get("/api/subscription-plans", isAuthenticated, async (req, res) => {
    try {
      const { tenantType } = req.query;
      const plans = await storage.listSubscriptionPlans(
        tenantType as 'management_company' | 'community' | undefined
      );
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get current subscription for a tenant
  app.get("/api/tenants/:tenantId/subscription", isAuthenticated, async (req, res) => {
    try {
      const subscription = await storage.getTenantSubscription(req.params.tenantId);
      if (!subscription) {
        return res.status(404).json({ error: "No subscription found" });
      }
      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update tenant subscription (Account Admin only)
  app.post("/api/tenants/:tenantId/subscription", isAuthenticated, async (req: any, res) => {
    try {
      const { planId, changeReason } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "planId is required" });
      }

      // TODO: Check if user is account admin for this tenant
      // For now, we'll allow any authenticated user

      const subscription = await storage.updateTenantSubscription(
        req.params.tenantId,
        planId,
        req.user?.id,
        changeReason
      );

      res.json(subscription);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check feature access
  app.get("/api/tenants/:tenantId/feature-access/:feature", isAuthenticated, async (req, res) => {
    try {
      const { tenantId, feature } = req.params;
      const access = await storage.checkFeatureAccess(tenantId, feature);
      res.json(access);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Form Templates - Protected routes
  app.get("/api/tenants/:tenantId/forms", isAuthenticated, async (req, res) => {
    try {
      const { projectType } = req.query;
      
      if (projectType) {
        // If projectType is specified, return only the active form for that type
        const form = await storage.getActiveFormTemplateForProjectType(req.params.tenantId, projectType as string);
        return res.json(form ? [form] : []);
      }
      
      // Otherwise return all active forms for the tenant
      const forms = await storage.listFormTemplatesForTenant(req.params.tenantId);
      res.json(forms);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/forms/:id", isAuthenticated, async (req, res) => {
    try {
      const form = await storage.getFormTemplate(req.params.id);
      if (!form) {
        return res.status(404).json({ error: "Form template not found" });
      }
      res.json(form);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tenants/:tenantId/forms", isAuthenticated, async (req, res) => {
    try {
      const validated = insertFormTemplateSchema.parse({
        ...req.body,
        tenantId: req.params.tenantId,
      });
      const form = await storage.createFormTemplate(validated);

      // Log usage event for form creation
      try {
        const { usageTrackingService } = await import('./services/usageTrackingService');
        const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
        if (userId) {
          await usageTrackingService.logFormCreated(
            req.params.tenantId,
            form.id,
            userId
          );
          console.log(`[UsageTracking] Logged form created for tenant ${req.params.tenantId}`);
        }
      } catch (trackingError) {
        console.error("[UsageTracking] Error logging form creation:", trackingError);
        // Don't fail the form creation if tracking fails
      }

      res.status(201).json(form);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/forms/:id", isAuthenticated, async (req, res) => {
    try {
      const form = await storage.updateFormTemplate(req.params.id, req.body);
      res.json(form);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Additional Info / Dynamic Forms - Protected routes
  app.get("/api/additional-info/:tenantId/:projectType", isAuthenticated, async (req, res) => {
    try {
      const { tenantId, projectType } = req.params;
      console.log(`[additional-info] Request for tenantId: ${tenantId}, projectType: ${projectType}`);

      const config = await additionalInfoService.getAdditionalInfoConfig(
        tenantId,
        projectType as any
      );

      if (!config) {
        console.error(`[additional-info] No config found for tenantId: ${tenantId}, projectType: ${projectType}`);

        // Debug: Check what templates exist for this tenant
        const templates = await storage.listFormTemplatesForTenant(tenantId);
        console.log(`[additional-info] Templates for tenant ${tenantId}:`, templates.map(t => ({ projectType: t.projectType, isActive: t.isActive })));

        return res.status(404).json({
          error: `No active form configuration found for project type: ${projectType}`,
        });
      }

      res.json(config);
    } catch (error: any) {
      console.error('Error fetching additional info config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/additional-info/validate", isAuthenticated, async (req, res) => {
    try {
      const { formTemplateId, formData } = req.body;

      if (!formTemplateId || !formData) {
        return res.status(400).json({
          error: "formTemplateId and formData are required",
        });
      }

      const config = await additionalInfoService.getFormTemplateConfig(formTemplateId);

      if (!config) {
        return res.status(404).json({
          error: `Form template not found: ${formTemplateId}`,
        });
      }

      const validation = additionalInfoService.validateAdditionalInfo(config, formData);
      res.json(validation);
    } catch (error: any) {
      console.error('Error validating additional info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Applications - Protected routes
  // Note: /list must come before /:id to avoid route collision in Express
  app.get("/api/applications/list", isAuthenticated, async (req: any, res) => {
    try {
      const { role = 'homeowner', tenantId, userId } = req.query;

      if (!tenantId || !userId) {
        return res.status(400).json({ error: "tenantId and userId query parameters are required" });
      }

      const applications = await storage.listApplicationsByRole(role, tenantId, userId);
      res.json(applications);
    } catch (error: any) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Check billing status for graceful degradation
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (userId) {
        const { billingStatusService } = await import('./services/billingStatusService');
        const userRoles = await storage.getUserRolesForTenant(userId, application.tenantId);
        const primaryRole = userRoles[0]?.role || 'homeowner';
        const isOwnApplication = application.submittedByUserId === userId;

        const billingStatus = await billingStatusService.canViewApplicationDetails(
          application.tenantId,
          primaryRole,
          isOwnApplication
        );

        if (!billingStatus.canViewApplicationDetails) {
          // Return redacted application for delinquent accounts
          const redacted = billingStatusService.redactApplicationDetails(application);
          return res.json({
            ...redacted,
            _billingMessage: billingStatus.message,
          });
        }

        // Include billing status warning for admin roles
        if (billingStatus.isDelinquent || billingStatus.isSuspended) {
          return res.json({
            ...application,
            _billingWarning: billingStatus.message,
          });
        }
      }

      res.json(application);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:tenantId/applications", isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.params.tenantId;
      const applications = await storage.listApplicationsForTenant(tenantId);

      // Check billing status for graceful degradation
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (userId) {
        const { billingStatusService } = await import('./services/billingStatusService');
        const userRoles = await storage.getUserRolesForTenant(userId, tenantId);
        const primaryRole = userRoles[0]?.role || 'homeowner';

        // Check if user should see redacted applications
        const billingStatus = await billingStatusService.canViewApplicationDetails(
          tenantId,
          primaryRole,
          false // Not checking own application for list view
        );

        if (!billingStatus.canViewApplicationDetails) {
          // Return redacted applications for delinquent accounts
          const redactedApplications = applications.map(app => {
            // Residents can still see their own applications
            if (app.submittedByUserId === userId) {
              return app;
            }
            return billingStatusService.redactApplicationDetails(app);
          });
          return res.json(redactedApplications);
        }
      }

      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/applications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const applicationId = req.params.id;
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get the application to check authorization
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Get user's role for this application's tenant
      const userRoles = await storage.getUserRolesForTenant(userId, application.tenantId);
      const hasPermission = userRoles.some(r => 
        r.role === 'account_admin' || 
        r.role === 'management_rep' || 
        r.role === 'management_manager'
      );
      
      // Only account_admin and management roles can delete applications
      if (!hasPermission) {
        return res.status(403).json({ error: "You don't have permission to delete applications" });
      }
      
      await storage.deleteApplication(applicationId);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting application:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/applications", isAuthenticated, async (req, res) => {
    console.log('[POST /api/applications] Request body:', JSON.stringify(req.body, null, 2));
    try {
      // Get form template to extract version and config
      const formTemplate = await storage.getFormTemplate(req.body.formTemplateId);
      if (!formTemplate) {
        console.error('[POST /api/applications] Invalid form template:', req.body.formTemplateId);
        return res.status(400).json({ error: "Invalid form template" });
      }

      // Calculate completeness score
      const config = await additionalInfoService.getFormTemplateConfig(req.body.formTemplateId);
      const completenessScore = config
        ? additionalInfoService.calculateCompletenessScore(config, req.body.formData || {})
        : 0;

      // Generate application number
      // Format: {tenant-last-4-chars}-{year}-{random-4-alphanumeric}
      const tenant = await storage.getTenant(req.body.tenantId);
      if (!tenant) {
        return res.status(400).json({ error: "Tenant not found" });
      }
      
      const year = new Date().getFullYear();
      const tenantId = req.body.tenantId;
      const tenantSuffix = tenantId.slice(-4).toUpperCase();
      
      // Generate random 4-character alphanumeric string
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let randomPart = '';
      for (let i = 0; i < 4; i++) {
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      const applicationNumber = `${tenantSuffix}-${year}-${randomPart}`;

      // Sanitize user-submitted form data before storage
      const sanitizedBody = {
        ...req.body,
        formData: req.body.formData ? sanitizeFormData(req.body.formData) : req.body.formData,
      };

      // Validate and create application
      const validated = insertApplicationSchema.parse({
        ...sanitizedBody,
        applicationNumber,
        formTemplateVersion: formTemplate.version,
        completenessScore,
      });

      const application = await storage.createApplication(validated);

      // Seed workflows for tenant and auto-create workflow for application
      try {
        await seedWorkflowTemplates(req.body.tenantId);

        // Get the tenant to check for an active workflow template
        const tenant = await storage.getTenant(req.body.tenantId);
        let workflowTemplateId: string | null = null;

        if (tenant?.workflowTemplateId) {
          // Use the tenant's active workflow template
          workflowTemplateId = tenant.workflowTemplateId;
          console.log(`[Workflow] Using tenant's active workflow: ${workflowTemplateId}`);
        } else {
          // Fallback to first available template if no active workflow is set
          const templates = await storage.listWorkflowTemplatesForTenant(req.body.tenantId);
          if (templates.length > 0) {
            workflowTemplateId = templates[0].id;
            console.log(`[Workflow] No active workflow set, using first template: ${workflowTemplateId}`);
          }
        }

        if (workflowTemplateId) {
          await storage.createApplicationWorkflow({
            applicationId: application.id,
            workflowTemplateId,
          });
        }
      } catch (workflowError) {
        console.error("Warning: Failed to create workflow:", workflowError);
        // Don't fail the entire application creation if workflow setup fails
      }

      // Log usage event for application submission
      try {
        const { usageTrackingService } = await import('./services/usageTrackingService');
        const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
        if (userId && application.tenantId) {
          await usageTrackingService.logApplicationSubmitted(
            application.tenantId,
            application.id,
            userId
          );
          console.log(`[UsageTracking] Logged application submission for tenant ${application.tenantId}`);
        }
      } catch (trackingError) {
        console.error("[UsageTracking] Error logging application submission:", trackingError);
        // Don't fail the application creation if tracking fails
      }

      // Send application submitted email notification
      try {
        const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
        console.log(`[Email] Application submission - userId: ${userId}`);
        
        const user = userId ? await storage.getUser(userId) : null;
        const tenant = await storage.getTenant(req.body.tenantId);
        
        console.log(`[Email] User fetched - id: ${user?.id}, email: "${user?.email}", firstName: ${user?.firstName}, lastName: ${user?.lastName}`);
        console.log(`[Email] Tenant fetched - id: ${tenant?.id}, name: ${tenant?.name}`);
        
        // Only send email if we have a valid email address (skip demo users without email)
        if (user && tenant && user.email) {
          const { emailService } = await import('./emailService');
          const applicationLink = `${process.env.APP_URL || ''}/applications/${application.id}`;
          const applicantName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Resident';
          
          console.log(`[Email] SENDING to: ${user.email}, app: ${req.body.title}`);
          const emailResult = await emailService.sendApplicationSubmitted(
            user.email,
            req.body.title || 'Modification Application',
            applicantName,
            tenant.name,
            applicationLink,
            {
              tenantId: application.tenantId,
              applicationId: application.id,
              templateId: 'applicationSubmitted',
              templateParameters: { recipientName: applicantName, applicationTitle: req.body.title || 'Modification Application', communityName: tenant.name, applicationLink },
              triggeredByUserId: userId,
            }
          );
          console.log(`[Email] Email send result:`, emailResult);
        } else {
          console.log(`[Email] SKIPPED - user exists: ${!!user}, tenant exists: ${!!tenant}, has email: ${!!user?.email}`);
          if (user) console.log(`[Email] User email value: "${user.email}" (type: ${typeof user.email})`);
        }
      } catch (emailError) {
        console.error("[Email] Error sending application submission email:", emailError);
        // Don't fail the entire application creation if email fails
      }

      res.status(201).json(application);
    } catch (error: any) {
      console.error('[POST /api/applications] Error:', error);
      if (error.name === "ZodError") {
        console.error('[POST /api/applications] Zod validation error:', fromZodError(error).message);
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error('[POST /api/applications] Server error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/applications/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status, reviewedByUserId } = req.body;
      const reviewNotes = req.body.reviewNotes ? sanitizeText(req.body.reviewNotes) : req.body.reviewNotes;
      const applicationId = req.params.id;

      // Get current application to check submitter
      const currentApplication = await storage.getApplication(applicationId);

      const application = await storage.updateApplicationStatus(
        applicationId,
        status,
        reviewedByUserId,
        reviewNotes
      );

      // Auto-verify homeowner when their first application is approved
      if (status === 'approved' && currentApplication) {
        try {
          const verifiedRole = await storage.verifyHomeowner(
            currentApplication.submittedByUserId,
            currentApplication.tenantId,
            applicationId
          );
          if (verifiedRole) {
            console.log(`[Auto-Verify] Homeowner ${currentApplication.submittedByUserId} verified via application ${applicationId}`);
          }
        } catch (verifyError) {
          console.error('[Auto-Verify] Error:', verifyError);
          // Don't fail the status update if verification fails
        }
      }

      res.json(application);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update application (for homeowner edits OR delegated edits by management/board)
  app.patch("/api/applications/:id", isAuthenticated, async (req, res) => {
    try {
      const applicationId = req.params.id;
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;

      // Fetch application
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Determine edit type and permissions
      const isOwner = application.submittedByUserId === userId;

      // Check if user is a contractor collaborator with edit permission
      let isContractorCollaborator = false;
      const collaborators = await storage.getApplicationCollaborators(applicationId);
      const contractorCollab = collaborators.find(c =>
        c.contractor?.user?.id === userId &&
        c.status === 'active' &&
        c.canEditForm
      );
      if (contractorCollab) {
        isContractorCollaborator = true;
      }

      // Check if user has a role that allows delegated edits
      const delegatedEditRoles = ['management_rep', 'management_manager', 'account_admin', 'super_admin', 'poa_board_member'];
      const userRoles = await storage.getUserRolesForTenant(userId, application.tenantId);
      const roleNames = userRoles.map(r => r.role);
      const canMakeDelegatedEdit = roleNames.some(role => delegatedEditRoles.includes(role));
      const actingRole = roleNames.find(r => delegatedEditRoles.includes(r)) || roleNames[0];

      // Determine edit type
      let editType: 'owner' | 'contractor' | 'delegated' | 'unauthorized' = 'unauthorized';
      if (isOwner) {
        editType = 'owner';
      } else if (isContractorCollaborator) {
        editType = 'contractor';
      } else if (canMakeDelegatedEdit) {
        editType = 'delegated';
      }

      if (editType === 'unauthorized') {
        return res.status(403).json({ error: "You don't have permission to edit this application" });
      }

      // Verify application can be edited (draft, pending, or under_review)
      if (!['draft', 'pending', 'under_review'].includes(application.status)) {
        return res.status(400).json({ error: "This application cannot be edited in its current status" });
      }

      const { title, description, propertyAddress, formData, status, editReason, editSource } = req.body;

      // Get form config for field labels (used for delegated edits)
      const formConfig = await additionalInfoService.getFormTemplateConfig(application.formTemplateId);

      // Helper function to detect changes between old and new values
      const detectChanges = () => {
        const changes: Array<{ fieldPath: string; fieldLabel: string | null; previousValue: any; newValue: any }> = [];

        // Check top-level fields
        const topLevelFields = [
          { key: 'title', label: 'Project Title' },
          { key: 'description', label: 'Project Description' },
          { key: 'propertyAddress', label: 'Property Address' },
        ];

        for (const field of topLevelFields) {
          const reqValue = req.body[field.key];
          if (reqValue !== undefined && reqValue !== (application as any)[field.key]) {
            changes.push({
              fieldPath: field.key,
              fieldLabel: field.label,
              previousValue: (application as any)[field.key],
              newValue: reqValue,
            });
          }
        }

        // Check formData fields
        if (formData) {
          const originalFormData = (application.formData as Record<string, any>) || {};
          for (const [key, newValue] of Object.entries(formData)) {
            const previousValue = originalFormData[key];
            if (JSON.stringify(previousValue) !== JSON.stringify(newValue)) {
              // Try to get field label from form config
              let fieldLabel: string | null = null;
              if (formConfig?.sections) {
                for (const section of formConfig.sections) {
                  const field = section.fields?.find((f: any) => f.id === key);
                  if (field) {
                    fieldLabel = field.label;
                    break;
                  }
                }
              }
              changes.push({
                fieldPath: `formData.${key}`,
                fieldLabel,
                previousValue,
                newValue,
              });
            }
          }
        }

        return changes;
      };

      // For delegated edits, track field-level changes
      if (editType === 'delegated') {
        const changes = detectChanges();

        // Create field edit records for each change
        for (const change of changes) {
          await storage.createApplicationFieldEdit({
            applicationId,
            tenantId: application.tenantId,
            editedByUserId: userId,
            editedByRole: actingRole || 'unknown',
            onBehalfOfUserId: application.submittedByUserId,
            fieldPath: change.fieldPath,
            fieldLabel: change.fieldLabel,
            previousValue: change.previousValue,
            newValue: change.newValue,
            editReason: editReason || null,
            editSource: editSource || 'phone_call',
            demoCodeId: application.demoCodeId || undefined,
          });
        }

        // Send notification to the application owner
        if (changes.length > 0) {
          try {
            const owner = await storage.getUser(application.submittedByUserId);
            const editor = await storage.getUser(userId);
            const tenant = await storage.getTenant(application.tenantId);

            if (owner?.email && editor && tenant) {
              const { emailService } = await import('./emailService');
              const applicationLink = `${process.env.APP_URL || ''}/applications/${applicationId}`;
              const ownerName = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || 'Valued Resident';
              const editorName = `${editor.firstName || ''} ${editor.lastName || ''}`.trim() || 'A representative';
              const changedFieldLabels = changes.map(c => c.fieldLabel || c.fieldPath);

              await emailService.sendDelegatedEditNotification(
                owner.email,
                ownerName,
                application.title,
                editorName,
                actingRole || 'Representative',
                changedFieldLabels,
                editReason,
                applicationLink,
                tenant.name,
                {
                  tenantId: application.tenantId,
                  applicationId: applicationId,
                  templateId: 'delegatedEditNotification',
                  templateParameters: { recipientName: ownerName, applicationTitle: application.title, editorName, editorRole: actingRole || 'Representative', changedFields: changedFieldLabels.join(', '), editReason: editReason || '', communityName: tenant.name, applicationLink },
                  triggeredByUserId: userId,
                }
              );
            }
          } catch (emailError) {
            console.error("[Email] Error sending delegated edit notification:", emailError);
            // Don't fail the update if email fails
          }
        }
      }

      // Calculate new completeness score if formData changed
      let completenessScore = application.completenessScore;
      if (formData && formConfig) {
        completenessScore = additionalInfoService.calculateCompletenessScore(formConfig, formData);
      }

      // Update the application
      const updates: Partial<any> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (propertyAddress !== undefined) updates.propertyAddress = propertyAddress;
      if (formData !== undefined) updates.formData = formData;
      if (status !== undefined) updates.status = status;
      if (completenessScore !== undefined) updates.completenessScore = completenessScore;

      const updatedApplication = await storage.updateApplication(applicationId, updates);

      // Reset workflow step back to 0 (Application Submitted) when application is edited
      try {
        const [workflow] = await db.select().from(schema.applicationWorkflows).where(eq(schema.applicationWorkflows.applicationId, applicationId));
        if (workflow) {
          await db.update(schema.applicationWorkflows)
            .set({ currentStepIndex: 0 })
            .where(eq(schema.applicationWorkflows.id, workflow.id));
        }
      } catch (workflowError) {
        console.error("[PATCH /api/applications/:id] Error resetting workflow:", workflowError);
        // Don't fail the update if workflow reset fails
      }

      // Send email notification if application was reset to pending from under_review (for owner edits)
      if (editType === 'owner') {
        try {
          if (application.status === 'under_review' && status === 'pending') {
            const user = await storage.getUser(userId);
            const tenant = await storage.getTenant(application.tenantId);

            if (user && tenant && user.email) {
              const { emailService } = await import('./emailService');
              const applicationLink = `${process.env.APP_URL || ''}/applications/${applicationId}`;
              const applicantName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Resident';

              await emailService.sendApplicationSubmitted(
                user.email,
                title || application.title,
                applicantName,
                tenant.name,
                applicationLink,
                {
                  tenantId: application.tenantId,
                  applicationId: applicationId,
                  templateId: 'applicationSubmitted',
                  templateParameters: { recipientName: applicantName, applicationTitle: title || application.title, communityName: tenant.name, applicationLink },
                  triggeredByUserId: userId,
                }
              );
            }
          }
        } catch (emailError) {
          console.error("[Email] Error sending application update email:", emailError);
          // Don't fail the update if email fails
        }
      }

      res.json(updatedApplication);
    } catch (error: any) {
      console.error("[PATCH /api/applications/:id] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get edit history for an application (delegated edits only)
  app.get("/api/applications/:id/edit-history", isAuthenticated, async (req, res) => {
    try {
      const applicationId = req.params.id;
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;

      // Verify application exists and user has access
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Check if user has access to view this application
      const userRoles = await storage.getUserRolesForTenant(userId, application.tenantId);
      const roleNames = userRoles.map(r => r.role);
      const hasAccess = application.submittedByUserId === userId ||
        roleNames.some(r => ['management_rep', 'management_manager', 'account_admin', 'super_admin', 'poa_board_member', 'poa_board_contributor'].includes(r));

      if (!hasAccess) {
        // Check if user is a contractor collaborator
        const collaborators = await storage.getApplicationCollaborators(applicationId);
        const isCollaborator = collaborators.some(c => c.contractor?.user?.id === userId && c.status === 'active');
        if (!isCollaborator) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const edits = await storage.getApplicationFieldEdits(applicationId);
      const summary = await storage.getApplicationEditSummary(applicationId);

      res.json({ edits, summary });
    } catch (error: any) {
      console.error("[GET /api/applications/:id/edit-history] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get edit history for a specific field (for tooltips)
  app.get("/api/applications/:id/field-history/:fieldPath", isAuthenticated, async (req, res) => {
    try {
      const { id: applicationId, fieldPath } = req.params;
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;

      // Verify application exists and user has access
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Check access (same logic as edit-history)
      const userRoles = await storage.getUserRolesForTenant(userId, application.tenantId);
      const roleNames = userRoles.map(r => r.role);
      const hasAccess = application.submittedByUserId === userId ||
        roleNames.some(r => ['management_rep', 'management_manager', 'account_admin', 'super_admin', 'poa_board_member', 'poa_board_contributor'].includes(r));

      if (!hasAccess) {
        const collaborators = await storage.getApplicationCollaborators(applicationId);
        const isCollaborator = collaborators.some(c => c.contractor?.user?.id === userId && c.status === 'active');
        if (!isCollaborator) {
          return res.status(403).json({ error: "Access denied" });
        }
      }

      const history = await storage.getFieldEditHistory(applicationId, decodeURIComponent(fieldPath));
      res.json(history);
    } catch (error: any) {
      console.error("[GET /api/applications/:id/field-history/:fieldPath] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Document Management - Protected routes
  // Upload a document for an application
  app.post("/api/applications/:applicationId/documents", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({
          error: "Document storage is not configured. Please configure Azure Blob Storage."
        });
      }

      const { applicationId } = req.params;
      const { documentRequirementName } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      if (!documentRequirementName) {
        return res.status(400).json({ error: "documentRequirementName is required" });
      }

      // Verify application exists
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Get current user ID
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Generate document ID first (so we can use it in the blob path)
      const documentId = crypto.randomUUID();

      // Get file extension
      const fileExtension = file.originalname.split('.').pop() || '';

      // Construct GUID-based path: {tenantId}/{applicationId}/{documentId}.{ext}
      // Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890/b2c3d4e5-f6a7-8901-bcde-f12345678901/c3d4e5f6-a7b8-9012-cdef-123456789012.pdf
      const blobPath = `${application.tenantId}/${applicationId}/${documentId}.${fileExtension}`;

      // Upload to Azure Blob Storage (blobPath is the full path including filename)
      const uploadResult = await azureBlobStorage.uploadFile(
        'application-documents',
        file.buffer,
        file.originalname,
        file.mimetype,
        blobPath // Pass the full calculated path
      );

      // Save document metadata to database with precalculated path
      const document = await storage.createDocument({
        id: documentId, // Use the same ID we generated
        applicationId,
        documentRequirementName,
        fileName: file.originalname,
        blobPath: blobPath, // Store the full precalculated path
        containerName: uploadResult.containerName,
        fileSize: uploadResult.size,
        mimeType: uploadResult.contentType,
        uploadedByUserId: userId,
        demoCodeId: application.demoCodeId,
      });

      // Log usage event for document upload
      try {
        const { usageTrackingService } = await import('./services/usageTrackingService');
        if (application.tenantId) {
          await usageTrackingService.logDocumentUploaded(
            application.tenantId,
            document.id,
            userId,
            uploadResult.size
          );
          console.log(`[UsageTracking] Logged document upload for tenant ${application.tenantId}`);
        }
      } catch (trackingError) {
        console.error("[UsageTracking] Error logging document upload:", trackingError);
        // Don't fail the document upload if tracking fails
      }

      res.json(document);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({ error: error.message });
    }
  });

  // Test Azure Blob Storage connectivity and container creation
  app.get("/api/test/azure-storage", async (req, res) => {
    try {
      const testResult = {
        configured: azureBlobStorage.isAvailable(),
        timestamp: new Date().toISOString(),
      };

      if (!testResult.configured) {
        return res.json({
          ...testResult,
          status: 'not_configured',
          message: 'Azure Blob Storage is not configured. Check environment variables.'
        });
      }

      // Try to test container creation
      try {
        // Upload a small test file
        const testBuffer = Buffer.from('test');
        const testPath = `test/${Date.now()}.txt`;
        await azureBlobStorage.uploadFile(
          'application-documents',
          testBuffer,
          'test.txt',
          'text/plain',
          testPath
        );

        // Clean up test file
        await azureBlobStorage.deleteFile('application-documents', testPath);

        return res.json({
          ...testResult,
          status: 'success',
          message: 'Container exists or was created successfully',
          containerName: 'application-documents'
        });
      } catch (error: any) {
        console.error('Azure test error:', error);
        return res.json({
          ...testResult,
          status: 'error',
          message: `Failed to create/access container: ${error.message}`,
          error: error.message,
          errorCode: error.code
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get all documents for an application
  app.get("/api/applications/:applicationId/documents", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.listDocumentsByApplication(req.params.applicationId);
      res.json(documents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Download a document
  app.get("/api/documents/:id/download", isAuthenticated, async (req, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({
          error: "Document storage is not configured"
        });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Stream file through server (required for private storage accounts)
      const fileBuffer = await azureBlobStorage.downloadFile(
        document.containerName,
        document.blobPath
      );
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      console.error("Error downloading document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Preview a document (inline display in browser)
  app.get("/api/documents/:id/preview", isAuthenticated, async (req, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({
          error: "Document storage is not configured"
        });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Stream file through server for preview (inline display)
      const fileBuffer = await azureBlobStorage.downloadFile(
        document.containerName,
        document.blobPath
      );
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName}"`);
      res.send(fileBuffer);
    } catch (error: any) {
      console.error("Error previewing document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a document
  app.delete("/api/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({
          error: "Document storage is not configured"
        });
      }

      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      // Verify user has permission to delete (must be uploader or admin)
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (document.uploadedByUserId !== userId) {
        // TODO: Add role-based permission check for admins
        return res.status(403).json({ error: "Unauthorized to delete this document" });
      }

      // Delete from Azure Blob Storage using the precalculated path
      await azureBlobStorage.deleteFile(
        document.containerName,
        document.blobPath
      );

      // Delete from database
      await storage.deleteDocument(req.params.id);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Document Upload - Generate upload token
  app.post("/api/applications/:applicationId/upload-token", isAuthenticated, async (req: any, res) => {
    try {
      const { documentRequirementName } = req.body;
      const userId = req.session?.userId || req.user?.claims?.sub;

      if (!documentRequirementName) {
        return res.status(400).json({ error: "Document requirement name is required" });
      }

      // Generate cryptographically secure token (64 character hex string)
      const token = crypto.randomBytes(32).toString('hex');

      // Token expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const uploadToken = await storage.createDocumentUploadToken({
        token,
        applicationId: req.params.applicationId,
        documentRequirementName,
        expiresAt,
        isUsed: false,
        createdByUserId: userId,
      });

      res.json({
        token: uploadToken.token,
        uploadUrl: `/upload/${uploadToken.token}`,
        expiresAt: uploadToken.expiresAt,
        expiresInMs: 10 * 60 * 1000,
      });
    } catch (error: any) {
      console.error("Error creating upload token:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Document Upload - Validate token and get upload info
  app.get("/api/upload/:token", async (req, res) => {
    try {
      const uploadToken = await storage.getDocumentUploadToken(req.params.token);

      if (!uploadToken) {
        return res.status(404).json({ error: "Invalid upload link" });
      }

      // Check if expired
      if (new Date() > uploadToken.expiresAt) {
        return res.status(410).json({ error: "This upload link has expired" });
      }

      // Check if already used
      if (uploadToken.isUsed) {
        return res.status(410).json({ error: "This upload link has already been used" });
      }

      // Get application details
      const application = await storage.getApplication(uploadToken.applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      res.json({
        documentRequirement: uploadToken.documentRequirementName,
        applicationTitle: application.title,
        applicationNumber: application.applicationNumber,
        expiresAt: uploadToken.expiresAt,
        isValid: true,
      });
    } catch (error: any) {
      console.error("Error validating upload token:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Document Upload - Upload document using token
  app.post("/api/upload/:token", upload.single('file'), async (req: any, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({
          error: "Document storage is not configured"
        });
      }

      const uploadToken = await storage.getDocumentUploadToken(req.params.token);

      if (!uploadToken) {
        return res.status(404).json({ error: "Invalid upload link" });
      }

      // Check if expired
      if (new Date() > uploadToken.expiresAt) {
        return res.status(410).json({ error: "This upload link has expired" });
      }

      // Check if already used
      if (uploadToken.isUsed) {
        return res.status(410).json({ error: "This upload link has already been used" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      const file = req.file;

      // Debug logging
      console.log('=== UPLOAD DEBUG ===');
      console.log('Token:', req.params.token);
      console.log('File object:', file);
      console.log('File keys:', file ? Object.keys(file) : 'FILE IS NULL');
      console.log('req.body:', req.body);
      console.log('req.headers:', req.headers);

      if (!file.originalname && !file.filename) {
        console.error('ERROR: No file name found in upload');
        return res.status(400).json({
          error: "File name is missing",
          debug: {
            hasFile: !!file,
            fileKeys: file ? Object.keys(file) : null,
            fieldname: file?.fieldname
          }
        });
      }

      const application = await storage.getApplication(uploadToken.applicationId);

      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      // Generate document ID and construct blob path
      const documentId = crypto.randomUUID();
      const fileName = file.originalname || file.filename || 'document';
      const fileExtension = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
      const blobPath = `${application.tenantId}/${uploadToken.applicationId}/${documentId}.${fileExtension}`;

      console.log('Calculated blobPath:', blobPath);
      console.log('=== END DEBUG ===');

      // Upload to Azure Blob Storage
      console.log('Uploading to Azure with:', {
        container: 'application-documents',
        bufferSize: file.buffer?.length,
        fileName,
        mimetype: file.mimetype,
        blobPath
      });

      await azureBlobStorage.uploadFile(
        'application-documents',
        file.buffer,
        fileName,
        file.mimetype,
        blobPath
      );

      // Create document record with the token creator as uploader
      const document = await storage.createDocument({
        id: documentId,
        applicationId: uploadToken.applicationId,
        documentRequirementName: uploadToken.documentRequirementName,
        fileName,
        blobPath,
        containerName: 'application-documents',
        fileSize: file.size,
        mimeType: file.mimetype,
        uploadedByUserId: uploadToken.createdByUserId, // Use token creator as uploader
      });

      // Mark token as used
      await storage.markTokenAsUsed(req.params.token, document.id);

      res.json({
        success: true,
        document: {
          id: document.id,
          fileName: document.fileName,
          fileSize: document.fileSize,
          uploadedAt: document.uploadedAt,
        },
      });
    } catch (error: any) {
      console.error("Error uploading document via token:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Document Upload - Check upload status (for polling)
  app.get("/api/upload/:token/status", async (req, res) => {
    try {
      const uploadToken = await storage.getDocumentUploadToken(req.params.token);

      if (!uploadToken) {
        return res.status(404).json({ error: "Invalid upload link" });
      }

      const isExpired = new Date() > uploadToken.expiresAt;

      res.json({
        isUsed: uploadToken.isUsed,
        isExpired,
        uploadedDocumentId: uploadToken.uploadedDocumentId,
        usedAt: uploadToken.usedAt,
      });
    } catch (error: any) {
      console.error("Error checking upload status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User-Tenant relationships - Protected routes
  app.get("/api/users/:userId/tenants", isAuthenticated, async (req, res) => {
    try {
      const tenants = await storage.getUserTenants(req.params.userId);
      res.json(tenants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update user profile
  app.post("/api/users/:userId/profile", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { firstName, lastName, phoneNumber, email, notificationPreferences } = req.body;
      const currentUserId = (req as any).session?.userId || (req as any).user?.claims?.sub;

      // Only allow users to update their own profile
      if (userId !== currentUserId) {
        return res.status(403).json({ error: "Unauthorized: Can only update your own profile" });
      }

      // Get current user to check if they're a demo user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Build updates object - only allow email update for demo users
      const updates: any = {};
      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
      if (notificationPreferences) updates.notificationPreferences = notificationPreferences;
      if (email && user.demoCodeId) {
        updates.email = email;
      } else if (email && !user.demoCodeId) {
        return res.status(400).json({ error: "Email updates are only available for demo accounts" });
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updatedUser = await storage.updateUserProfile(userId, updates);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // User Management - Directory/RBAC endpoints

  // Get all users for a tenant
  app.get("/api/tenants/:tenantId/users", isAuthenticated, async (req, res) => {
    try {
      const users = await storage.getTenantUsers(req.params.tenantId);
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get account admin community assignments for team members
  app.get("/api/tenants/:tenantId/users/account-admin-communities", isAuthenticated, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const tenant = await storage.getTenant(tenantId);
      if (!tenant || tenant.type !== 'management_company') {
        return res.status(400).json({ error: "Only available for management company tenants" });
      }
      const managedCommunities = await storage.getTenantsByManagementCompany(tenantId);
      const adminMap = await storage.getAccountAdminCommunities(tenantId);
      res.json({
        communities: managedCommunities.map(c => ({ id: c.id, name: c.name })),
        adminMap,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Invite/add new user to tenant with role(s)
  app.post("/api/tenants/:tenantId/users", isAuthenticated, async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { email, firstName, lastName, roles } = req.body;

      if (!email || !firstName || !lastName || !roles || !Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ error: "Email, first name, last name, and at least one role are required" });
      }

      // Check if user already exists
      let user = await storage.getUserByEmail(email);

      // If user doesn't exist, create them
      if (!user) {
        user = await storage.upsertUser({
          email,
          firstName,
          lastName,
          profileImageUrl: null,
        });
      }

      // Assign all roles to the user for this tenant
      const roleAssignments = await Promise.all(
        roles.map((role: string) =>
          storage.assignUserRole({
            userId: user!.id,
            tenantId,
            role,
          })
        )
      );

      // Log usage event for user added
      try {
        const { usageTrackingService } = await import('./services/usageTrackingService');
        const addedByUserId = (req as any).session?.userId || (req as any).user?.claims?.sub;
        if (addedByUserId && user) {
          await usageTrackingService.logUserAdded(
            tenantId,
            user.id,
            addedByUserId
          );
          console.log(`[UsageTracking] Logged user added for tenant ${tenantId}`);
        }
      } catch (trackingError) {
        console.error("[UsageTracking] Error logging user added:", trackingError);
        // Don't fail the user creation if tracking fails
      }

      res.json({ user, roleAssignments });
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: "User already has one or more of these roles for this tenant" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Assign additional role to existing user
  app.post("/api/users/:userId/roles", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const { tenantId, role } = req.body;

      if (!tenantId || !role) {
        return res.status(400).json({ error: "Tenant ID and role are required" });
      }

      const assignment = await storage.assignUserRole({
        userId,
        tenantId,
        role,
      });

      res.json(assignment);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(409).json({ error: "User already has this role for this tenant" });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Remove specific role from user
  app.delete("/api/users/:userId/roles/:role", isAuthenticated, async (req, res) => {
    try {
      const { userId, role } = req.params;
      const { tenantId } = req.query;

      if (!tenantId) {
        return res.status(400).json({ error: "Tenant ID is required" });
      }

      await storage.removeUserRole(userId, tenantId as string, role);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Remove user from tenant entirely (all roles)
  app.delete("/api/tenants/:tenantId/users/:userId", isAuthenticated, async (req, res) => {
    try {
      const { tenantId, userId } = req.params;
      await storage.removeUserFromTenant(userId, tenantId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Demo Routes - Public (no auth required)

  // Validate demo code
  app.post("/api/demo/validate-code", async (req, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.json({ valid: false });
      }

      const demoCode = await storage.getDemoCodeByCode(code.toUpperCase());

      if (!demoCode) {
        return res.json({ valid: false });
      }

      // Check if provisioned
      if (!demoCode.isProvisioned) {
        return res.json({ valid: false, message: 'Ecosystem still provisioning. Please try again in a moment.' });
      }

      // Check if active
      if (!demoCode.isActive) {
        return res.json({ valid: false });
      }

      // Check date range
      const now = new Date();
      if (now < new Date(demoCode.validFrom) || now > new Date(demoCode.validUntil)) {
        return res.json({ valid: false, message: 'Demo code expired' });
      }

      // Check usage limit
      if (demoCode.maxUses && demoCode.currentUses >= demoCode.maxUses) {
        return res.json({ valid: false, message: 'Demo code usage limit reached' });
      }

      // Get demo users for this code
      const demoUsers = await storage.getDemoUsersByCodeId(demoCode.id);

      res.json({
        valid: true,
        codeId: demoCode.id,
        label: demoCode.label,
        personas: demoUsers.map(u => ({
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        })),
      });
    } catch (error: any) {
      console.error('Error validating demo code:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Login as demo persona
  app.post("/api/demo/login", async (req: any, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
      }

      // Get user and verify it's a demo user
      const user = await storage.getUser(userId);

      if (!user || !user.demoCodeId) {
        return res.status(400).json({ error: 'Invalid demo user' });
      }

      // Verify demo code still valid
      const demoCode = await storage.getDemoCode(user.demoCodeId);
      if (!demoCode || !demoCode.isActive) {
        return res.status(400).json({ error: 'Demo code no longer valid' });
      }

      const now = new Date();
      if (now < new Date(demoCode.validFrom) || now > new Date(demoCode.validUntil)) {
        return res.status(400).json({ error: 'Demo code expired' });
      }

      // Create session (same as regular auth)
      req.session.userId = user.id;

      // Get user's role from tenant membership and set in session
      const userTenants = await storage.getUserTenants(user.id);
      if (userTenants.length > 0) {
        // Use the first tenant's role (demo users typically have one tenant)
        req.session.currentUserRole = userTenants[0].role;
        console.log('Demo login - Setting session currentUserRole:', userTenants[0].role);
      }

      console.log('Demo login - Setting session userId:', user.id);
      console.log('Demo login - Session ID:', req.sessionID);

      // Track demo session (analytics)
      const demoSession = await storage.createDemoSession({
        demoCodeId: user.demoCodeId,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      // Increment usage counter
      await storage.incrementDemoCodeUsage(user.demoCodeId);

      // Ensure session is saved before responding
      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) {
            console.error('Error saving session:', err);
            reject(err);
          } else {
            console.log('Session saved successfully');
            resolve();
          }
        });
      });

      res.json({
        success: true,
        user,
        sessionId: demoSession.id,
      });
    } catch (error: any) {
      console.error('Error logging in as demo user:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Demo Code Management - Protected routes

  // Helper function to check if user is super_admin
  async function requireSuperAdmin(req: any, res: any, next: any) {
    try {
      // Get current user ID (from session or Replit auth)
      const userId = req.session?.userId || req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user's email
      const user = await storage.getUser(userId);
      if (!user || !user.email) {
        return res.status(401).json({ error: 'User not found' });
      }

      // Check if user's email is in the SUPER_ADMIN_EMAILS environment variable
      const superAdminEmails = process.env.SUPER_ADMIN_EMAILS || '';
      const allowedEmails = superAdminEmails
        .split(';')
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0);

      if (!allowedEmails.includes(user.email.toLowerCase())) {
        return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
      }

      next();
    } catch (error: any) {
      console.error('Error checking super admin:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Admin: Tenant Management (Super Admin only)
  app.get("/api/admin/tenants", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const tenants = await storage.listAllTenants();
      res.json(tenants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // List all AI analyses (super admin only)
  app.get("/api/admin/ai-analyses", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const analyses = await storage.listAllAiAnalyses(limit, startDate, endDate);
      res.json(analyses);
    } catch (error: any) {
      console.error('Error listing AI analyses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset stuck AI analyses (super admin only)
  app.post("/api/admin/ai-analyses/reset-stuck", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const count = await storage.resetStuckAnalyses();
      console.log(`[Admin] Reset ${count} stuck AI analyses`);
      res.json({ message: `Reset ${count} stuck analyses`, count });
    } catch (error: any) {
      console.error('Error resetting stuck AI analyses:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Email Template Dashboard (super admin only)
  // ============================================

  // List all email templates
  app.get("/api/admin/email-templates", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { getAllTemplates } = await import('./emailTemplateRegistry');
      const templates = getAllTemplates();
      res.json({ templates });
    } catch (error: any) {
      console.error('Error listing email templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Preview an email template with sample data
  app.post("/api/admin/email-templates/:templateId/preview", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const { templateId } = req.params;
      const { sampleData } = req.body;

      const { generatePreview } = await import('./emailTemplateRegistry');
      const preview = generatePreview(templateId, sampleData || {});

      if (!preview) {
        return res.status(404).json({ error: `Template not found: ${templateId}` });
      }

      res.json(preview);
    } catch (error: any) {
      console.error('Error generating email preview:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send test email to the requesting admin
  app.post("/api/admin/email-templates/:templateId/send-test", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { sampleData } = req.body;

      // Get the current user's email
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ error: 'User email not found' });
      }

      // Generate the email
      const { generatePreview } = await import('./emailTemplateRegistry');
      const preview = generatePreview(templateId, sampleData || {});

      if (!preview) {
        return res.status(404).json({ error: `Template not found: ${templateId}` });
      }

      // Send the test email
      const { emailService } = await import('./emailService');
      const result = await emailService.send({
        to: user.email,
        subject: `[TEST] ${preview.subject}`,
        html: preview.html,
      }, {
        templateId: templateId,
        templateParameters: sampleData || {},
        triggeredByUserId: userId,
      });

      if (result.success) {
        console.log(`[Admin] Test email sent to ${user.email} for template: ${templateId}`);
        res.json({ success: true, sentTo: user.email });
      } else {
        res.status(500).json({ error: result.error || 'Failed to send test email' });
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all demo codes
  app.get("/api/admin/demo-codes", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const demoCodes = await storage.listDemoCodes();
      res.json(demoCodes);
    } catch (error: any) {
      console.error('Error listing demo codes:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create demo code and provision ecosystem
  app.post("/api/admin/demo-codes", isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      // Check if demo code already exists
      const existingCode = await storage.getDemoCodeByCode(req.body.code?.toUpperCase());
      if (existingCode) {
        return res.status(409).json({ error: `Demo code "${req.body.code}" already exists` });
      }

      // Convert date strings to Date objects before validation
      const bodyWithDates = {
        ...req.body,
        validFrom: new Date(req.body.validFrom),
        validUntil: new Date(req.body.validUntil),
        createdBy: req.session?.userId || req.user?.claims?.sub,
      };

      const validated = insertDemoCodeSchema.parse(bodyWithDates);

      // Create demo code
      const demoCode = await storage.createDemoCode(validated);

      // Provision ecosystem asynchronously (don't block response)
      provisionDemoEcosystem(demoCode.id)
        .then(() => {
          console.log(`✅ Demo ecosystem provisioned for code: ${demoCode.code}`);
        })
        .catch((error) => {
          console.error(`❌ Failed to provision demo ecosystem for code ${demoCode.code}:`, error);
          // Mark demo code as failed with error message
          storage.updateDemoCode(demoCode.id, {
            isActive: false,
            provisioningError: error.message || 'Unknown provisioning error',
          });
        });

      res.status(201).json({
        ...demoCode,
        message: 'Demo code created. Ecosystem provisioning in progress...',
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      console.error('Error creating demo code:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update demo code
  app.patch("/api/admin/demo-codes/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      // Verify demo code exists first
      const existing = await storage.getDemoCode(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: 'Demo code not found' });
      }

      // Convert date strings to Date objects for timestamp fields
      const updates = { ...req.body };
      if (updates.validFrom && typeof updates.validFrom === 'string') {
        updates.validFrom = new Date(updates.validFrom);
      }
      if (updates.validUntil && typeof updates.validUntil === 'string') {
        updates.validUntil = new Date(updates.validUntil);
      }

      const demoCode = await storage.updateDemoCode(req.params.id, updates);
      res.json(demoCode);
    } catch (error: any) {
      console.error('Error updating demo code:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete demo code (and entire ecosystem via cascade)
  app.delete("/api/admin/demo-codes/:id", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      await storage.deleteDemoCode(req.params.id);
      res.json({ success: true, message: 'Demo ecosystem deleted' });
    } catch (error: any) {
      console.error('Error deleting demo code:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get demo code stats
  app.get("/api/admin/demo-codes/:id/stats", isAuthenticated, requireSuperAdmin, async (req, res) => {
    try {
      const demoCode = await storage.getDemoCode(req.params.id);
      if (!demoCode) {
        return res.status(404).json({ error: 'Demo code not found' });
      }

      const stats = await storage.getDemoSessionStats(req.params.id);

      res.json({
        code: demoCode.code,
        label: demoCode.label,
        currentUses: demoCode.currentUses,
        maxUses: demoCode.maxUses,
        isProvisioned: demoCode.isProvisioned,
        ...stats,
      });
    } catch (error: any) {
      console.error('Error getting demo code stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Workflow Templates - list for tenant
  app.get("/api/workflows/templates", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.subdomain) {
        return res.status(400).json({ error: "No tenant context" });
      }
      const tenant = await storage.getTenantBySubdomain(req.subdomain);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      // Custom workflows are now free for everyone - no feature gating
      const templates = await storage.listWorkflowTemplatesForTenant(tenant.id);
      res.json(templates);
    } catch (error: any) {
      console.error("Error fetching workflow templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize workflow for application
  app.post("/api/applications/:applicationId/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;
      const { workflowTemplateId } = req.body;

      const app = await storage.getApplication(applicationId);
      if (!app) return res.status(404).json({ error: "Application not found" });

      // Custom workflows are now free for everyone - no feature gating

      const existing = await storage.getApplicationWorkflow(applicationId);
      if (existing) return res.status(400).json({ error: "Workflow already exists" });

      const workflow = await storage.createApplicationWorkflow({
        applicationId,
        workflowTemplateId,
      });

      res.status(201).json(workflow);
    } catch (error: any) {
      console.error("Error creating workflow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get workflow for application
  app.get("/api/applications/:applicationId/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const application = await storage.getApplication(req.params.applicationId);
      if (!application) return res.status(404).json({ error: "Application not found" });

      // Custom workflows are now free for everyone - no feature gating

      const workflow = await storage.getApplicationWorkflow(req.params.applicationId);
      if (!workflow) return res.status(404).json({ error: "Workflow not found" });

      const template = await storage.getWorkflowTemplate(workflow.workflowTemplateId);
      res.json({ ...workflow, template });
    } catch (error: any) {
      console.error("Error fetching workflow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Advance workflow - perform action
  app.post("/api/applications/:applicationId/workflow/action", isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;
      const { action, stepIndex, notes } = req.body;
      const userId = req.session?.userId || req.user?.claims?.sub;

      // Get application to find tenant
      const application = await storage.getApplication(applicationId);
      if (!application) return res.status(404).json({ error: "Application not found" });

      // Custom workflows are now free for everyone - no feature gating

      // Get workflow and template to check role requirements
      const workflow = await storage.getApplicationWorkflow(applicationId);
      if (!workflow) return res.status(404).json({ error: "Workflow not found" });
      
      const template = await storage.getWorkflowTemplate(workflow.workflowTemplateId);
      if (!template) return res.status(404).json({ error: "Workflow template not found" });

      const steps = template.steps as any[];
      const currentStep = steps[workflow.currentStepIndex];
      
      // Check if current step has role restrictions
      if (currentStep?.role && currentStep.role !== "system") {
        // Get user's roles for this tenant
        const userRoles = await storage.getUserRolesForTenant(userId, application.tenantId);
        const userRoleNames = userRoles.map(r => r.role);
        
        // Check if user has required role
        const allowedRoles = currentStep.role.split("|").map((r: string) => r.trim());
        const hasRequiredRole = allowedRoles.some((role: string) => userRoleNames.includes(role));
        
        if (!hasRequiredRole) {
          return res.status(403).json({ 
            error: `Unauthorized: This step requires one of the following roles: ${allowedRoles.join(", ")}. Your roles: ${userRoleNames.join(", ") || "none"}` 
          });
        }
      }

      const updatedWorkflow = await storage.advanceApplicationWorkflow(
        applicationId,
        action,
        userId,
        stepIndex,
        notes
      );
      
      res.json(updatedWorkflow);
    } catch (error: any) {
      console.error("Error advancing workflow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get workflow action history
  app.get("/api/applications/:applicationId/workflow/history", isAuthenticated, async (req: any, res) => {
    try {
      const application = await storage.getApplication(req.params.applicationId);
      if (!application) return res.status(404).json({ error: "Application not found" });

      // Custom workflows are now free for everyone - no feature gating

      const workflow = await storage.getApplicationWorkflow(req.params.applicationId);
      if (!workflow) return res.status(404).json({ error: "Workflow not found" });

      const history = await storage.getWorkflowActionHistory(workflow.id);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching workflow history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // WORKFLOW DESIGNER ENDPOINTS
  // ============================================================

  // Helper function to check if user is admin
  const requireAdmin = (req: any, res: any): boolean => {
    const userRole = req.session?.currentUserRole || req.user?.role;
    console.log('[requireAdmin] currentUserRole:', req.session?.currentUserRole, 'userRole:', userRole);
    if (userRole !== 'account_admin' && userRole !== 'super_admin') {
      res.status(403).json({ error: "Admin access required" });
      return false;
    }
    return true;
  };

  // List all workflow templates (blueprints + custom for target tenant)
  // Query params:
  //   - targetTenantId: The tenant from the property filter dropdown (for checking clone permissions)
  app.get("/api/workflow-designer/templates", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get target tenant from query param (from property filter dropdown)
      const targetTenantId = req.query.targetTenantId as string | undefined;
      console.log('[workflow-templates] targetTenantId:', targetTenantId);

      // Get user's admin tenants to verify access
      const adminTenants = await storage.getManagedProperties(userId);
      console.log('[workflow-templates] adminTenants:', adminTenants.map(t => ({ id: t.id, name: t.name })));
      if (!adminTenants || adminTenants.length === 0) {
        return res.status(404).json({ error: "No admin tenants found for user" });
      }

      // Get all blueprint templates (global) plus custom templates for target tenant
      const allBlueprints = await storage.listBlueprintWorkflowTemplates();

      let customTemplates: any[] = [];
      let hasCustomWorkflows = false;
      let canClone = false;
      let cloneDisabledReason: string | null = null;
      let lockedWorkflowCount = 0;
      let currentPlan: string | null = null;
      let requiredPlan: string | null = null;

      if (targetTenantId) {
        // Verify user has access to this tenant
        const hasAccess = adminTenants.some(t => t.id === targetTenantId);
        console.log('[workflow-templates] hasAccess:', hasAccess);
        if (!hasAccess) {
          return res.status(403).json({ error: "Access denied to target tenant" });
        }

        // Get custom templates for this tenant
        customTemplates = await storage.listCustomWorkflowTemplatesForTenant(targetTenantId);

        // Custom workflows are now free for everyone - no feature gating
        hasCustomWorkflows = true;
        canClone = true;
      } else {
        // No tenant selected ("All Properties") - can view but not clone
        canClone = false;
        cloneDisabledReason = "Select a specific property to clone workflows";
      }

      // Combine blueprints and custom templates
      const templates = [...allBlueprints, ...customTemplates];

      res.json({
        templates,
        hasCustomWorkflows,
        canClone,
        cloneDisabledReason,
        lockedWorkflowCount,
        currentPlan,
        requiredPlan,
        targetTenantId: targetTenantId || null
      });
    } catch (error: any) {
      console.error("Error fetching workflow templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single template for viewing
  app.get("/api/workflow-designer/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const template = await storage.getWorkflowTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // NOTE: Viewing blueprints is available for all admin users.
      // Custom workflows are now free for everyone
      res.json({ ...template, hasCustomWorkflows: true });
    } catch (error: any) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clone a template into a target tenant
  app.post("/api/workflow-designer/templates/:id/clone", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const { name, description, targetTenantId } = req.body;
      const userId = req.session?.userId || req.user?.claims?.sub;

      // targetTenantId is required (from property filter dropdown)
      if (!targetTenantId) {
        return res.status(400).json({
          error: "Please select a specific property to clone this workflow into"
        });
      }

      const sourceTemplate = await storage.getWorkflowTemplate(req.params.id);
      if (!sourceTemplate) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Verify user has access to the target tenant
      const adminTenants = await storage.getManagedProperties(userId);
      const hasAccess = adminTenants.some(t => t.id === targetTenantId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied to target property" });
      }

      // Custom workflows are now free for everyone - no feature gating

      // Create cloned template in the target tenant
      const clonedTemplate = await storage.cloneWorkflowTemplate(
        req.params.id,
        targetTenantId,
        name,
        description,
        userId
      );

      res.status(201).json(clonedTemplate);
    } catch (error: any) {
      console.error("Error cloning template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update template
  app.put("/api/workflow-designer/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const { name, description, steps } = req.body;

      const template = await storage.getWorkflowTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Cannot edit blueprint templates
      if (template.isBlueprint) {
        return res.status(403).json({ error: "Cannot edit blueprint templates. Clone it first." });
      }

      // Custom workflows are now free for everyone - no feature gating

      // Validate workflow structure
      if (steps) {
        const validation = workflowEngine.validateWorkflow(steps);
        if (!validation.isValid) {
          return res.status(400).json({
            error: "Invalid workflow structure",
            validationErrors: validation.errors
          });
        }
      }

      const updated = await storage.updateWorkflowTemplate(req.params.id, {
        name,
        description,
        steps
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Save template as new version
  app.post("/api/workflow-designer/templates/:id/version", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const { name, description, steps } = req.body;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const template = await storage.getWorkflowTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Custom workflows are now free for everyone - no feature gating

      // Validate workflow structure
      if (steps) {
        const validation = workflowEngine.validateWorkflow(steps);
        if (!validation.isValid) {
          return res.status(400).json({
            error: "Invalid workflow structure",
            validationErrors: validation.errors
          });
        }
      }

      const newVersion = await storage.createWorkflowTemplateVersion(
        req.params.id,
        name,
        description,
        steps,
        userId
      );

      res.status(201).json(newVersion);
    } catch (error: any) {
      console.error("Error creating version:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Assign workflow template to a property (set as active)
  app.post("/api/properties/:propertyId/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const { workflowTemplateId } = req.body;
      const propertyId = req.params.propertyId;
      const userId = req.session?.userId || req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get the property/tenant
      const property = await storage.getTenant(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Get user info for permission check and email
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Check user has access to this property (account_admin, management_manager, or board_member)
      const userTenants = await storage.getUserTenants(userId);
      const userRolesForProperty = userTenants
        .filter(ut => ut.tenantId === propertyId)
        .map(ut => ut.role);

      const allowedRoles = ['account_admin', 'super_admin', 'management_manager', 'poa_board_member', 'hoa_board_member'];
      const hasPermission = userRolesForProperty.some(role => allowedRoles.includes(role));

      if (!hasPermission) {
        return res.status(403).json({ error: "You don't have permission to change the workflow for this property" });
      }

      // Get the workflow template (if specified)
      let newWorkflowName = 'No workflow';
      if (workflowTemplateId) {
        const template = await storage.getWorkflowTemplate(workflowTemplateId);
        if (!template) {
          return res.status(404).json({ error: "Workflow template not found" });
        }
        newWorkflowName = template.name;
        // Custom workflows are now free for everyone - no feature gating
      }

      // Get previous workflow name for email
      let previousWorkflowName: string | null = null;
      if (property.workflowTemplateId) {
        const previousTemplate = await storage.getWorkflowTemplate(property.workflowTemplateId);
        previousWorkflowName = previousTemplate?.name || null;
      }

      // Update the property's workflow
      await storage.updateTenantWorkflow(propertyId, workflowTemplateId || null);

      // Send email notifications to account admins and board members
      const tenantUsers = await storage.getTenantUsers(propertyId);
      const notifyRoles = ['account_admin', 'poa_board_member', 'hoa_board_member'];
      const usersToNotify = tenantUsers.filter(u =>
        u.roles.some(role => notifyRoles.includes(role)) && u.id !== userId
      );

      // Import email service and template
      const { emailService } = await import('./emailService');
      const { workflowChangedTemplate } = await import('./emailTemplates');

      const baseUrl = process.env.APP_URL || 'https://poassociation.com';
      const settingsLink = `${baseUrl}/properties/${propertyId}/settings`;

      const changerName = `${user.firstName} ${user.lastName}`;

      for (const recipient of usersToNotify) {
        if (recipient.email) {
          const html = workflowChangedTemplate(
            recipient.firstName || 'Team Member',
            property.name,
            previousWorkflowName,
            newWorkflowName,
            changerName,
            settingsLink
          );

          emailService.send({
            to: recipient.email,
            subject: `Workflow Updated for ${property.name}`,
            html,
          }, {
            tenantId: propertyId,
            templateId: 'workflowChanged',
            templateParameters: { recipientName: recipient.firstName || 'Team Member', communityName: property.name, previousWorkflowName: previousWorkflowName || 'None', newWorkflowName, changedByName: changerName, settingsLink },
            triggeredByUserId: userId,
          }).catch(err => {
            console.error(`Failed to send workflow change notification to ${recipient.email}:`, err);
          });
        }
      }

      res.json({
        success: true,
        message: `Workflow updated to "${newWorkflowName}"`,
        workflowTemplateId: workflowTemplateId || null,
      });
    } catch (error: any) {
      console.error("Error assigning workflow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current workflow for a property
  app.get("/api/properties/:propertyId/workflow", isAuthenticated, async (req: any, res) => {
    try {
      const propertyId = req.params.propertyId;

      const property = await storage.getTenant(propertyId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      let workflow = null;
      if (property.workflowTemplateId) {
        workflow = await storage.getWorkflowTemplate(property.workflowTemplateId);
      }

      res.json({
        workflowTemplateId: property.workflowTemplateId,
        workflow,
      });
    } catch (error: any) {
      console.error("Error fetching property workflow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete custom template
  app.delete("/api/workflow-designer/templates/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const template = await storage.getWorkflowTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Cannot delete blueprint templates
      if (template.isBlueprint) {
        return res.status(403).json({ error: "Cannot delete blueprint templates" });
      }

      // Custom workflows are now free for everyone - no feature gating

      await storage.deleteWorkflowTemplate(req.params.id);
      res.json({ message: "Template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test a condition with sample data
  app.post("/api/workflow-designer/test-condition", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const { condition, formData, action } = req.body;

      if (!condition) {
        return res.status(400).json({ error: "Condition is required" });
      }

      const result = workflowEngine.evaluateCondition(condition, {
        formData: formData || {},
        action
      });

      res.json({
        result,
        evaluation: {
          condition,
          evaluatedAs: result,
          details: `Condition ${result ? 'passed' : 'failed'}`
        }
      });
    } catch (error: any) {
      console.error("Error testing condition:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test complete workflow with sample data
  app.post("/api/workflow-designer/test-workflow", isAuthenticated, async (req: any, res) => {
    try {
      if (!requireAdmin(req, res)) return;

      const { templateId, formData, actions } = req.body;

      const template = await storage.getWorkflowTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Simulate workflow execution
      const path: any[] = [];
      let currentStepIndex = 0;
      let completed = false;

      for (const actionData of actions) {
        if (currentStepIndex >= template.steps.length) break;

        const currentStep = template.steps[currentStepIndex];
        const nextStepId = workflowEngine.getNextStep(currentStep, {
          formData,
          action: actionData.action
        });

        path.push({
          stepId: currentStep.id,
          stepTitle: currentStep.title,
          action: actionData.action,
          nextStepId
        });

        if (!nextStepId) {
          completed = true;
          break;
        }

        currentStepIndex = template.steps.findIndex(s => s.id === nextStepId);
        if (currentStepIndex === -1) break;
      }

      res.json({
        path,
        completed,
        finalStepIndex: currentStepIndex
      });
    } catch (error: any) {
      console.error("Error testing workflow:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add comment to application
  app.post("/api/applications/:applicationId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;
      const { text, parentCommentId } = req.body;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const comment = await storage.addComment({
        applicationId,
        userId,
        text,
        parentCommentId,
      });

      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error adding comment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get comments for application
  app.get("/api/applications/:applicationId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const comments = await storage.getApplicationComments(req.params.applicationId);
      res.json(comments);
    } catch (error: any) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark comment as resolved
  app.patch("/api/comments/:commentId/resolved", isAuthenticated, async (req: any, res) => {
    try {
      const { commentId } = req.params;
      const { isResolved } = req.body;

      const comment = await storage.updateCommentResolved(commentId, isResolved);
      res.json(comment);
    } catch (error: any) {
      console.error("Error updating comment:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // AI FORM GENERATION ENDPOINTS
  // ============================================================

  // Get tenant's design guidelines URL
  app.get("/api/tenants/:id/design-guidelines", isAuthenticated, async (req: any, res) => {
    try {
      const tenant = await storage.getTenant(req.params.id);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }
      res.json({ designGuidelinesUrl: tenant.designGuidelinesUrl });
    } catch (error: any) {
      console.error("Error fetching design guidelines URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update tenant's design guidelines URL
  app.put("/api/tenants/:id/design-guidelines", isAuthenticated, async (req: any, res) => {
    try {
      const { designGuidelinesUrl } = req.body;
      const updated = await storage.updateTenant(req.params.id, { designGuidelinesUrl });
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating design guidelines URL:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate AI form
  app.post("/api/ai/generate-form", isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, applicationType } = req.body;

      if (!tenantId || !applicationType) {
        return res.status(400).json({ error: "tenantId and applicationType are required" });
      }

      // Get tenant to fetch design guidelines URL
      const tenant = await storage.getTenant(tenantId);
      if (!tenant) {
        return res.status(404).json({ error: "Tenant not found" });
      }

      // Check if tenant has access to AI Form Generation feature
      const featureAccess = await storage.checkFeatureAccess(tenantId, 'ai_form_generation');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "AI Form Generation is not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

      // Check if we have any AI context sources OR the legacy design guidelines URL
      const aiContextSources = await storage.listAiContextSources(tenantId, false);
      if (aiContextSources.length === 0 && !tenant.designGuidelinesUrl) {
        return res.status(400).json({
          error: "No AI context sources configured for this property. Please add document sources or a design guidelines URL in settings first."
        });
      }

      // Import AI generation service
      const { aiFormGenerationService } = await import('./aiFormGenerationService');

      // Generate form using new multi-source context system (with legacy fallback)
      const result = await aiFormGenerationService.generateFormWithContext(
        tenantId,
        applicationType,
        tenant.designGuidelinesUrl || undefined
      );

      // Save generation to database
      const generation = await storage.createAiFormGeneration({
        tenantId,
        applicationType,
        designGuidelinesUrl: tenant.designGuidelinesUrl,
        generatedSchema: result.generatedForm as any,
        status: 'draft',
        tokensUsed: result.tokensUsed,
        estimatedCost: result.estimatedCost,
        generationTimeMs: result.generationTimeMs,
        createdByUserId: req.session?.userId || req.user?.id,
      });

      // Get the next version number for this tenant + project type
      const existingTemplates = await db.select()
        .from(schema.formTemplates)
        .where(and(
          eq(schema.formTemplates.tenantId, tenantId),
          eq(schema.formTemplates.projectType, applicationType)
        ))
        .orderBy(desc(schema.formTemplates.version));

      const nextVersion = existingTemplates.length > 0 ? existingTemplates[0].version + 1 : 1;

      // Create form template (inactive by default)
      const formTemplate = await storage.createFormTemplate({
        tenantId,
        projectType: applicationType,
        version: nextVersion,
        name: result.generatedForm.title || `${applicationType} - v${nextVersion}`,
        description: result.generatedForm.description,
        schema: result.generatedForm as any,
        isActive: false, // New generations are NOT active by default
        createdByUserId: req.session?.userId || req.user?.id,
      });

      // Link the template to the generation
      await storage.linkFormTemplateToGeneration(generation.id, formTemplate.id);

      // Log usage event for AI-generated form creation
      try {
        const { usageTrackingService } = await import('./services/usageTrackingService');
        const userId = req.session?.userId || req.user?.id;
        if (userId) {
          await usageTrackingService.logFormCreated(
            tenantId,
            formTemplate.id,
            userId
          );
          console.log(`[UsageTracking] Logged AI-generated form created for tenant ${tenantId}`);
        }
      } catch (trackingError) {
        console.error("[UsageTracking] Error logging AI form creation:", trackingError);
      }

      res.json({
        ...result,
        generationId: generation.id,
        formTemplateId: formTemplate.id,
        version: nextVersion,
      });
    } catch (error: any) {
      console.error("Error generating form:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // List AI form generations (for admin dashboard)
  app.get("/api/admin/ai-generations", isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const generations = await storage.listAiFormGenerations(tenantId, start, end);
      res.json(generations);
    } catch (error: any) {
      console.error("Error listing AI generations:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get specific AI generation details
  app.get("/api/admin/ai-generations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const generation = await storage.getAiFormGeneration(req.params.id);
      if (!generation) {
        return res.status(404).json({ error: "Generation not found" });
      }
      res.json(generation);
    } catch (error: any) {
      console.error("Error fetching AI generation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve and activate AI-generated form
  app.post("/api/admin/ai-generations/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.id;

      // Get generation
      const generation = await storage.getAiFormGeneration(id);
      if (!generation) {
        return res.status(404).json({ error: "Generation not found" });
      }

      // Create form template from generated schema
      const generatedSchemaObj = generation.generatedSchema as any;
      const formTemplate = await storage.createFormTemplate({
        tenantId: generation.tenantId,
        projectType: generation.applicationType,
        version: 1,
        name: generatedSchemaObj.title || `${generation.applicationType} Form`,
        description: generatedSchemaObj.description || '',
        schema: generatedSchemaObj,
        isActive: true,
        createdByUserId: userId,
        activatedByUserId: userId,
        activatedAt: new Date(),
      });

      // Update generation status and link to form template
      await storage.updateAiFormGenerationStatus(id, 'approved', userId);
      await storage.linkFormTemplateToGeneration(id, formTemplate.id);

      // Log usage event for form creation (from approval)
      try {
        const { usageTrackingService } = await import('./services/usageTrackingService');
        if (userId && generation.tenantId) {
          await usageTrackingService.logFormCreated(
            generation.tenantId,
            formTemplate.id,
            userId
          );
          console.log(`[UsageTracking] Logged approved form created for tenant ${generation.tenantId}`);
        }
      } catch (trackingError) {
        console.error("[UsageTracking] Error logging form approval:", trackingError);
      }

      res.json({
        message: "Form approved and activated",
        formTemplateId: formTemplate.id
      });
    } catch (error: any) {
      console.error("Error approving AI generation:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all versions of a form template for a specific tenant + project type
  app.get("/api/tenants/:tenantId/forms/:projectType/versions", isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, projectType } = req.params;

      const versions = await db.select()
        .from(schema.formTemplates)
        .where(and(
          eq(schema.formTemplates.tenantId, tenantId),
          eq(schema.formTemplates.projectType, projectType)
        ))
        .orderBy(desc(schema.formTemplates.version));

      res.json(versions);
    } catch (error: any) {
      console.error("Error fetching form versions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Activate a specific form template version
  app.post("/api/forms/:id/activate", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.id;

      // Get the template to activate
      const [template] = await db.select()
        .from(schema.formTemplates)
        .where(eq(schema.formTemplates.id, id));

      if (!template) {
        return res.status(404).json({ error: "Form template not found" });
      }

      // Deactivate all other versions for this tenant + project type
      await db.update(schema.formTemplates)
        .set({ isActive: false })
        .where(and(
          eq(schema.formTemplates.tenantId, template.tenantId),
          eq(schema.formTemplates.projectType, template.projectType),
          eq(schema.formTemplates.isActive, true)
        ));

      // Activate this version
      const [activated] = await db.update(schema.formTemplates)
        .set({
          isActive: true,
          activatedAt: new Date(),
          activatedByUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(schema.formTemplates.id, id))
        .returning();

      res.json({
        message: "Form template activated successfully",
        template: activated,
      });
    } catch (error: any) {
      console.error("Error activating form template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a form template version
  app.delete("/api/forms/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get the template first to check if it's active
      const [template] = await db.select()
        .from(schema.formTemplates)
        .where(eq(schema.formTemplates.id, id));

      if (!template) {
        return res.status(404).json({ error: "Form template not found" });
      }

      // Prevent deleting the active version
      if (template.isActive) {
        return res.status(400).json({
          error: "Cannot delete the active version. Please activate a different version first."
        });
      }

      // Delete the template
      await db.delete(schema.formTemplates)
        .where(eq(schema.formTemplates.id, id));

      res.json({ message: "Form template deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting form template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // SIGNATURE ENDPOINTS
  // ============================================================

  // Helper function to get client IP
  function getClientIP(req: any): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.ip ||
      'unknown'
    );
  }

  // Helper function to calculate document hash
  function calculateDocumentHash(data: any): string {
    if (!data) {
      return '';
    }
    const content = JSON.stringify(data);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Create signature or initial
  app.post("/api/signatures", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const {
        applicationId,
        applicationEditId,
        type,
        signatureDataUrl,
        consentText,
        documentData,
      } = req.body;

      // Validate required fields
      if (!applicationId || !type || !signatureDataUrl || !consentText) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Validate type
      if (!['signature', 'initial'].includes(type)) {
        return res.status(400).json({ error: 'Invalid signature type' });
      }

      // Verify user owns the application
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      if (application.submittedByUserId !== userId) {
        return res.status(403).json({ error: 'Not authorized to sign this application' });
      }

      // Get user details
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Convert data URL to blob and upload to Azure
      console.log('[Signature Creation] Processing signatureDataUrl, length:', signatureDataUrl?.length);

      if (!signatureDataUrl || typeof signatureDataUrl !== 'string') {
        console.error('[Signature Creation] Invalid signatureDataUrl:', typeof signatureDataUrl);
        return res.status(400).json({ error: 'signatureDataUrl is required and must be a string' });
      }

      const base64Data = signatureDataUrl.split(',')[1];
      if (!base64Data) {
        console.error('[Signature Creation] Could not extract base64 data from data URL');
        return res.status(400).json({ error: 'Invalid signature data URL format - must be a data URL' });
      }

      console.log('[Signature Creation] Creating buffer from base64 data, length:', base64Data.length);

      let buffer: Buffer;
      try {
        buffer = Buffer.from(base64Data, 'base64');
        if (!buffer || !Buffer.isBuffer(buffer)) {
          throw new Error('Buffer creation failed - result is not a valid Buffer');
        }
        console.log('[Signature Creation] Buffer created successfully, size:', buffer.length, 'bytes');
      } catch (bufferError: any) {
        console.error('[Signature Creation] Failed to create buffer:', bufferError.message);
        return res.status(400).json({ error: `Failed to create buffer from signature data: ${bufferError.message}` });
      }

      const fileName = `${type}-${Date.now()}.png`;
      const blobPath = `${application.tenantId}/${applicationId}/${fileName}`;
      const containerName = 'signatures';

      console.log('[Signature Creation] Uploading to Azure, path:', blobPath);
      console.log('[Signature Creation] Upload params:', {
        containerName,
        bufferSize: buffer?.length,
        bufferIsBuffer: Buffer.isBuffer(buffer),
        fileName,
        contentType: 'image/png',
        blobPath
      });

      // Upload to Azure Blob Storage
      const uploadResult = await azureBlobStorage.uploadFile(
        containerName,
        buffer,
        fileName,
        'image/png',
        blobPath
      );
      console.log('[Signature Creation] Upload successful');

      // Get download URL
      const signatureImageUrl = await azureBlobStorage.getDownloadUrl(
        containerName,
        blobPath
      );
      console.log('[Signature Creation] Download URL obtained:', signatureImageUrl);

      // Calculate document hash (optional)
      const documentHash = documentData ? calculateDocumentHash(documentData) : null;

      // Create signature record
      const signature = await storage.createSignature({
        applicationId,
        applicationEditId: applicationEditId || null,
        signedBy: userId,
        signedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        signedByEmail: user.email || '',
        type,
        signatureImageUrl,
        signatureDataUrl, // Store for backup
        signedAt: new Date(),
        ipAddress: getClientIP(req),
        userAgent: req.headers['user-agent'] || null,
        documentHash,
        consentText,
        consentGiven: true,
        demoCodeId: application.demoCodeId || null,
      });

      // Update application with signature ID (if type is 'signature')
      if (type === 'signature' && !applicationEditId) {
        await storage.updateApplication(applicationId, {
          signatureId: signature.id,
        });
      }

      res.status(201).json(signature);
    } catch (error: any) {
      console.error('Error creating signature:', error);
      res.status(500).json({ error: error.message || 'Failed to create signature' });
    }
  });

  // Get signature by ID
  app.get("/api/signatures/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const signature = await storage.getSignature(id);

      if (!signature) {
        return res.status(404).json({ error: 'Signature not found' });
      }

      // Verify user has access (owner or board member)
      const userId = req.session?.userId || req.user?.claims?.sub;
      const application = await storage.getApplication(signature.applicationId);

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Allow access if user is the owner
      if (application.submittedByUserId !== userId) {
        // TODO: Check if user is board member for this tenant
        // For now, only allow owner
        return res.status(403).json({ error: 'Not authorized' });
      }

      res.json(signature);
    } catch (error: any) {
      console.error('Error fetching signature:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch signature' });
    }
  });

  // Get application's primary signature
  app.get("/api/applications/:id/signature", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const signature = await storage.getApplicationSignature(id);

      if (!signature) {
        return res.status(404).json({ error: 'Signature not found' });
      }

      res.json(signature);
    } catch (error: any) {
      console.error('Error fetching application signature:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch signature' });
    }
  });

  // Get all signatures for application
  app.get("/api/applications/:id/signatures", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const signatures = await storage.listApplicationSignatures(id);
      res.json(signatures);
    } catch (error: any) {
      console.error('Error fetching signatures:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch signatures' });
    }
  });

  // Proxy endpoint to serve signature images from Azure
  app.get("/api/signatures/:id/image", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const signature = await storage.getSignature(id);

      if (!signature) {
        return res.status(404).json({ error: 'Signature not found' });
      }

      if (!signature.blobPath) {
        return res.status(404).json({ error: 'Signature image not found' });
      }

      // Verify user has access to the application
      const application = await storage.getApplication(signature.applicationId);

      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Retrieve image from Azure and pipe to client
      const imageBuffer = await azureBlobStorage.downloadFile(
        'signatures',
        signature.blobPath
      );

      if (!imageBuffer) {
        return res.status(404).json({ error: 'Image not found' });
      }

      res.set('Content-Type', 'image/png');
      res.send(imageBuffer);
    } catch (error: any) {
      console.error('Error serving signature image:', error);
      res.status(500).json({ error: error.message || 'Failed to serve signature image' });
    }
  });

  // ============================================
  // COMPLIANCE ROUTES
  // ============================================

  // Middleware to check compliance access
  const requireComplianceAccess = async (req: any, res: any, next: any) => {
    const userId = req.session?.userId || req.user?.claims?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.userId = userId;

    // Get user's roles across all tenants
    const userTenants = await storage.getUserTenants(userId);
    const userRoles = userTenants.map(ut => ut.role);

    const allowedRoles = ['management_manager', 'super_admin', 'account_admin', 'poa_board_member'];
    const readOnlyRoles = ['management_rep', 'poa_board_contributor'];

    if (allowedRoles.some(r => userRoles.includes(r))) {
      req.complianceAccess = 'full';
      req.userTenants = userTenants;
      return next();
    }

    if (req.method === 'GET' && readOnlyRoles.some(r => userRoles.includes(r))) {
      req.complianceAccess = 'read';
      req.userTenants = userTenants;
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions for compliance module' });
  };

  // List compliance categories
  app.get('/api/compliance/categories', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const categories = await storage.listComplianceCategories(tenantId);
      res.json(categories);
    } catch (error: any) {
      console.error('Error listing compliance categories:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create compliance category
  app.post('/api/compliance/categories', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }
      const category = await storage.createComplianceCategory(req.body);
      res.status(201).json(category);
    } catch (error: any) {
      console.error('Error creating compliance category:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get compliance dashboard
  app.get('/api/compliance/dashboard', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      // Get tenant IDs this user has access to
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);
      console.log('[Compliance Dashboard] tenantIds:', tenantIds);
      const dashboard = await storage.getComplianceDashboard(tenantIds);
      console.log('[Compliance Dashboard] upcoming:', dashboard.upcoming.length, 'overdue:', dashboard.overdue.length);
      // Transform to include count fields expected by client
      res.json({
        ...dashboard,
        upcomingCount: dashboard.upcoming.length,
        overdueCount: dashboard.overdue.length,
        completedThisMonthCount: dashboard.completedThisMonth,
      });
    } catch (error: any) {
      console.error('Error getting compliance dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List compliance items
  app.get('/api/compliance/items', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      const filters = {
        scope: req.query.scope as string | undefined,
        propertyId: req.query.propertyId as string | undefined,
        managementCompanyId: req.query.managementCompanyId as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        status: req.query.status as string | undefined,
        dueBefore: req.query.dueBefore ? new Date(req.query.dueBefore as string) : undefined,
        dueAfter: req.query.dueAfter ? new Date(req.query.dueAfter as string) : undefined,
      };

      // Filter to only tenants user has access to
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);

      // Get all items and filter to accessible ones
      const items = await storage.listComplianceItems(filters);
      const accessibleItems = items.filter(item =>
        tenantIds.includes(item.propertyId) || tenantIds.includes(item.managementCompanyId)
      );

      res.json(accessibleItems);
    } catch (error: any) {
      console.error('Error listing compliance items:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single compliance item
  app.get('/api/compliance/items/:id', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      const item = await storage.getComplianceItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Compliance item not found' });
      }

      // Check access
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);
      if (!tenantIds.includes(item.propertyId) && !tenantIds.includes(item.managementCompanyId)) {
        return res.status(403).json({ error: 'Access denied to this compliance item' });
      }

      res.json(item);
    } catch (error: any) {
      console.error('Error getting compliance item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create compliance item
  app.post('/api/compliance/items', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const item = await storage.createComplianceItem({
        ...req.body,
        createdByUserId: req.userId,
      });
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Error creating compliance item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update compliance item
  app.patch('/api/compliance/items/:id', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const item = await storage.updateComplianceItem(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      console.error('Error updating compliance item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete compliance item
  app.delete('/api/compliance/items/:id', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      await storage.deleteComplianceItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting compliance item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Complete compliance item
  app.post('/api/compliance/items/:id/complete', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const item = await storage.completeComplianceItem(
        req.params.id,
        req.userId,
        req.body.notes
      );
      res.json(item);
    } catch (error: any) {
      console.error('Error completing compliance item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reopen compliance item
  app.post('/api/compliance/items/:id/reopen', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const item = await storage.reopenComplianceItem(req.params.id);
      res.json(item);
    } catch (error: any) {
      console.error('Error reopening compliance item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload compliance document
  app.post('/api/compliance/items/:itemId/documents', isAuthenticated, requireComplianceAccess, upload.single('file'), async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const itemId = req.params.itemId;
      const item = await storage.getComplianceItem(itemId);
      if (!item) {
        return res.status(404).json({ error: 'Compliance item not found' });
      }

      // Upload to blob storage
      const blobPath = `compliance/${itemId}/${Date.now()}-${req.file.originalname}`;
      await azureBlobStorage.uploadDocument(
        req.file.buffer,
        'compliance-documents',
        blobPath,
        req.file.mimetype
      );

      // Create document record
      const doc = await storage.createComplianceDocument({
        complianceItemId: itemId,
        documentType: req.body.documentType || 'other',
        fileName: req.file.originalname,
        blobPath,
        containerName: 'compliance-documents',
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedByUserId: req.userId,
        validFrom: req.body.validFrom ? new Date(req.body.validFrom) : undefined,
        validUntil: req.body.validUntil ? new Date(req.body.validUntil) : undefined,
      });

      res.status(201).json(doc);
    } catch (error: any) {
      console.error('Error uploading compliance document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List compliance documents for an item
  app.get('/api/compliance/items/:itemId/documents', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      const documents = await storage.listComplianceDocuments(req.params.itemId);
      res.json(documents);
    } catch (error: any) {
      console.error('Error listing compliance documents:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download compliance document
  app.get('/api/compliance/documents/:id/download', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      const doc = await storage.getComplianceDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const fileBuffer = await azureBlobStorage.downloadDocument(
        doc.containerName,
        doc.blobPath
      );

      res.set({
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${doc.fileName}"`,
        'Content-Length': doc.fileSize,
      });
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('Error downloading compliance document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete compliance document
  app.delete('/api/compliance/documents/:id', isAuthenticated, requireComplianceAccess, async (req: any, res) => {
    try {
      if (req.complianceAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const doc = await storage.getComplianceDocument(req.params.id);
      if (doc) {
        // Delete from blob storage
        await azureBlobStorage.deleteDocument(doc.containerName, doc.blobPath);
      }

      await storage.deleteComplianceDocument(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting compliance document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // EVENTS / CALENDAR ROUTES
  // ============================================

  // Events access middleware - more permissive than compliance
  // Board members, managers, and reps can all access calendar
  const requireEventsAccess = async (req: any, res: any, next: any) => {
    console.log('[requireEventsAccess] START - path:', req.path, 'method:', req.method);
    const userId = req.session?.userId || req.user?.claims?.sub;
    console.log('[requireEventsAccess] userId:', userId);
    if (!userId) {
      console.log('[requireEventsAccess] DENIED: No userId');
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.userId = userId; // Set for downstream handlers

    // Get user's roles across all tenants
    const userTenants = await storage.getUserTenants(userId);
    const userRoles = userTenants.map(ut => ut.role);
    console.log('[requireEventsAccess] userTenants:', userTenants.length, 'roles:', userRoles);

    // Full access roles can create/edit/delete events AND see all events (public + non-public)
    const fullAccessRoles = ['management_manager', 'super_admin', 'poa_board_member', 'account_admin'];
    // Staff roles can view all events (public + non-public) but not create/edit
    const staffRoles = ['management_rep', 'poa_board_contributor'];
    // Member roles can only view public events
    const memberRoles = ['homeowner', 'household_member', 'contractor'];

    if (fullAccessRoles.some(r => userRoles.includes(r))) {
      console.log('[requireEventsAccess] GRANTED: full access role');
      req.eventsAccess = 'full';
      req.canSeeNonPublic = true; // Can see board-only events
      req.userTenants = userTenants;
      return next();
    }

    if (req.method === 'GET' && staffRoles.some(r => userRoles.includes(r))) {
      console.log('[requireEventsAccess] GRANTED: staff read access');
      req.eventsAccess = 'read';
      req.canSeeNonPublic = true; // Staff can see board-only events
      req.userTenants = userTenants;
      return next();
    }

    if (req.method === 'GET' && memberRoles.some(r => userRoles.includes(r))) {
      console.log('[requireEventsAccess] GRANTED: member read access');
      req.eventsAccess = 'read';
      req.canSeeNonPublic = false; // Members can only see public events
      req.userTenants = userTenants;
      return next();
    }

    // If user has any tenant access, allow read-only for public events only
    if (req.method === 'GET' && userTenants.length > 0) {
      console.log('[requireEventsAccess] GRANTED: tenant member fallback');
      req.eventsAccess = 'read';
      req.canSeeNonPublic = false;
      req.userTenants = userTenants;
      return next();
    }

    console.log('[requireEventsAccess] DENIED: No matching access rule');
    return res.status(403).json({ error: 'Insufficient permissions for calendar' });
  };

  // List event types
  app.get('/api/events/types', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const types = await storage.listEventTypes();
      res.json(types);
    } catch (error: any) {
      console.error('Error listing event types:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get event type by ID
  app.get('/api/events/types/:id', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const eventType = await storage.getEventType(req.params.id);
      if (!eventType) {
        return res.status(404).json({ error: 'Event type not found' });
      }
      res.json(eventType);
    } catch (error: any) {
      console.error('Error getting event type:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List events with filters
  app.get('/api/events', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const filters = {
        tenantId: req.query.tenantId as string | undefined,
        eventTypeId: req.query.eventTypeId as string | undefined,
        status: req.query.status as string | undefined,
        startAfter: req.query.startAfter ? new Date(req.query.startAfter as string) : undefined,
        startBefore: req.query.startBefore ? new Date(req.query.startBefore as string) : undefined,
      };

      // Filter to only tenants user has access to
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);

      const events = await storage.listEvents(filters);
      // Filter to accessible events based on tenant AND visibility
      const accessibleEvents = events.filter(event => {
        // Must have access to the tenant
        if (!tenantIds.includes(event.tenantId)) return false;
        // If user can't see non-public events, filter to only public ones
        if (!req.canSeeNonPublic && !event.isPublic) return false;
        return true;
      });

      res.json(accessibleEvents);
    } catch (error: any) {
      console.error('Error listing events:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get calendar events (for month/range view)
  app.get('/api/events/calendar', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required' });
      }

      // Get tenant IDs user has access to
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);

      const events = await storage.getCalendarEvents(
        tenantIds,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      // Filter based on visibility - homeowners can only see public events
      const accessibleEvents = req.canSeeNonPublic
        ? events
        : events.filter(event => event.isPublic);

      res.json(accessibleEvents);
    } catch (error: any) {
      console.error('Error getting calendar events:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get tenants user can create events for
  // IMPORTANT: This must come BEFORE /api/events/:id to avoid route matching issues
  app.get('/api/events/tenants', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      // Return tenants the user has access to for event creation
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);
      const tenants = await Promise.all(
        [...new Set(tenantIds)].map(async (id: string) => {
          const tenant = await storage.getTenant(id);
          return tenant;
        })
      );
      // Filter out nulls and return with basic info
      const validTenants = tenants.filter(Boolean).map(t => ({
        id: t!.id,
        name: t!.name,
        type: t!.type,
      }));
      res.json(validTenants);
    } catch (error: any) {
      console.error('Error getting event tenants:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single event with attendees, documents, and applications
  app.get('/api/events/:id', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Check access
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);
      console.log('[Event Access Debug]', {
        eventId: req.params.id,
        eventTenantId: event.tenantId,
        userTenantIds: tenantIds,
        isPublic: event.isPublic,
        canSeeNonPublic: req.canSeeNonPublic,
        eventsAccess: req.eventsAccess,
        userRoles: req.userTenants.map((ut: any) => ut.role),
      });

      if (!tenantIds.includes(event.tenantId)) {
        console.log('[Event Access Debug] DENIED: User not in event tenant');
        return res.status(403).json({ error: 'Access denied to this event' });
      }

      // Check visibility - non-public events require staff/board access
      if (!event.isPublic && !req.canSeeNonPublic) {
        console.log('[Event Access Debug] DENIED: Non-public event and user cannot see non-public');
        return res.status(403).json({ error: 'Access denied to this event' });
      }

      res.json(event);
    } catch (error: any) {
      console.error('Error getting event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create event
  app.post('/api/events', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      // Verify user has access to the tenant
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);
      if (!tenantIds.includes(req.body.tenantId)) {
        return res.status(403).json({ error: 'No access to this tenant' });
      }

      // Convert date strings to Date objects for Drizzle timestamp fields
      const eventData = {
        ...req.body,
        createdByUserId: req.userId,
        startDatetime: req.body.startDatetime ? new Date(req.body.startDatetime) : undefined,
        endDatetime: req.body.endDatetime ? new Date(req.body.endDatetime) : undefined,
        recurrenceEndDate: req.body.recurrenceEndDate ? new Date(req.body.recurrenceEndDate) : undefined,
      };

      const event = await storage.createEvent(eventData);
      res.status(201).json(event);
    } catch (error: any) {
      console.error('Error creating event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update event
  app.patch('/api/events/:id', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      // Convert date strings to Date objects for Drizzle timestamp fields
      const updates: any = { ...req.body };
      if (updates.startDatetime) updates.startDatetime = new Date(updates.startDatetime);
      if (updates.endDatetime) updates.endDatetime = new Date(updates.endDatetime);
      if (updates.recurrenceEndDate) updates.recurrenceEndDate = new Date(updates.recurrenceEndDate);

      const event = await storage.updateEvent(req.params.id, updates);
      res.json(event);
    } catch (error: any) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete event
  app.delete('/api/events/:id', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      await storage.deleteEvent(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Complete event
  app.post('/api/events/:id/complete', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const event = await storage.completeEvent(req.params.id);
      res.json(event);
    } catch (error: any) {
      console.error('Error completing event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel event
  app.post('/api/events/:id/cancel', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const event = await storage.cancelEvent(req.params.id);
      res.json(event);
    } catch (error: any) {
      console.error('Error cancelling event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // RECURRING EVENT OCCURRENCE ROUTES
  // ============================================

  // Edit a single occurrence of a recurring event
  // editMode: 'single' (this occurrence), 'thisAndFuture' (this and all future), 'all' (entire series)
  app.post('/api/events/:id/occurrence', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const { id } = req.params;
      const { originalDate, editMode, ...updates } = req.body;

      if (!originalDate) {
        return res.status(400).json({ error: 'originalDate is required' });
      }

      if (!editMode || !['single', 'thisAndFuture', 'all'].includes(editMode)) {
        return res.status(400).json({ error: 'editMode must be single, thisAndFuture, or all' });
      }

      // Extract user ID from session or auth
      const userId = req.userId;

      if (editMode === 'single') {
        // Create an exception event for this occurrence
        const exception = await storage.createEventException(id, originalDate, updates, userId);
        res.json(exception);
      } else if (editMode === 'thisAndFuture') {
        // Split the series at this date
        const result = await storage.splitRecurringSeries(id, originalDate, updates, userId);
        res.json(result.newSeries);
      } else {
        // editMode === 'all' - update the base recurring event
        const event = await storage.updateEvent(id, updates);
        res.json(event);
      }
    } catch (error: any) {
      console.error('Error editing event occurrence:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete occurrence(s) of a recurring event
  // deleteMode: 'single' (this occurrence), 'thisAndFuture' (this and all future), 'all' (entire series)
  app.delete('/api/events/:id/occurrence', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const { id } = req.params;
      const { originalDate, deleteMode } = req.body;

      if (!deleteMode || !['single', 'thisAndFuture', 'all'].includes(deleteMode)) {
        return res.status(400).json({ error: 'deleteMode must be single, thisAndFuture, or all' });
      }

      if (deleteMode === 'single') {
        if (!originalDate) {
          return res.status(400).json({ error: 'originalDate is required for single deletion' });
        }
        // Add date to exception dates (marks this occurrence as deleted)
        await storage.addEventExceptionDate(id, originalDate);
        res.status(204).send();
      } else if (deleteMode === 'thisAndFuture') {
        if (!originalDate) {
          return res.status(400).json({ error: 'originalDate is required for thisAndFuture deletion' });
        }
        // End the series the day before this date
        const endDate = new Date(originalDate);
        endDate.setDate(endDate.getDate() - 1);
        await storage.endRecurringSeries(id, endDate);
        res.status(204).send();
      } else {
        // deleteMode === 'all' - delete the entire series
        await storage.deleteEvent(id);
        res.status(204).send();
      }
    } catch (error: any) {
      console.error('Error deleting event occurrence:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // EVENT ATTENDEES ROUTES
  // ============================================

  // List attendees for an event
  app.get('/api/events/:eventId/attendees', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const attendees = await storage.listEventAttendees(req.params.eventId);
      res.json(attendees);
    } catch (error: any) {
      console.error('Error listing event attendees:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add attendee to event
  app.post('/api/events/:eventId/attendees', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const attendee = await storage.addEventAttendee({
        ...req.body,
        eventId: req.params.eventId,
      });
      res.status(201).json(attendee);
    } catch (error: any) {
      console.error('Error adding event attendee:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update attendee (RSVP, attendance)
  app.patch('/api/events/:eventId/attendees/:attendeeId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      // Allow users to update their own RSVP even with read-only access
      const attendee = await storage.getEventAttendee(req.params.attendeeId);
      if (!attendee) {
        return res.status(404).json({ error: 'Attendee not found' });
      }

      // Only allow self-update for RSVPs (responseStatus, respondedAt)
      const isSelfUpdate = attendee.userId === req.userId;
      const isRsvpOnlyUpdate = Object.keys(req.body).every(k =>
        ['responseStatus', 'respondedAt'].includes(k)
      );

      if (req.eventsAccess !== 'full' && !(isSelfUpdate && isRsvpOnlyUpdate)) {
        return res.status(403).json({ error: 'Write access required' });
      }

      const updated = await storage.updateEventAttendee(req.params.attendeeId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating event attendee:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove attendee from event
  app.delete('/api/events/:eventId/attendees/:attendeeId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      await storage.removeEventAttendee(req.params.attendeeId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error removing event attendee:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // EVENT DOCUMENTS ROUTES
  // ============================================

  // List documents for an event
  app.get('/api/events/:eventId/documents', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const documents = await storage.listEventDocuments(req.params.eventId);
      res.json(documents);
    } catch (error: any) {
      console.error('Error listing event documents:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload document to event
  app.post('/api/events/:eventId/documents', isAuthenticated, requireEventsAccess, upload.single('file'), async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const eventId = req.params.eventId;
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Upload to blob storage
      const blobPath = `events/${eventId}/${Date.now()}-${req.file.originalname}`;
      await azureBlobStorage.uploadDocument(
        req.file.buffer,
        'event-documents',
        blobPath,
        req.file.mimetype
      );

      // Create document record
      const doc = await storage.createEventDocument({
        eventId,
        documentType: req.body.documentType || 'other',
        fileName: req.file.originalname,
        blobPath,
        containerName: 'event-documents',
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        uploadedByUserId: req.userId,
      });

      res.status(201).json(doc);
    } catch (error: any) {
      console.error('Error uploading event document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download event document
  app.get('/api/events/documents/:id/download', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const doc = await storage.getEventDocument(req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      const fileBuffer = await azureBlobStorage.downloadDocument(
        doc.containerName,
        doc.blobPath
      );

      res.set({
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${doc.fileName}"`,
        'Content-Length': doc.fileSize,
      });
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('Error downloading event document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete event document
  app.delete('/api/events/documents/:id', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const doc = await storage.getEventDocument(req.params.id);
      if (doc) {
        await azureBlobStorage.deleteDocument(doc.containerName, doc.blobPath);
      }

      await storage.deleteEventDocument(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting event document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // EVENT APPLICATIONS ROUTES (Review Packets)
  // ============================================

  // List applications linked to an event
  app.get('/api/events/:eventId/applications', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const applications = await storage.listEventApplications(req.params.eventId);
      res.json(applications);
    } catch (error: any) {
      console.error('Error listing event applications:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Link application to event
  app.post('/api/events/:eventId/applications', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const link = await storage.addEventApplication({
        eventId: req.params.eventId,
        applicationId: req.body.applicationId,
        addedByUserId: req.userId,
        orderIndex: req.body.orderIndex,
        notes: req.body.notes,
      });
      res.status(201).json(link);
    } catch (error: any) {
      console.error('Error linking application to event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update application link (order, notes, decision)
  app.patch('/api/events/:eventId/applications/:linkId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const link = await storage.updateEventApplication(req.params.linkId, req.body);
      res.json(link);
    } catch (error: any) {
      console.error('Error updating event application link:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unlink application from event
  app.delete('/api/events/:eventId/applications/:linkId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      await storage.removeEventApplication(req.params.linkId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error unlinking application from event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // INTELLIGENT AGENDA SYSTEM ROUTES
  // ============================================

  // List all agenda sections
  app.get('/api/agenda-sections', isAuthenticated, async (req: any, res) => {
    try {
      const sections = await storage.listAgendaSections();
      res.json(sections);
    } catch (error: any) {
      console.error('Error fetching agenda sections:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List meeting templates
  app.get('/api/meeting-templates', isAuthenticated, async (req: any, res) => {
    try {
      const tenantId = req.query.tenantId as string | undefined;
      const templates = await storage.listMeetingTemplates(tenantId);
      res.json(templates);
    } catch (error: any) {
      console.error('Error fetching meeting templates:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single meeting template
  app.get('/api/meeting-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const template = await storage.getMeetingTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: 'Meeting template not found' });
      }
      res.json(template);
    } catch (error: any) {
      console.error('Error fetching meeting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create meeting template
  app.post('/api/meeting-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      const template = await storage.createMeetingTemplate({
        ...req.body,
        createdByUserId: userId,
      });
      res.status(201).json(template);
    } catch (error: any) {
      console.error('Error creating meeting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update meeting template
  app.patch('/api/meeting-templates/:id', isAuthenticated, async (req: any, res) => {
    try {
      const template = await storage.updateMeetingTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error: any) {
      console.error('Error updating meeting template:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get event agenda (full agenda with sections and items)
  app.get('/api/events/:eventId/agenda', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const agenda = await storage.getEventAgenda(req.params.eventId);
      res.json(agenda);
    } catch (error: any) {
      console.error('Error fetching event agenda:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get smart suggestions for an event's agenda
  app.get('/api/events/:eventId/agenda/suggestions', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      // Get the event to find its tenant
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      console.log('[agenda-suggestions] eventId:', req.params.eventId, 'tenantId:', event.tenantId);
      const suggestions = await storage.getAgendaSuggestions(event.tenantId);
      console.log('[agenda-suggestions] results:', {
        newBusiness: suggestions.newBusiness.length,
        oldBusiness: suggestions.oldBusiness.length,
        finalApproval: suggestions.finalApproval.length,
        newBusinessIds: suggestions.newBusiness.map((a: any) => a.applicationNumber),
      });
      res.json(suggestions);
    } catch (error: any) {
      console.error('Error fetching agenda suggestions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Apply meeting template to event
  app.post('/api/events/:eventId/agenda/apply-template', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const { templateId } = req.body;
      const template = await storage.getMeetingTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Update event with template reference
      const event = await storage.updateEvent(req.params.eventId, {
        meetingTemplateId: templateId,
      });

      res.json({ event, template });
    } catch (error: any) {
      console.error('Error applying template to event:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add agenda item
  app.post('/api/events/:eventId/agenda/items', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      // Validate required fields
      if (!req.body.sectionId) {
        return res.status(400).json({ error: 'Section is required' });
      }
      if (!req.body.itemType) {
        return res.status(400).json({ error: 'Item type is required' });
      }

      const item = await storage.addAgendaItem({
        ...req.body,
        title: req.body.title ? sanitizeText(req.body.title) : req.body.title,
        description: req.body.description ? sanitizeText(req.body.description) : req.body.description,
        presenterNotes: req.body.presenterNotes ? sanitizeText(req.body.presenterNotes) : req.body.presenterNotes,
        decisionNotes: req.body.decisionNotes ? sanitizeText(req.body.decisionNotes) : req.body.decisionNotes,
        discussionNotes: req.body.discussionNotes ? sanitizeText(req.body.discussionNotes) : req.body.discussionNotes,
        eventId: req.params.eventId,
        addedByUserId: req.userId,
      });
      res.status(201).json(item);
    } catch (error: any) {
      console.error('Error adding agenda item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update agenda item
  app.patch('/api/events/:eventId/agenda/items/:itemId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const sanitizedUpdates = { ...req.body };
      if (sanitizedUpdates.title) sanitizedUpdates.title = sanitizeText(sanitizedUpdates.title);
      if (sanitizedUpdates.description) sanitizedUpdates.description = sanitizeText(sanitizedUpdates.description);
      if (sanitizedUpdates.presenterNotes) sanitizedUpdates.presenterNotes = sanitizeText(sanitizedUpdates.presenterNotes);
      if (sanitizedUpdates.decisionNotes) sanitizedUpdates.decisionNotes = sanitizeText(sanitizedUpdates.decisionNotes);
      if (sanitizedUpdates.discussionNotes) sanitizedUpdates.discussionNotes = sanitizeText(sanitizedUpdates.discussionNotes);

      const item = await storage.updateAgendaItem(req.params.itemId, sanitizedUpdates);
      res.json(item);
    } catch (error: any) {
      console.error('Error updating agenda item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete agenda item
  app.delete('/api/events/:eventId/agenda/items/:itemId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      await storage.deleteAgendaItem(req.params.itemId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting agenda item:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder agenda items in a section
  app.post('/api/events/:eventId/agenda/reorder', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const { sectionId, itemIds } = req.body;
      await storage.reorderAgendaItems(req.params.eventId, sectionId, itemIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error reordering agenda items:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Finalize agenda
  app.post('/api/events/:eventId/agenda/finalize', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const event = await storage.finalizeEventAgenda(req.params.eventId, req.userId);
      res.json(event);
    } catch (error: any) {
      console.error('Error finalizing agenda:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unfinalize agenda
  app.post('/api/events/:eventId/agenda/unfinalize', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Write access required' });
      }

      const event = await storage.unfinalizeEventAgenda(req.params.eventId);
      res.json(event);
    } catch (error: any) {
      console.error('Error unfinalizing agenda:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // MEETING FACILITATOR & PRESENTATION MODE ROUTES
  // ============================================

  // Claim facilitator role for a meeting
  app.post('/api/events/:eventId/facilitator/claim', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required to run meeting' });
      }
      const event = await storage.claimFacilitator(req.params.eventId, req.userId);
      res.json(event);
    } catch (error: any) {
      console.error('Error claiming facilitator:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Release facilitator role
  app.post('/api/events/:eventId/facilitator/release', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const event = await storage.releaseFacilitator(req.params.eventId);
      res.json(event);
    } catch (error: any) {
      console.error('Error releasing facilitator:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Start meeting
  app.post('/api/events/:eventId/meeting/start', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const event = await storage.startMeeting(req.params.eventId);
      res.json(event);
    } catch (error: any) {
      console.error('Error starting meeting:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // End meeting
  app.post('/api/events/:eventId/meeting/end', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const event = await storage.endMeeting(req.params.eventId);
      res.json(event);
    } catch (error: any) {
      console.error('Error ending meeting:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark section complete
  app.post('/api/events/:eventId/sections/:sectionId/complete', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const completion = await storage.markSectionComplete(
        req.params.eventId,
        req.params.sectionId,
        req.userId,
        req.body.notes
      );
      res.json(completion);
    } catch (error: any) {
      console.error('Error marking section complete:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Unmark section complete
  app.delete('/api/events/:eventId/sections/:sectionId/complete', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      await storage.unmarkSectionComplete(req.params.eventId, req.params.sectionId);
      res.status(204).send();
    } catch (error: any) {
      console.error('Error unmarking section complete:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get attendance for an event
  app.get('/api/events/:eventId/attendance', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const attendance = await storage.getMeetingAttendance(req.params.eventId);
      res.json(attendance);
    } catch (error: any) {
      console.error('Error getting attendance:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize attendance (populate expected attendees)
  app.post('/api/events/:eventId/attendance/initialize', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const event = await storage.getEvent(req.params.eventId);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      const attendance = await storage.initializeMeetingAttendance(req.params.eventId, event.tenantId);
      res.json(attendance);
    } catch (error: any) {
      console.error('Error initializing attendance:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark attendance for a user
  app.patch('/api/events/:eventId/attendance/:userId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const { status, notes } = req.body;
      const attendance = await storage.markAttendance(
        req.params.eventId,
        req.params.userId,
        status,
        req.userId,
        notes
      );
      res.json(attendance);
    } catch (error: any) {
      console.error('Error marking attendance:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add attendee manually (for guests)
  app.post('/api/events/:eventId/attendance', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      const attendance = await storage.addAttendee({
        eventId: req.params.eventId,
        ...req.body,
      });
      res.status(201).json(attendance);
    } catch (error: any) {
      console.error('Error adding attendee:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get combined directory members for roll call (community + management company)
  app.get('/api/events/:eventId/attendance/directory', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const event = await storage.getEvent(req.params.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      // Get community members
      const communityMembers = await storage.getTenantUsers(event.tenantId);

      // Get management company members if this is a community tenant
      const tenant = await storage.getTenant(event.tenantId);
      let mgmtMembers: (typeof communityMembers[number])[] = [];
      if (tenant?.managementCompanyId) {
        mgmtMembers = await storage.getTenantUsers(tenant.managementCompanyId);
      }

      // Merge, deduplicating by user ID (community roles take precedence)
      const userMap = new Map<string, typeof communityMembers[number]>();
      for (const member of communityMembers) {
        userMap.set(member.id, member);
      }
      for (const member of mgmtMembers) {
        if (userMap.has(member.id)) {
          // Merge roles
          const existing = userMap.get(member.id)!;
          const combinedRoles = [...new Set([...existing.roles, ...member.roles])];
          userMap.set(member.id, { ...existing, roles: combinedRoles });
        } else {
          userMap.set(member.id, member);
        }
      }

      res.json(Array.from(userMap.values()));
    } catch (error: any) {
      console.error('Error getting attendance directory:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove attendee from roll call
  app.delete('/api/events/:eventId/attendance/:userId', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      if (req.eventsAccess !== 'full') {
        return res.status(403).json({ error: 'Full access required' });
      }
      await storage.removeAttendee(req.params.eventId, req.params.userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing attendee:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get full presentation data for a meeting
  app.get('/api/events/:eventId/present', isAuthenticated, requireEventsAccess, async (req: any, res) => {
    try {
      const data = await storage.getEventPresentationData(req.params.eventId);
      res.json(data);
    } catch (error: any) {
      console.error('Error getting presentation data:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get application journey (meeting history for an application)
  app.get('/api/applications/:applicationId/journey', isAuthenticated, async (req: any, res) => {
    try {
      const journey = await storage.getApplicationJourney(req.params.applicationId);
      res.json(journey);
    } catch (error: any) {
      console.error('Error fetching application journey:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // CALENDAR FEED (iCal) ROUTES
  // ============================================

  // Generate iCal content from events
  function generateICalContent(events: any[], calendarName: string): string {
    const icalLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//POAssociation//Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${calendarName}`,
      'X-WR-TIMEZONE:UTC',
    ];

    for (const event of events) {
      const startDate = new Date(event.startDatetime);
      const endDate = new Date(event.endDatetime);

      // Format dates for iCal (YYYYMMDDTHHmmssZ for UTC)
      const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

      // Escape special characters in text
      const escapeText = (text: string) => {
        if (!text) return '';
        return text
          .replace(/\\/g, '\\\\')
          .replace(/;/g, '\\;')
          .replace(/,/g, '\\,')
          .replace(/\n/g, '\\n');
      };

      icalLines.push('BEGIN:VEVENT');
      icalLines.push(`UID:${event.id}@poassociation.com`);
      icalLines.push(`DTSTAMP:${formatDate(new Date())}`);

      if (event.allDay) {
        // All-day events use DATE format (YYYYMMDD)
        const startDateOnly = startDate.toISOString().slice(0, 10).replace(/-/g, '');
        const endDateOnly = new Date(endDate.getTime() + 86400000).toISOString().slice(0, 10).replace(/-/g, '');
        icalLines.push(`DTSTART;VALUE=DATE:${startDateOnly}`);
        icalLines.push(`DTEND;VALUE=DATE:${endDateOnly}`);
      } else {
        icalLines.push(`DTSTART:${formatDate(startDate)}`);
        icalLines.push(`DTEND:${formatDate(endDate)}`);
      }

      icalLines.push(`SUMMARY:${escapeText(event.title)}`);

      if (event.description) {
        icalLines.push(`DESCRIPTION:${escapeText(event.description)}`);
      }

      if (event.location) {
        icalLines.push(`LOCATION:${escapeText(event.location)}`);
      }

      if (event.meetingUrl) {
        // Add URL field for virtual meetings
        icalLines.push(`URL:${event.meetingUrl}`);
      }

      // Add categories based on event type
      if (event.eventType?.name) {
        icalLines.push(`CATEGORIES:${escapeText(event.eventType.name)}`);
      }

      // Add organizer/tenant info
      if (event.tenant?.name) {
        icalLines.push(`X-TENANT:${escapeText(event.tenant.name)}`);
      }

      icalLines.push('END:VEVENT');
    }

    icalLines.push('END:VCALENDAR');
    return icalLines.join('\r\n');
  }

  // Get or create calendar feed token for authenticated user
  app.get('/api/calendar-feed/token', isAuthenticated, async (req: any, res) => {
    try {
      // Get userId from session (demo users) or OAuth claims (Replit auth users)
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Check if user already has a token
      let feedToken = await storage.getCalendarFeedTokenByUserId(userId);

      if (!feedToken) {
        // Generate a new secure token (64 character hex string)
        const token = crypto.randomBytes(32).toString('hex');

        feedToken = await storage.createCalendarFeedToken({
          userId,
          token,
          isActive: true,
        });
      }

      // Build the feed URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const feedUrl = `${protocol}://${host}/api/calendar-feed/${feedToken.token}.ics`;

      res.json({
        token: feedToken.token,
        feedUrl,
        createdAt: feedToken.createdAt,
        lastAccessedAt: feedToken.lastAccessedAt,
        accessCount: feedToken.accessCount,
      });
    } catch (error: any) {
      console.error('Error getting calendar feed token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Regenerate calendar feed token
  app.post('/api/calendar-feed/regenerate', isAuthenticated, async (req: any, res) => {
    try {
      // Get userId from session (demo users) or OAuth claims (Replit auth users)
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Revoke existing token
      const existingToken = await storage.getCalendarFeedTokenByUserId(userId);
      if (existingToken) {
        await storage.revokeCalendarFeedToken(existingToken.id);
      }

      // Generate new token
      const token = crypto.randomBytes(32).toString('hex');
      const feedToken = await storage.createCalendarFeedToken({
        userId,
        token,
        isActive: true,
      });

      // Build the feed URL
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const feedUrl = `${protocol}://${host}/api/calendar-feed/${feedToken.token}.ics`;

      res.json({
        token: feedToken.token,
        feedUrl,
        createdAt: feedToken.createdAt,
        message: 'Calendar feed URL regenerated. Your old URL will no longer work.',
      });
    } catch (error: any) {
      console.error('Error regenerating calendar feed token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // iCal feed endpoint - NO AUTHENTICATION (uses token in URL)
  app.get('/api/calendar-feed/:token.ics', async (req: any, res) => {
    try {
      const { token } = req.params;

      // Look up the token
      const feedToken = await storage.getCalendarFeedTokenByToken(token);
      if (!feedToken) {
        res.status(404).send('Calendar feed not found');
        return;
      }

      // Check if expired
      if (feedToken.expiresAt && new Date(feedToken.expiresAt) < new Date()) {
        res.status(410).send('Calendar feed has expired');
        return;
      }

      // Update access stats
      await storage.updateCalendarFeedTokenAccess(feedToken.id);

      // Get events for this user
      const events = await storage.getEventsForFeed(
        feedToken.userId,
        feedToken.tenantId || undefined,
        feedToken.eventTypeFilter || undefined
      );

      // Get user info for calendar name
      const user = await storage.getUser(feedToken.userId);
      const calendarName = user ? `${user.firstName || 'POA'}'s Calendar` : 'POA Calendar';

      // Generate iCal content
      const icalContent = generateICalContent(events, calendarName);

      // Set appropriate headers
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="calendar.ics"');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.send(icalContent);
    } catch (error: any) {
      console.error('Error serving calendar feed:', error);
      res.status(500).send('Error generating calendar feed');
    }
  });

  // ============================================
  // AI ANALYSIS ENDPOINTS
  // ============================================

  // Helper to check if user has management role (can trigger analysis)
  const canTriggerAnalysis = (role: string): boolean => {
    const allowedRoles = ['management_manager', 'management_rep', 'account_admin', 'super_admin'];
    return allowedRoles.includes(role);
  };

  // Get AI credits status for current tenant
  app.get('/api/ai/credits', isAuthenticated, async (req: any, res) => {
    try {
      let tenant = null;

      // First try subdomain lookup
      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: use their current tenant from session or first tenant assignment
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        if (userTenants.length > 0) {
          // Use current tenant from session if set, otherwise first tenant
          const currentTenantId = req.session?.currentTenantId;
          const targetTenant = currentTenantId
            ? userTenants.find(ut => ut.tenantId === currentTenantId)
            : userTenants[0];
          if (targetTenant) {
            tenant = await storage.getTenant(targetTenant.tenantId);
          }
        }
      }

      if (!tenant) {
        return res.status(400).json({ error: 'No tenant context' });
      }

      const { aiCreditService } = await import('./services/aiCreditService');
      const status = await aiCreditService.getCreditStatus(tenant.id);

      res.json(status);
    } catch (error: any) {
      console.error('Error getting AI credits:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check AI credits (quick check for UI)
  app.get('/api/ai/credits/check', isAuthenticated, async (req: any, res) => {
    try {
      let tenant = null;

      // First try subdomain lookup
      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: use their current tenant from session or first tenant assignment
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        if (userTenants.length > 0) {
          // Use current tenant from session if set, otherwise first tenant
          const currentTenantId = req.session?.currentTenantId;
          const targetTenant = currentTenantId
            ? userTenants.find(ut => ut.tenantId === currentTenantId)
            : userTenants[0];
          if (targetTenant) {
            tenant = await storage.getTenant(targetTenant.tenantId);
          }
        }
      }

      if (!tenant) {
        return res.status(400).json({ error: 'No tenant context' });
      }

      const { aiCreditService } = await import('./services/aiCreditService');
      const check = await aiCreditService.checkCredits(tenant.id);

      res.json(check);
    } catch (error: any) {
      console.error('Error checking AI credits:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super admin: Set credit override for a tenant
  app.post('/api/admin/tenants/:tenantId/ai-credits/override', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const { monthlyCredits, overageCost, reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'Reason is required for credit override' });
      }

      const { aiCreditService } = await import('./services/aiCreditService');
      const credits = await aiCreditService.setOverride(
        tenantId,
        { monthlyCredits, overageCost, reason },
        req.userId
      );

      res.json({ success: true, credits });
    } catch (error: any) {
      console.error('Error setting AI credit override:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super admin: Remove credit override
  app.delete('/api/admin/tenants/:tenantId/ai-credits/override', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { tenantId } = req.params;

      const { aiCreditService } = await import('./services/aiCreditService');
      const credits = await aiCreditService.removeOverride(tenantId);

      res.json({ success: true, credits });
    } catch (error: any) {
      console.error('Error removing AI credit override:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Trigger AI analysis for an application (management roles only)
  app.post('/api/applications/:applicationId/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;
      const { includeSatellite = true, includeMockups = true, includeBreakdownReport = false, includeOcr = false, mockupQuality = 'standard' } = req.body;

      // Get application to verify tenant
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Get userId for all lookups
      const userId = req.session?.userId || req.user?.claims?.sub;

      // Get user's role - first from session, then fallback to user_tenants lookup
      let userRole = req.session?.currentUserRole;

      // For demo users or stale sessions, lookup role from user_tenants
      if (!userRole && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === application.tenantId);
        if (matchingTenant) {
          userRole = matchingTenant.role;
          // Update session for future requests
          req.session.currentUserRole = userRole;
          console.log('[AI Analysis] Set currentUserRole from user_tenants:', userRole);
        }
      }

      if (!canTriggerAnalysis(userRole)) {
        console.log('[AI Analysis] Access denied - userRole:', userRole, 'userId:', userId);
        return res.status(403).json({
          error: 'AI Analysis can only be triggered by management roles',
          requiredRoles: ['management_manager', 'management_rep', 'account_admin'],
        });
      }

      // Verify user has access to this application's tenant
      // For demo users, check their tenant membership instead of subdomain
      let tenant = null;

      // First try subdomain lookup
      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // If no tenant from subdomain (common for demo users), check user's tenant access
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === application.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== application.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { analysisQueueService } = await import('./services/analysisQueueService');
      const result = await analysisQueueService.queueAnalysis({
        applicationId,
        tenantId: tenant.id,
        requestedByUserId: userId || '',
        includeSatellite,
        includeMockups,
        includeBreakdownReport,
        includeOcr,
        mockupQuality,
        demoCodeId: application.demoCodeId ?? undefined,
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error triggering AI analysis:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get analysis status
  app.get('/api/ai/analysis/:analysisId', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access - try subdomain first, then fallback for demo users
      let tenant = null;

      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: check user's tenant membership
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === analysis.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== analysis.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Transform flat DB structure to nested frontend format
      const response = {
        id: analysis.id,
        applicationId: analysis.applicationId,
        tenantId: analysis.tenantId,
        requestedByUserId: analysis.requestedByUserId,
        status: analysis.status,
        result: analysis.complianceScore != null ? {
          complianceScore: analysis.complianceScore,
          riskLevel: analysis.riskLevel,
          overallSummary: analysis.overallSummary,
          bylawCompliance: analysis.bylawCompliance || [],
          riskAssessment: analysis.riskAssessment || [],
          questionsConcerns: analysis.questionsConcerns || [],
          recommendations: analysis.recommendations || [],
        } : undefined,
        satelliteImageUrl: analysis.satelliteImageUrl,
        mockupImageUrls: analysis.aiMockupUrls,
        blueprintImageUrls: analysis.blueprintUrls,
        pdfReportUrl: analysis.pdfReportUrl,
        processingTimeMs: analysis.processingDurationMs,
        totalCostUsd: analysis.totalCostUsd,
        errorMessage: analysis.errorMessage,
        userRating: analysis.userRating,
        userFeedback: analysis.userFeedback,
        propertyResearch: analysis.propertyResearch,
        createdAt: analysis.queuedAt,
        completedAt: analysis.completedAt,
      };

      res.json(response);
    } catch (error: any) {
      console.error('Error getting AI analysis:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get analysis status (polling endpoint)
  app.get('/api/ai/analysis/:analysisId/status', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access - try subdomain first, then fallback for demo users
      let tenant = null;

      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: check user's tenant membership
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === analysis.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== analysis.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { analysisQueueService } = await import('./services/analysisQueueService');
      const status = await analysisQueueService.getStatus(analysisId);

      res.json(status);
    } catch (error: any) {
      console.error('Error getting AI analysis status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all analyses for an application
  app.get('/api/applications/:applicationId/analyses', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;

      // Get application to verify tenant
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify user has access - try subdomain first, then fallback for demo users
      let tenant = null;

      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: check user's tenant membership
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === application.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== application.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const analyses = await storage.getAiAnalysisForApplication(applicationId);
      res.json(analyses);
    } catch (error: any) {
      console.error('Error getting AI analyses for application:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get application timeline (events and analyses)
  app.get('/api/applications/:applicationId/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;

      // Get application to verify access
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify user has access - try subdomain first, then fallback for demo users
      let tenant = null;

      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: check user's tenant membership
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === application.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== application.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Get events for this application
      const events = await storage.getApplicationEvents(applicationId);

      // Enrich events with user info
      const enrichedEvents = await Promise.all(
        events.map(async (event) => {
          let user = null;
          if (event.userId) {
            const userRecord = await storage.getUser(event.userId);
            if (userRecord) {
              user = {
                id: userRecord.id,
                firstName: userRecord.firstName,
                lastName: userRecord.lastName,
                email: userRecord.email,
                profileImageUrl: userRecord.profileImageUrl,
              };
            }
          }
          return { ...event, user };
        })
      );

      // Also get all AI analyses for this application (for the analysis history section)
      const analyses = await storage.getAiAnalysisForApplication(applicationId);

      res.json({
        events: enrichedEvents,
        analyses,
      });
    } catch (error: any) {
      console.error('Error getting application timeline:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Submit feedback for an analysis
  app.post('/api/ai/analysis/:analysisId/feedback', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;
      const { rating, feedback } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
      }

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access - try subdomain first, then fallback for demo users
      let tenant = null;

      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: check user's tenant membership
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === analysis.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== analysis.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const updated = await storage.submitAiAnalysisFeedback(analysisId, rating, feedback);
      res.json({ success: true, analysis: updated });
    } catch (error: any) {
      console.error('Error submitting AI analysis feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel a queued analysis
  app.post('/api/ai/analysis/:analysisId/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access - try subdomain first, then fallback for demo users
      let tenant = null;

      if (req.subdomain) {
        tenant = await storage.getTenantBySubdomain(req.subdomain);
      }

      // Fallback for demo users: check user's tenant membership
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!tenant && userId) {
        const userTenants = await storage.getUserTenants(userId);
        const matchingTenant = userTenants.find(ut => ut.tenantId === analysis.tenantId);
        if (matchingTenant) {
          tenant = await storage.getTenant(matchingTenant.tenantId);
        }
      }

      if (!tenant || tenant.id !== analysis.tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { analysisQueueService } = await import('./services/analysisQueueService');
      await analysisQueueService.cancelAnalysis(analysisId, userId || '');

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error cancelling AI analysis:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download AI analysis PDF report from blob storage
  app.get('/api/ai/analysis/:analysisId/report', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (userId) {
        const userTenants = await storage.getUserTenants(userId);
        const hasAccess = userTenants.some(ut => ut.tenantId === analysis.tenantId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Try to fetch from blob storage
      const { azureBlobStorage } = await import('./azureBlobStorage');
      if (azureBlobStorage.isAvailable()) {
        const blobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-report.pdf`;
        try {
          const pdfBuffer = await azureBlobStorage.downloadFile('ai-analysis-reports', blobPath);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${analysis.id}.pdf"`);
          return res.send(pdfBuffer);
        } catch (error) {
          console.error('Failed to download PDF from blob storage:', error);
          // Fall through to check if stored as data URL
        }
      }

      // Fallback: check if stored as data URL in database
      if (analysis.pdfReportUrl?.startsWith('data:application/pdf;base64,')) {
        const base64Data = analysis.pdfReportUrl.replace('data:application/pdf;base64,', '');
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="analysis-report-${analysis.id}.pdf"`);
        return res.send(pdfBuffer);
      }

      res.status(404).json({ error: 'PDF report not found' });
    } catch (error: any) {
      console.error('Error downloading AI analysis report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download AI analysis satellite image from blob storage
  app.get('/api/ai/analysis/:analysisId/satellite', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (userId) {
        const userTenants = await storage.getUserTenants(userId);
        const hasAccess = userTenants.some(ut => ut.tenantId === analysis.tenantId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Try to fetch from blob storage
      const { azureBlobStorage } = await import('./azureBlobStorage');
      if (azureBlobStorage.isAvailable()) {
        const blobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-satellite.png`;
        try {
          const imageBuffer = await azureBlobStorage.downloadFile('ai-analysis-reports', blobPath);
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
          return res.send(imageBuffer);
        } catch (error) {
          console.error('Failed to download satellite image from blob storage:', error);
        }
      }

      // Fallback: redirect to Google Maps URL if stored
      if (analysis.satelliteImageUrl && analysis.satelliteImageUrl.startsWith('https://')) {
        return res.redirect(analysis.satelliteImageUrl);
      }

      res.status(404).json({ error: 'Satellite image not found' });
    } catch (error: any) {
      console.error('Error downloading satellite image:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download AI analysis breakdown PDF report from blob storage
  app.get('/api/ai/analysis/:analysisId/breakdown-report', isAuthenticated, async (req: any, res) => {
    try {
      const { analysisId } = req.params;

      const analysis = await storage.getAiAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ error: 'Analysis not found' });
      }

      // Verify user has access
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (userId) {
        const userTenants = await storage.getUserTenants(userId);
        const hasAccess = userTenants.some(ut => ut.tenantId === analysis.tenantId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } else {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Try to fetch from blob storage
      const { azureBlobStorage } = await import('./azureBlobStorage');
      if (azureBlobStorage.isAvailable()) {
        const blobPath = `${analysis.tenantId}/${analysis.applicationId}/${analysis.id}-breakdown.pdf`;
        try {
          const pdfBuffer = await azureBlobStorage.downloadFile('ai-analysis-reports', blobPath);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="breakdown-report-${analysis.id}.pdf"`);
          return res.send(pdfBuffer);
        } catch (error) {
          console.error('Failed to download breakdown PDF from blob storage:', error);
        }
      }

      // Fallback: check if stored as data URL in database
      if (analysis.breakdownPdfReportUrl?.startsWith('data:application/pdf;base64,')) {
        const base64Data = analysis.breakdownPdfReportUrl.replace('data:application/pdf;base64,', '');
        const pdfBuffer = Buffer.from(base64Data, 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="breakdown-report-${analysis.id}.pdf"`);
        return res.send(pdfBuffer);
      }

      res.status(404).json({ error: 'Breakdown report not found' });
    } catch (error: any) {
      console.error('Error downloading AI breakdown report:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super admin: Get AI analysis statistics
  app.get('/api/admin/ai-analysis/stats', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getAiAnalysisStats();
      res.json(stats);
    } catch (error: any) {
      console.error('Error getting AI analysis stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super admin: Get AI analysis statistics for specific tenant
  app.get('/api/admin/tenants/:tenantId/ai-analysis/stats', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const stats = await storage.getAiAnalysisStats([tenantId]);
      res.json(stats);
    } catch (error: any) {
      console.error('Error getting tenant AI analysis stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Super admin: Get AI analysis option popularity stats
  app.get('/api/admin/ai/option-stats', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      // Query usage_events for ai_analysis events and aggregate selectedOptions
      const events = await db
        .select()
        .from(schema.usageEvents)
        .where(eq(schema.usageEvents.eventType, 'ai_analysis'))
        .orderBy(desc(schema.usageEvents.createdAt))
        .limit(1000); // Last 1000 analyses

      let totalAnalyses = 0;
      let satelliteCount = 0;
      let mockupsCount = 0;
      let breakdownCount = 0;
      let ocrCount = 0;
      let totalCredits = 0;

      for (const event of events) {
        totalAnalyses++;
        totalCredits += event.creditsUsed || 0;

        // Parse metadata for selected options
        const metadata = event.metadata as { selectedOptions?: { includeSatellite?: boolean; includeMockups?: boolean; includeBreakdownReport?: boolean; includeOcr?: boolean } } | null;
        if (metadata?.selectedOptions) {
          if (metadata.selectedOptions.includeSatellite) satelliteCount++;
          if (metadata.selectedOptions.includeMockups) mockupsCount++;
          if (metadata.selectedOptions.includeBreakdownReport) breakdownCount++;
          if (metadata.selectedOptions.includeOcr) ocrCount++;
        } else {
          // Legacy events without selectedOptions - estimate from credit count
          // Old system: 2 credits = standard, 4 credits = full
          if (event.creditsUsed === 4) {
            mockupsCount++;
          }
          satelliteCount++; // Satellite was always included by default
        }
      }

      const stats = {
        totalAnalyses,
        satelliteCount,
        satellitePercentage: totalAnalyses > 0 ? Math.round((satelliteCount / totalAnalyses) * 100) : 0,
        mockupsCount,
        mockupsPercentage: totalAnalyses > 0 ? Math.round((mockupsCount / totalAnalyses) * 100) : 0,
        breakdownCount,
        breakdownPercentage: totalAnalyses > 0 ? Math.round((breakdownCount / totalAnalyses) * 100) : 0,
        ocrCount,
        ocrPercentage: totalAnalyses > 0 ? Math.round((ocrCount / totalAnalyses) * 100) : 0,
        averageCreditsPerAnalysis: totalAnalyses > 0 ? Math.round((totalCredits / totalAnalyses) * 10) / 10 : 0,
      };

      res.json(stats);
    } catch (error: any) {
      console.error('Error getting AI option stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // OCR & DOCUMENT PROCESSING ENDPOINTS
  // ============================================

  // Trigger OCR processing for an application's documents
  app.post('/api/ai/ocr/:applicationId/process', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;
      const { includeImageEnhancement = true } = req.body;

      // Get application to verify access
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify user has access
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userTenants = await storage.getUserTenants(userId);
      const hasAccess = userTenants.some(ut => ut.tenantId === application.tenantId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Import and use OCR worker
      const { ocrWorker } = await import('./services/ocrWorker');

      // Queue the OCR job
      const job = await ocrWorker.queueOcrJob({
        applicationId,
        requestedByUserId: userId,
        includeImageEnhancement,
      });

      // Return job info
      res.json({
        jobId: job.id,
        status: job.status,
        totalDocuments: job.totalDocuments,
        message: 'OCR processing queued',
      });
    } catch (error: any) {
      console.error('Error triggering OCR processing:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get OCR job status
  app.get('/api/ai/ocr/jobs/:jobId/status', isAuthenticated, async (req: any, res) => {
    try {
      const { jobId } = req.params;

      const { ocrWorker } = await import('./services/ocrWorker');
      const status = await ocrWorker.getJobStatus(jobId);

      res.json(status);
    } catch (error: any) {
      console.error('Error getting OCR job status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get OCR results for an application
  app.get('/api/ai/ocr/:applicationId/results', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId } = req.params;

      // Get application to verify access
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Verify user has access
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const userTenants = await storage.getUserTenants(userId);
      const hasAccess = userTenants.some(ut => ut.tenantId === application.tenantId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { ocrWorker } = await import('./services/ocrWorker');
      const results = await ocrWorker.getOcrResults(applicationId);

      // Also get any pending/processing jobs
      const jobs = await storage.getOcrJobsForApplication(applicationId);
      const activeJob = jobs.find(j => j.status === 'queued' || j.status === 'processing');

      res.json({
        documents: results,
        activeJob: activeJob ? {
          jobId: activeJob.id,
          status: activeJob.status,
          processedDocuments: activeJob.processedDocuments,
          totalDocuments: activeJob.totalDocuments,
        } : null,
      });
    } catch (error: any) {
      console.error('Error getting OCR results:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check OCR service availability
  app.get('/api/ai/ocr/status', isAuthenticated, async (req: any, res) => {
    try {
      const { ocrService } = await import('./services/ocrService');
      const { ocrWorker } = await import('./services/ocrWorker');

      res.json({
        available: ocrService.isConfigured(),
        workerRunning: ocrWorker.isRunning(),
      });
    } catch (error: any) {
      console.error('Error checking OCR status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // SUBSCRIPTION & BILLING ENDPOINTS
  // ============================================

  // Get all community tiers
  app.get('/api/subscription/tiers', async (req, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const tiers = await communitySubscriptionService.getTiers();
      res.json(tiers);
    } catch (error: any) {
      console.error('Error getting community tiers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get subscription for a community (auto-creates if none exists)
  app.get('/api/communities/:communityId/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { communityId } = req.params;
      let subscription = await communitySubscriptionService.getSubscriptionWithTier(communityId);

      // Auto-create subscription if none exists
      if (!subscription) {
        // Get community to check door count
        const tenant = await storage.getTenant(communityId);
        if (!tenant) {
          return res.status(404).json({ error: 'Community not found' });
        }

        // Use tenant's door count or default to 50
        const doorCount = tenant.doorCount || 50;
        subscription = await communitySubscriptionService.createSubscription(communityId, doorCount);
      }

      // Sync credits from old ai_analysis_credits system if new system shows 0
      // This handles both newly created and existing subscriptions that haven't synced
      if (subscription.creditsUsed === 0) {
        const oldCredits = await storage.getAiAnalysisCredits(communityId);
        if (oldCredits && oldCredits.creditsUsedThisMonth > 0) {
          // Update the new subscription with the old credit usage
          await db
            .update(schema.communitySubscriptions)
            .set({ aiCreditsUsed: oldCredits.creditsUsedThisMonth })
            .where(eq(schema.communitySubscriptions.communityId, communityId));

          // Re-fetch to get updated values
          subscription = await communitySubscriptionService.getSubscriptionWithTier(communityId);
        }
      }

      res.json(subscription);
    } catch (error: any) {
      console.error('Error getting community subscription:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create subscription for a community
  app.post('/api/communities/:communityId/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { communityId } = req.params;
      const { doorCount, demoCodeId } = req.body;

      if (!doorCount || doorCount < 1) {
        return res.status(400).json({ error: 'Door count is required and must be at least 1' });
      }

      const subscription = await communitySubscriptionService.createSubscription(
        communityId,
        doorCount,
        demoCodeId
      );
      res.json(subscription);
    } catch (error: any) {
      console.error('Error creating community subscription:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update door count for a community
  app.patch('/api/communities/:communityId/subscription/doors', isAuthenticated, async (req: any, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { communityId } = req.params;
      const { doorCount } = req.body;

      if (!doorCount || doorCount < 1) {
        return res.status(400).json({ error: 'Door count is required and must be at least 1' });
      }

      const subscription = await communitySubscriptionService.updateDoorCount(communityId, doorCount);
      res.json(subscription);
    } catch (error: any) {
      console.error('Error updating door count:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set custom pricing (super_admin only)
  app.patch('/api/communities/:communityId/subscription/pricing', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { communityId } = req.params;
      const userId = req.user?.id;

      const subscription = await communitySubscriptionService.setCustomPricing(
        communityId,
        req.body,
        userId
      );
      res.json(subscription);
    } catch (error: any) {
      console.error('Error setting custom pricing:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear custom pricing (super_admin only)
  app.delete('/api/communities/:communityId/subscription/pricing', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { communityId } = req.params;

      const subscription = await communitySubscriptionService.clearCustomPricing(communityId);
      res.json(subscription);
    } catch (error: any) {
      console.error('Error clearing custom pricing:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // BILLING CONSUMPTION DASHBOARD ENDPOINTS
  // ============================================

  // Get consumption summary for account_admin
  app.get('/api/billing/consumption', isAuthenticated, async (req: any, res) => {
    try {
      const { consumptionDashboardService } = await import('./services/consumptionDashboardService');
      const userId = req.user?.id;

      // Get billing entity for this user
      const billingEntityId = await consumptionDashboardService.getBillingEntityForUser(userId);
      if (!billingEntityId) {
        return res.status(404).json({ error: 'No billing entity found for this user' });
      }

      const summary = await consumptionDashboardService.getConsumptionSummary(billingEntityId);
      res.json(summary);
    } catch (error: any) {
      console.error('Error getting consumption summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get consumption for a specific community
  app.get('/api/billing/consumption/:communityId', isAuthenticated, async (req: any, res) => {
    try {
      const { consumptionDashboardService } = await import('./services/consumptionDashboardService');
      const { communityId } = req.params;

      const consumption = await consumptionDashboardService.getCommunityConsumption(communityId);
      if (!consumption) {
        return res.status(404).json({ error: 'No consumption data found for this community' });
      }
      res.json(consumption);
    } catch (error: any) {
      console.error('Error getting community consumption:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get usage history for charts
  app.get('/api/billing/history', isAuthenticated, async (req: any, res) => {
    try {
      const { consumptionDashboardService } = await import('./services/consumptionDashboardService');
      const userId = req.user?.id;
      const months = parseInt(req.query.months as string) || 6;

      // Get billing entity for this user
      const billingEntityId = await consumptionDashboardService.getBillingEntityForUser(userId);
      if (!billingEntityId) {
        return res.status(404).json({ error: 'No billing entity found for this user' });
      }

      const history = await consumptionDashboardService.getUsageHistory(billingEntityId, months);
      res.json(history);
    } catch (error: any) {
      console.error('Error getting usage history:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get overage projection for a community
  app.get('/api/billing/projection/:communityId', isAuthenticated, async (req: any, res) => {
    try {
      const { consumptionDashboardService } = await import('./services/consumptionDashboardService');
      const { communityId } = req.params;

      const projection = await consumptionDashboardService.getOverageProjection(communityId);
      res.json(projection);
    } catch (error: any) {
      console.error('Error getting overage projection:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // INVOICE ENDPOINTS
  // ============================================

  // List invoices for billing entity
  app.get('/api/invoices', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { consumptionDashboardService } = await import('./services/consumptionDashboardService');
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 12;

      // Get billing entity for this user
      const billingEntityId = await consumptionDashboardService.getBillingEntityForUser(userId);
      if (!billingEntityId) {
        return res.status(404).json({ error: 'No billing entity found for this user' });
      }

      const invoices = await invoiceService.listInvoices(billingEntityId, limit);
      res.json(invoices);
    } catch (error: any) {
      console.error('Error listing invoices:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get invoice by ID
  app.get('/api/invoices/:invoiceId', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { invoiceId } = req.params;

      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(invoice);
    } catch (error: any) {
      console.error('Error getting invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate invoice for current period (admin)
  app.post('/api/invoices/generate', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { consumptionDashboardService } = await import('./services/consumptionDashboardService');
      const userId = req.user?.id;
      const { billingEntityId: overrideBillingEntityId, periodStart, periodEnd } = req.body;

      // Get billing entity - use override if provided (super_admin), otherwise get from user
      let billingEntityId = overrideBillingEntityId;
      if (!billingEntityId) {
        billingEntityId = await consumptionDashboardService.getBillingEntityForUser(userId);
      }

      if (!billingEntityId) {
        return res.status(404).json({ error: 'No billing entity found' });
      }

      const invoice = await invoiceService.generateMonthlyInvoice({
        billingEntityId,
        periodStart: periodStart ? new Date(periodStart) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
        periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
      });
      res.json(invoice);
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Finalize invoice
  app.patch('/api/invoices/:invoiceId/finalize', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { invoiceId } = req.params;

      const invoice = await invoiceService.finalizeInvoice(invoiceId);
      res.json(invoice);
    } catch (error: any) {
      console.error('Error finalizing invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark invoice as paid
  app.patch('/api/invoices/:invoiceId/paid', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { invoiceId } = req.params;
      const { paymentMethod, paymentReference } = req.body;

      const invoice = await invoiceService.markAsPaid(invoiceId, paymentMethod, paymentReference);
      res.json(invoice);
    } catch (error: any) {
      console.error('Error marking invoice as paid:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Void invoice
  app.patch('/api/invoices/:invoiceId/void', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { invoiceId } = req.params;

      const invoice = await invoiceService.voidInvoice(invoiceId);
      res.json(invoice);
    } catch (error: any) {
      console.error('Error voiding invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send invoice via email
  app.post('/api/invoices/:invoiceId/send', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { emailService } = await import('./emailService');
      const { invoiceId } = req.params;

      // Get invoice with line items
      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get billing entity info
      const [billingEntity] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, invoice.billedToTenantId))
        .limit(1);

      if (!billingEntity?.contactEmail) {
        return res.status(400).json({ error: 'Billing entity has no contact email' });
      }

      // Format dates for email
      const periodStart = new Date(invoice.billingPeriodStart).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const periodEnd = new Date(invoice.billingPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const dueDate = invoice.dueDate
        ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Upon receipt';

      const invoiceAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(invoice.totalAmount);

      // Send the email
      const result = await emailService.sendInvoice(
        billingEntity.contactEmail,
        billingEntity.name,
        billingEntity.name,
        invoice.invoiceNumber,
        invoiceAmount,
        `${periodStart} - ${periodEnd}`,
        dueDate,
        `${process.env.APP_URL || ''}/billing?invoice=${invoiceId}`,
        {
          tenantId: invoice.billedToTenantId,
          templateId: 'invoice',
          templateParameters: { recipientName: billingEntity.name, billingEntityName: billingEntity.name, invoiceNumber: invoice.invoiceNumber, invoiceAmount, billingPeriod: `${periodStart} - ${periodEnd}`, dueDate, invoiceLink: `${process.env.APP_URL || ''}/billing?invoice=${invoiceId}` },
        }
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error || 'Failed to send email' });
      }

      // Update invoice status to sent
      const updatedInvoice = await invoiceService.markAsSent(invoiceId);

      res.json({ success: true, invoice: updatedInvoice });
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download invoice as PDF
  app.get('/api/invoices/:invoiceId/download', isAuthenticated, async (req: any, res) => {
    try {
      const { invoiceService } = await import('./services/invoiceService');
      const { invoicePdfService } = await import('./services/invoicePdfService');
      const { invoiceId } = req.params;

      // Get invoice with line items
      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get billing entity info
      const [billingEntity] = await db
        .select()
        .from(schema.tenants)
        .where(eq(schema.tenants.id, invoice.billedToTenantId))
        .limit(1);

      // Generate PDF
      const pdfBuffer = await invoicePdfService.generateInvoicePdf({
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          billingPeriodStart: invoice.billingPeriodStart,
          billingPeriodEnd: invoice.billingPeriodEnd,
          status: invoice.status,
          subtotal: invoice.subtotal,
          taxAmount: invoice.taxAmount,
          discountAmount: invoice.discountAmount,
          totalAmount: invoice.totalAmount,
          dueDate: invoice.dueDate,
          paidAt: invoice.paidAt,
          notes: invoice.notes,
          createdAt: invoice.createdAt,
        },
        billingEntity: {
          name: billingEntity?.name || 'Unknown',
          email: billingEntity?.contactEmail || undefined,
        },
        lineItems: invoice.lineItems.map((item: any) => ({
          communityName: item.communityName,
          lineType: item.lineType,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      });

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);

      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error downloading invoice PDF:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // ACCOUNT ADMIN BILLING ENDPOINTS
  // ============================================

  // Get billing summary for all properties managed by account admin
  app.get('/api/account-admin/billing/summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has account_admin role
      const userRoles = await storage.getUserTenants(userId);
      const isAccountAdmin = userRoles.some(
        r => r.role === 'account_admin' || r.role === 'super_admin'
      );
      if (!isAccountAdmin) {
        return res.status(403).json({ error: 'Access denied. Account admin role required.' });
      }

      // Get all managed communities (not management companies)
      const managedProperties = await storage.getManagedProperties(userId);
      const communities = managedProperties.filter(t => t.type === 'community');

      // Get subscription and usage data for each community
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { usageTrackingService } = await import('./services/usageTrackingService');

      const propertyData = await Promise.all(
        communities.map(async (community) => {
          const subscription = await communitySubscriptionService.getSubscriptionWithTier(community.id);

          // Get current period dates
          const periodStart = subscription?.currentPeriodStart
            ? new Date(subscription.currentPeriodStart)
            : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const periodEnd = subscription?.currentPeriodEnd
            ? new Date(subscription.currentPeriodEnd)
            : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

          // Get usage summary for current period
          const usageSummary = await usageTrackingService.getUsageSummary(
            community.id,
            periodStart,
            periodEnd
          );

          const creditsIncluded = subscription?.effectiveCredits || 0;
          const creditsUsed = subscription?.creditsUsed || 0;
          const creditsRemaining = Math.max(0, creditsIncluded - creditsUsed);
          const isOverage = creditsUsed > creditsIncluded;

          return {
            communityId: community.id,
            communityName: community.name,
            subscriptionTier: subscription?.tier?.name || 'None',
            tierCode: subscription?.tier?.tierCode || null,
            currentPeriod: {
              start: periodStart.toISOString(),
              end: periodEnd.toISOString(),
            },
            creditsIncluded,
            creditsUsed,
            creditsRemaining,
            isOverage,
            overageCost: isOverage ? (creditsUsed - creditsIncluded) * (subscription?.effectiveOverageCost || 2) : 0,
            applicationCount: usageSummary.totalApplications,
            aiAnalysisCount: usageSummary.totalAiAnalyses,
          };
        })
      );

      // Calculate totals
      const totals = {
        totalCreditsUsed: propertyData.reduce((sum, p) => sum + p.creditsUsed, 0),
        totalOverageCost: propertyData.reduce((sum, p) => sum + p.overageCost, 0),
        totalApplications: propertyData.reduce((sum, p) => sum + p.applicationCount, 0),
        totalAiAnalyses: propertyData.reduce((sum, p) => sum + p.aiAnalysisCount, 0),
      };

      res.json({
        properties: propertyData,
        totals,
      });
    } catch (error: any) {
      console.error('Error getting account admin billing summary:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get detailed billing activity for a specific community
  app.get('/api/account-admin/billing/:communityId/detail', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const { communityId } = req.params;
      const { period = 'month', startDate, endDate } = req.query;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has access to this community
      const managedProperties = await storage.getManagedProperties(userId);
      const hasAccess = managedProperties.some(p => p.id === communityId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this community.' });
      }

      // Get community info
      const community = await storage.getTenant(communityId);
      if (!community) {
        return res.status(404).json({ error: 'Community not found' });
      }

      // Calculate date range based on period
      let periodStartDate: Date;
      let periodEndDate: Date;

      if (startDate && endDate) {
        periodStartDate = new Date(startDate as string);
        periodEndDate = new Date(endDate as string);
      } else {
        const now = new Date();
        switch (period) {
          case 'quarter':
            const quarter = Math.floor(now.getMonth() / 3);
            periodStartDate = new Date(now.getFullYear(), quarter * 3, 1);
            periodEndDate = new Date(now.getFullYear(), quarter * 3 + 3, 0, 23, 59, 59);
            break;
          case 'year':
            periodStartDate = new Date(now.getFullYear(), 0, 1);
            periodEndDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            break;
          case 'lastMonth':
            periodStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            periodEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            break;
          case 'month':
          default:
            periodStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
            periodEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        }
      }

      // Get subscription info
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const subscription = await communitySubscriptionService.getSubscriptionWithTier(communityId);

      // Get usage events for the period
      const { usageTrackingService } = await import('./services/usageTrackingService');
      const events = await usageTrackingService.getEventsForPeriod(
        communityId,
        periodStartDate,
        periodEndDate
      );

      // Import credit costs for historical event calculation
      const { CREDIT_COSTS } = await import('../shared/subscriptionTypes');

      // Enrich events with additional info (user names, entity names)
      const enrichedActivities = await Promise.all(
        events.map(async (event) => {
          let userName = 'System';
          let entityName = '';

          // Get user name if available
          if (event.userId) {
            const user = await storage.getUser(event.userId);
            userName = user?.firstName && user?.lastName
              ? `${user.firstName} ${user.lastName}`
              : user?.email || 'Unknown User';
          }

          // Get entity name based on type
          if (event.entityType === 'application' && event.entityId) {
            const app = await storage.getApplication(event.entityId);
            entityName = app?.applicationNumber || event.entityId;
          } else if (event.entityType === 'ai_analysis' && event.entityId) {
            const analysis = await storage.getAiAnalysis(event.entityId);
            if (analysis) {
              const app = await storage.getApplication(analysis.applicationId);
              entityName = `Analysis for ${app?.applicationNumber || analysis.applicationId}`;
            }
          } else if (event.entityType === 'form_template' && event.entityId) {
            const form = await storage.getFormTemplate(event.entityId);
            entityName = form?.name || event.entityId;
          }

          // Determine description and expected credits based on event type
          let description = '';
          let expectedCredits = 0;
          const metadata = event.metadata as Record<string, any> || {};
          switch (event.eventType) {
            case 'ai_analysis':
              const analysisType = metadata.analysisType === 'full' ? 'Full' : 'Standard';
              description = `AI Analysis (${analysisType})`;
              expectedCredits = analysisType === 'Full' ? CREDIT_COSTS.FULL_ANALYSIS : CREDIT_COSTS.STANDARD_ANALYSIS;
              break;
            case 'application_submitted':
              description = 'Application Submitted';
              expectedCredits = 0; // Applications don't cost credits
              break;
            case 'form_created':
              description = 'AI Form Generated';
              expectedCredits = CREDIT_COSTS.AI_FORM_GENERATION;
              break;
            case 'document_uploaded':
              description = 'Document Uploaded';
              expectedCredits = 0; // Document uploads don't cost credits
              break;
            case 'user_added':
              description = 'User Added';
              expectedCredits = 0; // User additions don't cost credits
              break;
            default:
              description = event.eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              expectedCredits = 0;
          }

          // Use actual creditsUsed if recorded, otherwise use expected credits
          const creditsUsed = event.creditsUsed || expectedCredits;

          return {
            id: event.id,
            type: event.eventType,
            description,
            creditsUsed,
            isOverage: event.isOverage,
            cost: event.costAtTime,
            entityId: event.entityId,
            entityName,
            userId: event.userId,
            userName,
            createdAt: event.createdAt,
          };
        })
      );

      // Get invoices for this community
      const { invoiceService } = await import('./services/invoiceService');
      const invoices = await invoiceService.listInvoices(communityId, 12);

      const creditsIncluded = subscription?.effectiveCredits || 0;
      const creditsUsed = subscription?.creditsUsed || 0;
      const creditsRemaining = Math.max(0, creditsIncluded - creditsUsed);
      const isOverage = creditsUsed > creditsIncluded;
      const overageCost = isOverage ? (creditsUsed - creditsIncluded) * (subscription?.effectiveOverageCost || 2) : 0;

      res.json({
        community: {
          id: community.id,
          name: community.name,
          subscriptionTier: subscription?.tier?.name || 'None',
        },
        period: {
          start: periodStartDate.toISOString(),
          end: periodEndDate.toISOString(),
          type: period,
        },
        subscription: {
          creditsIncluded,
          creditsUsed,
          creditsRemaining,
          overageCost,
          effectivePrice: subscription?.effectivePrice || 0,
        },
        activities: enrichedActivities,
        invoices: invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          amount: inv.totalAmount,
          dueDate: inv.dueDate,
          createdAt: inv.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('Error getting billing detail:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate invoice for a specific community
  app.post('/api/account-admin/billing/:communityId/invoices/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const { communityId } = req.params;
      const { periodStart, periodEnd } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has access to this community
      const managedProperties = await storage.getManagedProperties(userId);
      const hasAccess = managedProperties.some(p => p.id === communityId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this community.' });
      }

      const { invoiceService } = await import('./services/invoiceService');

      const invoice = await invoiceService.generateMonthlyInvoice({
        billingEntityId: communityId,
        periodStart: periodStart ? new Date(periodStart) : new Date(new Date().setMonth(new Date().getMonth() - 1)),
        periodEnd: periodEnd ? new Date(periodEnd) : new Date(),
      });

      res.json(invoice);
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send invoice to community
  app.post('/api/account-admin/billing/:communityId/invoices/:invoiceId/send', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      const { communityId, invoiceId } = req.params;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Check if user has access to this community
      const managedProperties = await storage.getManagedProperties(userId);
      const hasAccess = managedProperties.some(p => p.id === communityId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this community.' });
      }

      const { invoiceService } = await import('./services/invoiceService');
      const { emailService } = await import('./emailService');

      // Get invoice
      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      // Get community info
      const community = await storage.getTenant(communityId);
      if (!community?.contactEmail) {
        return res.status(400).json({ error: 'Community has no contact email' });
      }

      // Send email (simplified - use existing send logic)
      const periodStart = new Date(invoice.billingPeriodStart).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const periodEnd = new Date(invoice.billingPeriodEnd).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });

      await emailService.send({
        to: community.contactEmail,
        subject: `Invoice ${invoice.invoiceNumber} - ${community.name}`,
        html: `
          <h2>Invoice ${invoice.invoiceNumber}</h2>
          <p>Billing Period: ${periodStart} - ${periodEnd}</p>
          <p>Amount Due: $${invoice.totalAmount.toFixed(2)}</p>
          <p>Please contact your management company for payment details.</p>
        `,
      }, {
        tenantId: communityId,
        templateId: 'invoiceCustom',
        templateParameters: { invoiceNumber: invoice.invoiceNumber, communityName: community.name, amount: `$${invoice.totalAmount.toFixed(2)}` },
        triggeredByUserId: userId,
      });

      // Mark invoice as sent
      const updatedInvoice = await invoiceService.markAsSent(invoiceId);

      res.json({ success: true, invoice: updatedInvoice });
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // STRIPE PAYMENT ENDPOINTS
  // ============================================

  // Get Stripe publishable key (for client-side)
  app.get('/api/billing/stripe-config', isAuthenticated, async (req: any, res) => {
    const { getStripePublishableKey, stripeService } = await import('./services/stripeService');
    res.json({
      publishableKey: getStripePublishableKey() || '',
      enabled: stripeService.isEnabled(),
      testMode: stripeService.isInTestMode(),
    });
  });

  // Create SetupIntent for adding a payment method
  app.post('/api/billing/setup-intent', isAuthenticated, async (req: any, res) => {
    try {
      const { stripeService } = await import('./services/stripeService');
      const { tenantId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      if (!stripeService.isEnabled()) {
        return res.status(503).json({ error: 'Stripe is not configured' });
      }

      const setupIntent = await stripeService.createSetupIntent(tenantId);
      res.json({ clientSecret: setupIntent.client_secret });
    } catch (error: any) {
      console.error('Error creating setup intent:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List payment methods for a tenant
  app.get('/api/billing/payment-methods/:tenantId', isAuthenticated, async (req: any, res) => {
    try {
      const { stripeService } = await import('./services/stripeService');
      const { tenantId } = req.params;

      const paymentMethods = await stripeService.listPaymentMethods(tenantId);

      // Map to a simpler format for the frontend
      const methods = paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
        } : null,
        bankAccount: pm.us_bank_account ? {
          bankName: pm.us_bank_account.bank_name,
          last4: pm.us_bank_account.last4,
          accountType: pm.us_bank_account.account_type,
        } : null,
        isDefault: false, // Will be set below
      }));

      // Get customer to check default payment method
      const customer = await stripeService.getCustomer(tenantId);
      if (customer?.invoice_settings?.default_payment_method) {
        const defaultId = customer.invoice_settings.default_payment_method;
        const defaultMethod = methods.find(m => m.id === defaultId);
        if (defaultMethod) {
          defaultMethod.isDefault = true;
        }
      }

      res.json(methods);
    } catch (error: any) {
      console.error('Error listing payment methods:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Set default payment method
  app.post('/api/billing/payment-methods/:tenantId/default', isAuthenticated, async (req: any, res) => {
    try {
      const { stripeService } = await import('./services/stripeService');
      const { tenantId } = req.params;
      const { paymentMethodId } = req.body;

      if (!paymentMethodId) {
        return res.status(400).json({ error: 'paymentMethodId is required' });
      }

      await stripeService.setDefaultPaymentMethod(tenantId, paymentMethodId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error setting default payment method:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove a payment method
  app.delete('/api/billing/payment-methods/:paymentMethodId', isAuthenticated, async (req: any, res) => {
    try {
      const { stripeService } = await import('./services/stripeService');
      const { paymentMethodId } = req.params;

      await stripeService.removePaymentMethod(paymentMethodId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing payment method:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get billing settings for a tenant
  app.get('/api/billing/settings/:tenantId', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;

      const [tenant] = await db
        .select({
          id: schema.tenants.id,
          name: schema.tenants.name,
          contactEmail: schema.tenants.contactEmail,
          autoPayEnabled: schema.tenants.autoPayEnabled,
          paymentTermsDays: schema.tenants.paymentTermsDays,
          billingStatus: schema.tenants.billingStatus,
          stripeCustomerId: schema.tenants.stripeCustomerId,
        })
        .from(schema.tenants)
        .where(eq(schema.tenants.id, tenantId))
        .limit(1);

      if (!tenant) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      res.json({
        ...tenant,
        hasStripeCustomer: !!tenant.stripeCustomerId,
      });
    } catch (error: any) {
      console.error('Error getting billing settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update billing settings
  app.patch('/api/billing/settings/:tenantId', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const { contactEmail, autoPayEnabled, paymentTermsDays, billingStatus } = req.body;

      const updateData: Record<string, any> = {};
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (autoPayEnabled !== undefined) updateData.autoPayEnabled = autoPayEnabled;
      if (paymentTermsDays !== undefined) updateData.paymentTermsDays = paymentTermsDays;

      // Only super_admin can change billing status
      if (billingStatus !== undefined) {
        const userId = req.session?.userId || req.user?.claims?.sub;
        const userRoles = await storage.getUserRoles(userId);
        const isSuperAdmin = userRoles.some(r => r.role === 'super_admin');

        if (!isSuperAdmin) {
          return res.status(403).json({ error: 'Only super admins can change billing status' });
        }

        if (!['active', 'delinquent', 'suspended'].includes(billingStatus)) {
          return res.status(400).json({ error: 'Invalid billing status' });
        }

        updateData.billingStatus = billingStatus;
        console.log(`[Billing] Super admin ${userId} updating tenant ${tenantId} billing status to: ${billingStatus}`);
      }

      await db
        .update(schema.tenants)
        .set(updateData)
        .where(eq(schema.tenants.id, tenantId));

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error updating billing settings:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe webhook handler
  app.post('/api/webhooks/stripe', async (req: any, res) => {
    try {
      const { stripeService } = await import('./services/stripeService');
      const signature = req.headers['stripe-signature'];

      if (!signature) {
        return res.status(400).json({ error: 'Missing stripe-signature header' });
      }

      let event;
      try {
        event = stripeService.constructWebhookEvent(req.rawBody, signature);
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      switch (event.type) {
        case 'invoice.paid':
          await stripeService.handleInvoicePaid(event.data.object as any);
          break;
        case 'invoice.payment_failed':
          await stripeService.handleInvoicePaymentFailed(event.data.object as any);
          break;
        case 'payment_method.attached':
          await stripeService.handlePaymentMethodAttached(event.data.object as any);
          break;
        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Address Validation (Radar.io)
  // ============================================

  // Autocomplete address as user types
  app.get('/api/address/autocomplete', isAuthenticated, async (req: any, res) => {
    try {
      const { radarService } = await import('./services/radarService');

      const { query, lat, lng, country } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const result = await radarService.autocomplete(query, {
        near: lat && lng ? { latitude: parseFloat(lat), longitude: parseFloat(lng) } : undefined,
        countryCode: country as string || 'US',
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error in address autocomplete:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Validate a complete address
  app.post('/api/address/validate', isAuthenticated, async (req: any, res) => {
    try {
      const { radarService } = await import('./services/radarService');

      const { address, latitude, longitude } = req.body;
      console.log('[Address Validate] Request body:', { address, latitude, longitude });

      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: 'Address is required' });
      }

      // If coordinates are provided (from autocomplete selection), use them directly
      // This avoids re-geocoding which could return a different result
      const coords = latitude && longitude ? { latitude, longitude } : undefined;
      console.log('[Address Validate] Using coordinates:', coords);

      const result = await radarService.validateAddress(address, coords);
      console.log('[Address Validate] Result:', result);
      res.json(result);
    } catch (error: any) {
      console.error('Error validating address:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check if Radar API is configured
  app.get('/api/address/status', isAuthenticated, async (req: any, res) => {
    try {
      const { radarService } = await import('./services/radarService');
      res.json({
        configured: radarService.isConfigured(),
        provider: 'radar.io'
      });
    } catch (error: any) {
      console.error('Error checking address service status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // HomeHub SSO Integration
  // ============================================

  // Generate SSO redirect URL for HomeHub
  app.get('/api/homehub/sso', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Fetch user from database to get email
      const user = await storage.getUser(userId);
      if (!user?.email) {
        return res.status(400).json({ error: 'User email is required for SSO' });
      }

      // Try to get postal code from user's tenant/community
      let postalCode: string | undefined;
      try {
        const userTenants = await storage.getUserTenants(userId);
        // Find first community tenant with a physical address
        for (const ut of userTenants) {
          const communitySettings = ut.tenant?.communitySettings as any;
          if (communitySettings?.physicalAddress?.zip) {
            postalCode = communitySettings.physicalAddress.zip;
            break;
          }
        }
      } catch (e) {
        // Postal code is optional, continue without it
      }

      const ssoSecret = process.env.HOMEHUB_SSO_SECRET;
      if (!ssoSecret) {
        return res.status(503).json({ error: 'HomeHub SSO is not configured' });
      }

      const crypto = await import('crypto');

      const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email.split('@')[0];

      const payload: Record<string, any> = {
        email: user.email,
        appId: "hoa_app",
        timestamp: Date.now(),
        nonce: crypto.randomUUID(),
        displayName
      };

      // Add postal code if available
      if (postalCode) {
        payload.postalCode = postalCode;
      }

      const signature = crypto
        .createHmac("sha256", ssoSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      const token = Buffer.from(JSON.stringify({ payload, signature }))
        .toString("base64url");

      const { getHomeHubUrl } = await import('./sync/client');
      const homeHubUrl = getHomeHubUrl();
      const redirectUrl = `${homeHubUrl}/sso-callback?token=${token}`;

      res.json({ redirectUrl });
    } catch (error: any) {
      console.error('Error generating HomeHub SSO URL:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check if HomeHub SSO is configured
  app.get('/api/homehub/status', isAuthenticated, async (req: any, res) => {
    try {
      const { getHomeHubUrl } = await import('./sync/client');
      const configured = !!process.env.HOMEHUB_SSO_SECRET;
      res.json({
        configured,
        homeHubUrl: getHomeHubUrl()
      });
    } catch (error: any) {
      console.error('Error checking HomeHub status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Inter-App Sync Protocol
  // ============================================

  // Import sync modules lazily to avoid circular dependencies
  const getSyncModules = async () => {
    const { verifyRequest, isSyncConfigured } = await import('./sync/protocol');
    const { syncFeatures, canReceive } = await import('./sync/registry');
    const { handleSyncAction } = await import('./sync/handlers');
    const { getPartnerUrl, getHomeHubUrl } = await import('./sync/client');
    return { verifyRequest, isSyncConfigured, syncFeatures, canReceive, handleSyncAction, getPartnerUrl, getHomeHubUrl };
  };

  // Public feature registry - allows partner apps to discover capabilities
  app.get('/api/sync/features', async (req, res) => {
    try {
      const { syncFeatures } = await getSyncModules();
      res.json(syncFeatures);
    } catch (error: any) {
      console.error('[Sync] Error fetching features:', error);
      res.status(500).json({ error: 'Failed to fetch sync features' });
    }
  });

  // Receive signed requests from partner apps
  app.post('/api/sync/receive', async (req, res) => {
    try {
      const { verifyRequest, canReceive, handleSyncAction } = await getSyncModules();

      const request = req.body;

      // Validate structure
      if (!request?.payload?.sourceApp || !request?.signature) {
        return res.status(400).json({ error: 'Invalid request format' });
      }

      // Only accept from known apps
      if (request.payload.sourceApp !== 'homehub') {
        return res.status(400).json({ error: 'Unknown source app' });
      }

      // Verify signature
      const verification = verifyRequest(request, request.payload.sourceApp);
      if (!verification.valid) {
        console.error('[Sync] Verification failed:', verification.error);
        return res.status(401).json({ error: verification.error });
      }

      // Check action is supported
      if (!canReceive(request.payload.action)) {
        return res.status(400).json({
          error: `Unsupported action: ${request.payload.action}`
        });
      }

      // Log inbound sync event
      try {
        await db.insert(schema.syncEvents).values({
          direction: 'inbound',
          partnerApp: request.payload.sourceApp,
          action: request.payload.action,
          payload: request.payload.data,
          correlationId: request.payload.nonce,
          status: 'pending',
        });
      } catch (logError) {
        console.error('[Sync] Failed to log sync event:', logError);
        // Continue processing even if logging fails
      }

      // Route to handler
      const result = await handleSyncAction(request.payload);

      // Update sync event status
      try {
        await db.update(schema.syncEvents)
          .set({
            status: 'success',
            response: result,
          })
          .where(eq(schema.syncEvents.correlationId, request.payload.nonce));
      } catch (updateError) {
        console.error('[Sync] Failed to update sync event:', updateError);
      }

      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[Sync] Handler error:', error);

      // Try to update sync event with error
      try {
        const request = req.body;
        if (request?.payload?.nonce) {
          await db.update(schema.syncEvents)
            .set({
              status: 'failed',
              errorMessage: error.message,
            })
            .where(eq(schema.syncEvents.correlationId, request.payload.nonce));
        }
      } catch (updateError) {
        console.error('[Sync] Failed to update sync event with error:', updateError);
      }

      res.status(500).json({ error: error.message });
    }
  });

  // Health check endpoint (signed) - verify connectivity between apps
  app.post('/api/sync/health', async (req, res) => {
    try {
      const { verifyRequest, syncFeatures } = await getSyncModules();

      const request = req.body;

      if (!request?.payload?.sourceApp) {
        return res.status(400).json({ error: 'Invalid request' });
      }

      const verification = verifyRequest(request, request.payload.sourceApp);
      if (!verification.valid) {
        return res.status(401).json({ error: verification.error });
      }

      res.json({
        healthy: true,
        app: 'poassociation',
        timestamp: Date.now(),
        features: Object.keys(syncFeatures.receives),
      });
    } catch (error: any) {
      console.error('[Sync] Health check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check sync configuration status (authenticated)
  app.get('/api/sync/status', isAuthenticated, async (req: any, res) => {
    try {
      const { isSyncConfigured, getPartnerUrl, getHomeHubUrl } = await getSyncModules();

      const appUrl = process.env.APP_URL || '';
      const isProduction = appUrl.includes('poassociation.com');

      res.json({
        homehub: {
          configured: isSyncConfigured('homehub'),
          resolvedUrl: getHomeHubUrl(),
        },
        environment: {
          APP_URL: appUrl || 'NOT SET',
          isProduction,
        },
      });
    } catch (error: any) {
      console.error('[Sync] Status check error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Claude-to-Claude Dev Instructions
  // ============================================

  // Get pending dev instructions (for Claude to check at session start)
  app.get('/api/sync/dev/instructions', async (req, res) => {
    try {
      const status = (req.query.status as string) || 'pending';

      const instructions = await db
        .select()
        .from(schema.devInstructions)
        .where(
          and(
            eq(schema.devInstructions.toApp, 'poassociation'),
            eq(schema.devInstructions.status, status)
          )
        )
        .orderBy(desc(schema.devInstructions.createdAt));

      res.json({
        count: instructions.length,
        instructions: instructions.map(i => ({
          id: i.id,
          from: i.fromApp,
          type: i.type,
          priority: i.priority,
          title: i.title,
          message: i.message,
          context: i.context,
          relatedAction: i.relatedAction,
          createdAt: i.createdAt,
        })),
      });
    } catch (error: any) {
      console.error('[Sync] Error fetching dev instructions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Send a dev instruction to HomeHub
  app.post('/api/sync/dev/instructions', async (req, res) => {
    try {
      const { type, priority, title, message, context, relatedAction } = req.body;

      if (!type || !title || !message) {
        return res.status(400).json({ error: 'type, title, and message are required' });
      }

      const { sendSyncRequest } = await import('./sync/client');

      // Store locally first
      const [instruction] = await db
        .insert(schema.devInstructions)
        .values({
          fromApp: 'poassociation',
          toApp: 'homehub',
          type,
          priority: priority || 'normal',
          title,
          message,
          context,
          relatedAction,
          status: 'pending',
        })
        .returning();

      // Send to HomeHub
      const result = await sendSyncRequest('homehub', 'dev.instruction', {
        type,
        priority: priority || 'normal',
        title,
        message,
        context,
        relatedAction,
      });

      // Update with remote instruction ID if successful
      if (result.success && result.data?.instructionId) {
        await db
          .update(schema.devInstructions)
          .set({ responseNotes: `Remote ID: ${result.data.instructionId}` })
          .where(eq(schema.devInstructions.id, instruction.id));
      }

      res.json({
        sent: result.success,
        localId: instruction.id,
        remoteId: result.data?.instructionId,
        error: result.error,
      });
    } catch (error: any) {
      console.error('[Sync] Error sending dev instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Acknowledge a dev instruction
  app.post('/api/sync/dev/instructions/:id/ack', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, responseNotes } = req.body;

      if (!status || !['acknowledged', 'implemented', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'status must be acknowledged, implemented, or rejected' });
      }

      // Get the instruction to find source app
      const [instruction] = await db
        .select()
        .from(schema.devInstructions)
        .where(eq(schema.devInstructions.id, id));

      if (!instruction) {
        return res.status(404).json({ error: 'Instruction not found' });
      }

      // Update locally
      await db
        .update(schema.devInstructions)
        .set({
          status,
          responseNotes,
          ...(status === 'acknowledged'
            ? { acknowledgedAt: new Date() }
            : { implementedAt: new Date() }),
        })
        .where(eq(schema.devInstructions.id, id));

      // Notify the source app
      const { sendSyncRequest } = await import('./sync/client');
      await sendSyncRequest(instruction.fromApp, 'dev.instruction.ack', {
        instructionId: id,
        status,
        responseNotes,
      });

      res.json({ updated: true });
    } catch (error: any) {
      console.error('[Sync] Error acknowledging dev instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // CO-APPLICANT SYSTEM ENDPOINTS
  // ============================================

  // Generate a secure invitation token
  const generateInvitationToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  };

  // ------------------------------------------
  // INVITATIONS
  // ------------------------------------------

  // Get invitation by token (public - for invitation accept page)
  app.get('/api/invitations/:token', async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Check if expired
      if (new Date() > invitation.expiresAt) {
        await storage.updateInvitationStatus(invitation.id, 'expired');
        return res.status(410).json({ error: 'Invitation has expired' });
      }

      if (invitation.status !== 'pending') {
        return res.status(410).json({ error: `Invitation is ${invitation.status}` });
      }

      // Get additional context based on invitation type
      let context: any = {};
      if (invitation.type === 'household_member' && invitation.tenantId) {
        const tenant = await storage.getTenant(invitation.tenantId);
        const inviter = await storage.getUser(invitation.invitedByUserId);
        context = {
          communityName: tenant?.name,
          inviterName: inviter ? `${inviter.firstName} ${inviter.lastName}`.trim() : 'A household member',
        };
      } else if (invitation.type === 'contractor_application' && invitation.applicationId) {
        const application = await storage.getApplication(invitation.applicationId);
        if (application) {
          const tenant = await storage.getTenant(application.tenantId);
          context = {
            applicationTitle: application.title,
            communityName: tenant?.name,
          };
        }
      }

      res.json({
        id: invitation.id,
        type: invitation.type,
        inviteeEmail: invitation.inviteeEmail,
        inviteeName: invitation.inviteeName,
        expiresAt: invitation.expiresAt,
        ...context,
      });
    } catch (error: any) {
      console.error('Error getting invitation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Accept invitation
  app.post('/api/invitations/:token/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const invitation = await storage.getInvitationByToken(token);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (new Date() > invitation.expiresAt) {
        await storage.updateInvitationStatus(invitation.id, 'expired');
        return res.status(410).json({ error: 'Invitation has expired' });
      }

      if (invitation.status !== 'pending') {
        return res.status(410).json({ error: `Invitation is ${invitation.status}` });
      }

      // Process based on invitation type
      if (invitation.type === 'household_member' && invitation.householdMemberId) {
        // Accept household member invitation
        await storage.acceptHouseholdInvitation(invitation.householdMemberId, userId);

        // Also add homeowner role to the tenant if not already present
        if (invitation.tenantId) {
          const existingRoles = await storage.getUserRolesForTenant(userId, invitation.tenantId);
          if (!existingRoles.some(r => r.role === 'homeowner')) {
            await storage.assignUserRole({
              userId,
              tenantId: invitation.tenantId,
              role: 'homeowner',
            });
          }

          // Send notification to primary homeowner
          const householdMember = await storage.getHouseholdMember(invitation.householdMemberId);
          if (householdMember?.primaryUserId) {
            const primaryUser = await storage.getUser(householdMember.primaryUserId);
            const newMember = await storage.getUser(userId);
            const tenant = await storage.getTenant(invitation.tenantId);

            if (primaryUser?.email && newMember && tenant) {
              const { emailService } = await import('./emailService');
              const dashboardLink = `${process.env.APP_URL || ''}/settings/household`;
              await emailService.sendHouseholdMemberJoined(
                primaryUser.email,
                primaryUser.displayName || 'Homeowner',
                newMember.displayName || newMember.email || 'Family member',
                newMember.email || '',
                tenant.name,
                dashboardLink,
                {
                  tenantId: invitation.tenantId,
                  templateId: 'householdMemberJoined',
                  templateParameters: { recipientName: primaryUser.displayName || 'Homeowner', memberName: newMember.displayName || newMember.email || 'Family member', memberEmail: newMember.email || '', communityName: tenant.name, dashboardLink },
                  triggeredByUserId: userId,
                }
              );
            }
          }
        }
      } else if (invitation.type === 'contractor_application' && invitation.applicationCollaboratorId) {
        // Accept contractor collaboration invitation
        await storage.updateApplicationCollaboratorStatus(
          invitation.applicationCollaboratorId,
          'active',
          new Date()
        );

        // Create contractor profile if not exists
        let contractor = await storage.getContractorByUserId(userId);
        if (!contractor) {
          // Get the application to determine initial expertise area
          let initialExpertise: string[] = [];
          if (invitation.applicationId) {
            const app = await storage.getApplication(invitation.applicationId);
            if (app?.projectType) {
              // Map application project type to contractor expertise areas
              const projectTypeToExpertise: Record<string, string> = {
                'exterior-modifications': 'exterior_modifications',
                'structural-changes': 'structural_changes',
                'landscaping': 'landscaping',
                'fencing': 'fencing',
                'outdoor-structures': 'outdoor_structures',
                'signage': 'signage',
              };
              const expertise = projectTypeToExpertise[app.projectType];
              if (expertise) {
                initialExpertise = [expertise];
              }
            }
          }

          contractor = await storage.createContractor({
            userId,
            isPubliclySearchable: true,
            areasOfExpertise: initialExpertise,
          });
        }

        // Send notification to homeowner who invited
        if (invitation.applicationId) {
          const application = await storage.getApplication(invitation.applicationId);
          if (application?.submittedByUserId) {
            const homeowner = await storage.getUser(application.submittedByUserId);
            const contractorUser = await storage.getUser(userId);
            const tenant = await storage.getTenant(application.tenantId);

            if (homeowner?.email && contractorUser && tenant) {
              const { emailService } = await import('./emailService');
              const applicationLink = `${process.env.APP_URL || ''}/applications/${application.id}`;
              await emailService.sendContractorInviteAccepted(
                homeowner.email,
                homeowner.displayName || 'Homeowner',
                contractorUser.displayName || contractorUser.email || 'Contractor',
                contractor?.companyName || undefined,
                application.title || 'Architectural Application',
                tenant.name,
                applicationLink,
                {
                  tenantId: application.tenantId,
                  applicationId: application.id,
                  templateId: 'contractorInviteAccepted',
                  templateParameters: { recipientName: homeowner.displayName || 'Homeowner', contractorName: contractorUser.displayName || contractorUser.email || 'Contractor', contractorCompany: contractor?.companyName || '', applicationTitle: application.title || 'Architectural Application', communityName: tenant.name, applicationLink },
                  triggeredByUserId: userId,
                }
              );
            }
          }
        }
      }

      // Mark invitation as accepted
      await storage.updateInvitationStatus(invitation.id, 'accepted', new Date());

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Decline invitation
  app.post('/api/invitations/:token/decline', async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      if (invitation.status !== 'pending') {
        return res.status(410).json({ error: `Invitation is ${invitation.status}` });
      }

      // Update related entities
      if (invitation.type === 'household_member' && invitation.householdMemberId) {
        await storage.updateHouseholdMemberStatus(invitation.householdMemberId, 'removed');
      } else if (invitation.type === 'contractor_application' && invitation.applicationCollaboratorId) {
        await storage.updateApplicationCollaboratorStatus(invitation.applicationCollaboratorId, 'removed', undefined, new Date());
      }

      await storage.updateInvitationStatus(invitation.id, 'declined', undefined, new Date());

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error declining invitation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resend invitation
  app.post('/api/invitations/:id/resend', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const invitation = await storage.getInvitation(id);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Only the inviter can resend
      if (invitation.invitedByUserId !== userId) {
        return res.status(403).json({ error: 'Only the original inviter can resend' });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: 'Can only resend pending invitations' });
      }

      // Update resend count
      const updated = await storage.resendInvitation(id);

      // TODO: Send email notification

      res.json(updated);
    } catch (error: any) {
      console.error('Error resending invitation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Revoke invitation
  app.delete('/api/invitations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const invitation = await storage.getInvitation(id);

      if (!invitation) {
        return res.status(404).json({ error: 'Invitation not found' });
      }

      // Only the inviter can revoke
      if (invitation.invitedByUserId !== userId) {
        return res.status(403).json({ error: 'Only the original inviter can revoke' });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: 'Can only revoke pending invitations' });
      }

      await storage.revokeInvitation(id);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------
  // HOUSEHOLD MEMBERS
  // ------------------------------------------

  // List household members for current user in a tenant
  app.get('/api/households/:tenantId/members', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const members = await storage.getHouseholdMembersForPrimaryUser(userId, tenantId);

      res.json(members);
    } catch (error: any) {
      console.error('Error listing household members:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Invite household member
  app.post('/api/households/:tenantId/members', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { email, name, relationship } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Check if user has homeowner role in this tenant
      const roles = await storage.getUserRolesForTenant(userId, tenantId);
      if (!roles.some(r => r.role === 'homeowner')) {
        return res.status(403).json({ error: 'Only homeowners can invite household members' });
      }

      // Create household member record
      const householdMember = await storage.createHouseholdMember({
        primaryUserId: userId,
        tenantId,
        relationship,
        status: 'pending',
      });

      // Generate invitation token
      const token = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Create invitation
      const invitation = await storage.createInvitation({
        token,
        type: 'household_member',
        invitedByUserId: userId,
        inviteeEmail: email.toLowerCase(),
        inviteeName: name,
        tenantId,
        householdMemberId: householdMember.id,
        status: 'pending',
        expiresAt,
      });

      // Send email invitation
      const inviteUrl = `${process.env.APP_URL || ''}/invite/${invitation.token}`;
      const inviter = await storage.getUser(userId);
      const tenant = await storage.getTenant(tenantId);

      if (inviter && tenant) {
        const { emailService } = await import('./emailService');
        await emailService.sendHouseholdMemberInvite(
          email.toLowerCase(),
          name || 'there',
          inviter.displayName || inviter.email || 'A homeowner',
          tenant.name,
          relationship || 'family member',
          inviteUrl,
          {
            tenantId,
            templateId: 'householdMemberInvite',
            templateParameters: { recipientName: name || 'there', inviterName: inviter.displayName || inviter.email || 'A homeowner', communityName: tenant.name, relationship: relationship || 'family member', inviteLink: inviteUrl },
            triggeredByUserId: userId,
          }
        );
      }

      res.status(201).json({
        householdMember,
        invitation: {
          id: invitation.id,
          token: invitation.token,
          inviteUrl: `${process.env.APP_URL || ''}/invite/${invitation.token}`,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Error inviting household member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove household member (by primary user)
  app.delete('/api/households/:tenantId/members/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const member = await storage.getHouseholdMember(id);

      if (!member) {
        return res.status(404).json({ error: 'Household member not found' });
      }

      // Only primary user can remove members
      if (member.primaryUserId !== userId) {
        return res.status(403).json({ error: 'Only the primary household member can remove others' });
      }

      await storage.updateHouseholdMemberStatus(id, 'removed', userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing household member:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Leave household (by member themselves)
  app.post('/api/households/:tenantId/members/:id/leave', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const member = await storage.getHouseholdMember(id);

      if (!member) {
        return res.status(404).json({ error: 'Household member not found' });
      }

      // Only the member themselves can leave
      if (member.memberUserId !== userId) {
        return res.status(403).json({ error: 'You can only leave a household you are a member of' });
      }

      await storage.updateHouseholdMemberStatus(id, 'left', userId);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error leaving household:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get my household memberships (households I've been invited to)
  app.get('/api/households/my-memberships', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;

      const memberships = await storage.getHouseholdMembershipsForUser(userId);

      res.json(memberships);
    } catch (error: any) {
      console.error('Error getting household memberships:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------
  // CONTRACTORS
  // ------------------------------------------

  // Get my contractor profile
  app.get('/api/contractors/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;

      const contractor = await storage.getContractorByUserId(userId);

      if (!contractor) {
        return res.status(404).json({ error: 'No contractor profile found' });
      }

      // Get user info
      const user = await storage.getUser(userId);

      res.json({ ...contractor, user });
    } catch (error: any) {
      console.error('Error getting contractor profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create contractor profile
  app.post('/api/contractors', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;

      // Check if already exists
      const existing = await storage.getContractorByUserId(userId);
      if (existing) {
        return res.status(400).json({ error: 'Contractor profile already exists' });
      }

      const {
        companyName,
        businessType,
        areasOfExpertise,
        licenseNumber,
        businessPhone,
        businessEmail,
        website,
        serviceArea,
        isPubliclySearchable = true,
      } = req.body;

      const contractor = await storage.createContractor({
        userId,
        companyName,
        businessType,
        areasOfExpertise: areasOfExpertise || [],
        licenseNumber,
        businessPhone,
        businessEmail,
        website,
        serviceArea,
        isPubliclySearchable,
      });

      res.status(201).json(contractor);
    } catch (error: any) {
      console.error('Error creating contractor profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update contractor profile
  app.patch('/api/contractors/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const contractor = await storage.getContractor(id);

      if (!contractor) {
        return res.status(404).json({ error: 'Contractor not found' });
      }

      // Only the contractor can update their own profile
      if (contractor.userId !== userId) {
        return res.status(403).json({ error: 'Can only update your own contractor profile' });
      }

      const {
        companyName,
        businessType,
        areasOfExpertise,
        licenseNumber,
        businessPhone,
        businessEmail,
        website,
        serviceArea,
        isPubliclySearchable,
      } = req.body;

      const updated = await storage.updateContractor(id, {
        companyName,
        businessType,
        areasOfExpertise,
        licenseNumber,
        businessPhone,
        businessEmail,
        website,
        serviceArea,
        isPubliclySearchable,
      });

      res.json(updated);
    } catch (error: any) {
      console.error('Error updating contractor profile:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Search contractors (for homeowners to find contractors)
  app.get('/api/contractors/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q, limit = 20 } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const contractors = await storage.searchContractors(q, parseInt(limit as string));

      res.json(contractors);
    } catch (error: any) {
      console.error('Error searching contractors:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate or customize referral code
  app.post('/api/contractors/:id/referral-code', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { customCode } = req.body;

      const contractor = await storage.getContractor(id);

      if (!contractor) {
        return res.status(404).json({ error: 'Contractor not found' });
      }

      if (contractor.userId !== userId) {
        return res.status(403).json({ error: 'Can only manage your own referral code' });
      }

      const code = await storage.generateReferralCode(id, customCode);
      const referralUrl = `${process.env.APP_URL || ''}/r/${code}`;
      const dashboardLink = `${process.env.APP_URL || ''}/contractor/referrals`;

      // Send referral link email to contractor
      const contractorUser = await storage.getUser(contractor.userId);
      if (contractorUser?.email) {
        const { emailService } = await import('./emailService');
        await emailService.sendContractorReferralLink(
          contractorUser.email,
          contractorUser.displayName || 'Contractor',
          code,
          referralUrl,
          dashboardLink,
          {
            templateId: 'contractorReferral',
            templateParameters: { recipientName: contractorUser.displayName || 'Contractor', referralCode: code, referralLink: referralUrl, dashboardLink },
            triggeredByUserId: userId,
          }
        );
      }

      res.json({ referralCode: code, referralUrl });
    } catch (error: any) {
      console.error('Error generating referral code:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get contractor dashboard (cross-tenant applications)
  app.get('/api/contractors/:id/dashboard', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const contractor = await storage.getContractor(id);

      if (!contractor) {
        return res.status(404).json({ error: 'Contractor not found' });
      }

      if (contractor.userId !== userId) {
        return res.status(403).json({ error: 'Can only view your own dashboard' });
      }

      const dashboard = await storage.getContractorDashboard(id);

      res.json(dashboard);
    } catch (error: any) {
      console.error('Error getting contractor dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get contractor referrals
  app.get('/api/contractors/:id/referrals', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const contractor = await storage.getContractor(id);

      if (!contractor) {
        return res.status(404).json({ error: 'Contractor not found' });
      }

      if (contractor.userId !== userId) {
        return res.status(403).json({ error: 'Can only view your own referrals' });
      }

      const referrals = await storage.getContractorReferrals(id);
      const stats = await storage.getReferralStats(id);

      res.json({ referrals, stats });
    } catch (error: any) {
      console.error('Error getting contractor referrals:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------
  // APPLICATION COLLABORATORS
  // ------------------------------------------

  // Get collaborators on an application
  app.get('/api/applications/:id/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const application = await storage.getApplication(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Check access - owner, household member, or management
      const canAccess = application.submittedByUserId === userId ||
        await storage.isHouseholdMemberOf(userId, application.submittedByUserId!, application.tenantId);

      // Also check role-based access
      if (!canAccess) {
        const { role } = await storage.getUserEffectiveRole(userId, application.tenantId);
        if (!role || !['management_rep', 'management_manager', 'account_admin', 'super_admin', 'poa_board_member'].includes(role)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      const collaborators = await storage.getApplicationCollaborators(id);

      res.json(collaborators);
    } catch (error: any) {
      console.error('Error getting collaborators:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Invite contractor to application
  app.post('/api/applications/:id/collaborators', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { email, contractorId, name } = req.body;

      const application = await storage.getApplication(id);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Only owner or household member can invite
      const canInvite = application.submittedByUserId === userId ||
        await storage.isHouseholdMemberOf(userId, application.submittedByUserId!, application.tenantId);

      if (!canInvite) {
        return res.status(403).json({ error: 'Only the application owner or household member can invite contractors' });
      }

      let contractor;

      if (contractorId) {
        // Existing contractor
        contractor = await storage.getContractor(contractorId);
        if (!contractor) {
          return res.status(404).json({ error: 'Contractor not found' });
        }
      } else if (email) {
        // New contractor via email
        // Check if user exists with this email
        const existingUser = await storage.getUserByEmail(email.toLowerCase());
        if (existingUser) {
          contractor = await storage.getContractorByUserId(existingUser.id);
          if (!contractor) {
            // Create contractor profile for existing user
            contractor = await storage.createContractor({
              userId: existingUser.id,
              isPubliclySearchable: true,
            });
          }
        }
      } else {
        return res.status(400).json({ error: 'Either email or contractorId is required' });
      }

      // Only create collaborator record if we have a contractor
      // For email-only invites, the collaborator is created when they accept
      let collaborator;
      if (contractor) {
        collaborator = await storage.createApplicationCollaborator({
          applicationId: id,
          contractorId: contractor.id,
          invitedByUserId: userId,
          status: 'pending',
          canEditForm: true,
          canUploadDocuments: true,
        });
      }

      // Generate invitation token
      const token = generateInvitationToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14); // 14 days for contractors

      // Create invitation
      const invitation = await storage.createInvitation({
        token,
        type: 'contractor_application',
        invitedByUserId: userId,
        inviteeEmail: email?.toLowerCase() || '',
        inviteeName: name,
        applicationId: id,
        applicationCollaboratorId: collaborator?.id,
        status: 'pending',
        expiresAt,
      });

      // Send email invitation
      const inviteUrl = `${process.env.APP_URL || ''}/invite/${invitation.token}`;
      if (email) {
        const inviter = await storage.getUser(userId);
        const tenant = await storage.getTenant(application.tenantId);

        if (inviter && tenant) {
          const { emailService } = await import('./emailService');
          await emailService.sendContractorInvite(
            email.toLowerCase(),
            name || 'Contractor',
            inviter.displayName || inviter.email || 'A homeowner',
            application.title || 'Architectural Application',
            tenant.name,
            inviteUrl,
            application.description || undefined,
            {
              tenantId: application.tenantId,
              applicationId: id,
              templateId: 'contractorInvite',
              templateParameters: { recipientName: name || 'Contractor', inviterName: inviter.displayName || inviter.email || 'A homeowner', applicationTitle: application.title || 'Architectural Application', communityName: tenant.name, inviteLink: inviteUrl, projectDescription: application.description || '' },
              triggeredByUserId: userId,
            }
          );
        }
      }

      res.status(201).json({
        collaborator,
        invitation: {
          id: invitation.id,
          token: invitation.token,
          inviteUrl,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Error inviting contractor:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove contractor from application
  app.delete('/api/applications/:applicationId/collaborators/:collaboratorId', isAuthenticated, async (req: any, res) => {
    try {
      const { applicationId, collaboratorId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // Only owner can remove
      if (application.submittedByUserId !== userId) {
        const isHouseholdMember = await storage.isHouseholdMemberOf(userId, application.submittedByUserId!, application.tenantId);
        if (!isHouseholdMember) {
          return res.status(403).json({ error: 'Only the application owner can remove contractors' });
        }
      }

      await storage.updateApplicationCollaboratorStatus(collaboratorId, 'removed', undefined, new Date());

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing contractor:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ------------------------------------------
  // REFERRAL LANDING
  // ------------------------------------------

  // Get referral info (public)
  app.get('/api/r/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const contractor = await storage.getContractorByReferralCode(code.toUpperCase());

      if (!contractor) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      // Get contractor's user info
      const user = await storage.getUser(contractor.userId);

      res.json({
        referralCode: contractor.referralCode,
        companyName: contractor.companyName,
        contractorName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
      });
    } catch (error: any) {
      console.error('Error getting referral info:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Track referral when POA signs up (called during POA signup flow)
  app.post('/api/r/:code/track', async (req, res) => {
    try {
      const { code } = req.params;
      const { tenantId } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      const contractor = await storage.getContractorByReferralCode(code.toUpperCase());

      if (!contractor) {
        return res.status(404).json({ error: 'Invalid referral code' });
      }

      // Create referral record
      const referral = await storage.createContractorReferral({
        contractorId: contractor.id,
        tenantId,
        referralCode: code.toUpperCase(),
        status: 'pending',
      });

      // Send notification to contractor
      const contractorUser = await storage.getUser(contractor.userId);
      const tenant = await storage.getTenant(tenantId);

      if (contractorUser?.email && tenant) {
        const { emailService } = await import('./emailService');
        const dashboardLink = `${process.env.APP_URL || ''}/contractor/referrals`;
        await emailService.sendContractorReferralSignup(
          contractorUser.email,
          contractorUser.displayName || 'Contractor',
          tenant.name,
          code.toUpperCase(),
          dashboardLink,
          {
            tenantId,
            templateId: 'contractorReferralSignup',
            templateParameters: { recipientName: contractorUser.displayName || 'Contractor', communityName: tenant.name, referralCode: code.toUpperCase(), dashboardLink },
          }
        );
      }

      res.json(referral);
    } catch (error: any) {
      console.error('Error tracking referral:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TOUR PROGRESS ENDPOINTS
  // ============================================

  // Get all tour progress for the current user
  app.get('/api/tour/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const progress = await storage.getUserTourProgressList(userId);
      res.json(progress);
    } catch (error: any) {
      console.error('Error getting tour progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check if a specific tour has been completed
  app.get('/api/tour/progress/:pageKey/:role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { pageKey, role } = req.params;
      const progress = await storage.getTourProgress(userId, pageKey, role);

      res.json({
        completed: !!progress,
        completedAt: progress?.completedAt || null,
      });
    } catch (error: any) {
      console.error('Error checking tour progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Mark a tour as completed
  app.post('/api/tour/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { pageKey, role, demoCodeId } = req.body;

      if (!pageKey || !role) {
        return res.status(400).json({ error: 'pageKey and role are required' });
      }

      // Check if already completed
      const existing = await storage.getTourProgress(userId, pageKey, role);
      if (existing) {
        return res.json({ success: true, alreadyCompleted: true, progress: existing });
      }

      const progress = await storage.markTourCompleted({
        userId,
        pageKey,
        role,
        demoCodeId,
      });

      res.json({ success: true, progress });
    } catch (error: any) {
      console.error('Error marking tour complete:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset tour progress (for testing/development)
  app.delete('/api/tour/progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { pageKey, role } = req.query;

      await storage.resetTourProgress(
        userId,
        pageKey as string | undefined,
        role as string | undefined
      );

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error resetting tour progress:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Public endpoint for TourProvider to get active tours with customizations
  app.get('/api/tour/content', isAuthenticated, async (req: any, res) => {
    try {
      // Get all overrides from database
      const overrides = await storage.listTourContentOverrides();
      res.json(overrides);
    } catch (error: any) {
      console.error('Error getting tour content:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // TOUR CONTENT ADMIN ENDPOINTS (Super Admin)
  // ============================================

  // List all tours (merged defaults + overrides) - for admin page
  app.get('/api/admin/tours', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const overrides = await storage.listTourContentOverrides();
      res.json({ overrides });
    } catch (error: any) {
      console.error('Error listing tours:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update/create tour override
  app.put('/api/admin/tours/:pageKey/:role', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { pageKey, role } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { pageTitle, isEnabled, steps } = req.body;

      if (!pageTitle || !steps || !Array.isArray(steps)) {
        return res.status(400).json({ error: 'pageTitle and steps are required' });
      }

      // Validate steps structure
      for (const step of steps) {
        if (!step.title || !step.description || !step.iconName) {
          return res.status(400).json({ error: 'Each step must have title, description, and iconName' });
        }
      }

      const override = await storage.upsertTourContentOverride({
        pageKey,
        role,
        pageTitle,
        isEnabled: isEnabled ?? true,
        steps,
        updatedByUserId: userId,
      });

      res.json(override);
    } catch (error: any) {
      console.error('Error updating tour:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset tour to default (delete override)
  app.delete('/api/admin/tours/:pageKey/:role', isAuthenticated, requireSuperAdmin, async (req: any, res) => {
    try {
      const { pageKey, role } = req.params;

      await storage.deleteTourContentOverride(pageKey, role);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error resetting tour:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // AI Context Sources
  // ============================================

  // List AI context sources for a tenant
  app.get('/api/tenants/:tenantId/ai-context-sources', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const includeInactive = req.query.includeInactive === 'true';

      const sources = await storage.listAiContextSources(tenantId, includeInactive);
      res.json(sources);
    } catch (error: any) {
      console.error('Error listing AI context sources:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single AI context source
  app.get('/api/tenants/:tenantId/ai-context-sources/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const source = await storage.getAiContextSource(id);
      if (!source) {
        return res.status(404).json({ error: 'AI context source not found' });
      }

      res.json(source);
    } catch (error: any) {
      console.error('Error getting AI context source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a URL-based AI context source
  app.post('/api/tenants/:tenantId/ai-context-sources', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { name, description, sourceUrl, priority, appliesToAllForms, appliesToFormTypes } = req.body;

      if (!name || !sourceUrl) {
        return res.status(400).json({ error: 'Name and sourceUrl are required' });
      }

      const source = await storage.createAiContextSource({
        tenantId,
        name,
        description,
        sourceType: 'url',
        sourceUrl,
        priority: priority || 100,
        appliesToAllForms: appliesToAllForms !== false,
        appliesToFormTypes: appliesToFormTypes || null,
        createdByUserId: userId,
      });

      res.json(source);
    } catch (error: any) {
      console.error('Error creating AI context source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload a document as AI context source
  app.post('/api/tenants/:tenantId/ai-context-sources/upload', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { name, description, priority, appliesToAllForms, appliesToFormTypes } = req.body;

      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Check if Azure Blob Storage is available
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({ error: 'File storage is not configured' });
      }

      // Generate unique blob path
      const fileExt = file.originalname.split('.').pop() || 'pdf';
      const blobPath = `${tenantId}/ai-context/${crypto.randomUUID()}.${fileExt}`;
      const containerName = 'ai-context-documents';

      // Upload to Azure Blob Storage
      await azureBlobStorage.uploadFile(
        containerName,
        file.buffer,
        file.originalname,
        file.mimetype,
        blobPath
      );

      // Create database record
      const source = await storage.createAiContextSource({
        tenantId,
        name,
        description,
        sourceType: 'uploaded_document',
        blobPath,
        containerName,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        priority: priority ? parseInt(priority) : 100,
        appliesToAllForms: appliesToAllForms !== 'false',
        appliesToFormTypes: appliesToFormTypes ? JSON.parse(appliesToFormTypes) : null,
        createdByUserId: userId,
      });

      res.json(source);
    } catch (error: any) {
      console.error('Error uploading AI context document:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update an AI context source
  app.patch('/api/tenants/:tenantId/ai-context-sources/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description, sourceUrl, priority, appliesToAllForms, appliesToFormTypes } = req.body;

      const updates: any = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (sourceUrl !== undefined) updates.sourceUrl = sourceUrl;
      if (priority !== undefined) updates.priority = priority;
      if (appliesToAllForms !== undefined) updates.appliesToAllForms = appliesToAllForms;
      if (appliesToFormTypes !== undefined) updates.appliesToFormTypes = appliesToFormTypes;

      const source = await storage.updateAiContextSource(id, updates);
      res.json(source);
    } catch (error: any) {
      console.error('Error updating AI context source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete an AI context source
  app.delete('/api/tenants/:tenantId/ai-context-sources/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Get source to check if we need to delete from blob storage
      const source = await storage.getAiContextSource(id);
      if (source && source.sourceType === 'uploaded_document' && source.blobPath && source.containerName) {
        try {
          await azureBlobStorage.deleteFile(source.containerName, source.blobPath);
        } catch (blobError) {
          console.warn('Failed to delete blob:', blobError);
          // Continue with database deletion even if blob deletion fails
        }
      }

      await storage.deleteAiContextSource(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting AI context source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle an AI context source active/inactive
  app.post('/api/tenants/:tenantId/ai-context-sources/:id/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      const source = await storage.toggleAiContextSource(id, isActive);
      res.json(source);
    } catch (error: any) {
      console.error('Error toggling AI context source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder AI context sources
  app.post('/api/tenants/:tenantId/ai-context-sources/reorder', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: 'orderedIds must be an array' });
      }

      await storage.reorderAiContextSources(tenantId, orderedIds);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error reordering AI context sources:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // View/download an AI context source document (inline viewing)
  app.get('/api/tenants/:tenantId/ai-context-sources/:id/view', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;

      const source = await storage.getAiContextSource(id);
      if (!source) {
        return res.status(404).json({ error: 'AI context source not found' });
      }

      // Tenant isolation check
      if (source.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (source.sourceType === 'url' && source.sourceUrl) {
        // For URL sources, redirect to the original URL
        return res.redirect(source.sourceUrl);
      }

      if (source.sourceType === 'uploaded_document' && source.blobPath && source.containerName) {
        if (!azureBlobStorage.isAvailable()) {
          return res.status(503).json({ error: 'Storage not configured' });
        }

        const buffer = await azureBlobStorage.downloadFile(source.containerName, source.blobPath);
        const mimeType = source.mimeType || 'application/octet-stream';

        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${source.fileName || 'document'}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        return res.send(buffer);
      }

      return res.status(400).json({ error: 'Source has no viewable content' });
    } catch (error: any) {
      console.error('Error viewing AI context source:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // AI Instructions
  // ============================================

  // List AI instructions for a tenant
  app.get('/api/tenants/:tenantId/ai-instructions', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const { scope, formType } = req.query;

      const instructions = await storage.listAiInstructions(
        tenantId,
        scope as string | undefined,
        formType as string | undefined
      );
      res.json(instructions);
    } catch (error: any) {
      console.error('Error listing AI instructions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single AI instruction
  app.get('/api/tenants/:tenantId/ai-instructions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const instruction = await storage.getAiInstruction(id);
      if (!instruction) {
        return res.status(404).json({ error: 'AI instruction not found' });
      }

      res.json(instruction);
    } catch (error: any) {
      console.error('Error getting AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create an AI instruction
  app.post('/api/tenants/:tenantId/ai-instructions', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;
      const { scope, formType, title, instructions } = req.body;

      if (!scope || !title || !instructions) {
        return res.status(400).json({ error: 'scope, title, and instructions are required' });
      }

      if (scope !== 'community' && scope !== 'form_type') {
        return res.status(400).json({ error: 'scope must be "community" or "form_type"' });
      }

      if (scope === 'form_type' && !formType) {
        return res.status(400).json({ error: 'formType is required when scope is "form_type"' });
      }

      const instruction = await storage.createAiInstruction({
        tenantId,
        scope,
        formType: scope === 'form_type' ? formType : null,
        title,
        instructions,
        createdByUserId: userId,
      });

      res.json(instruction);
    } catch (error: any) {
      console.error('Error creating AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update an AI instruction
  app.patch('/api/tenants/:tenantId/ai-instructions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, instructions, formType } = req.body;

      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (instructions !== undefined) updates.instructions = instructions;
      if (formType !== undefined) updates.formType = formType;

      const instruction = await storage.updateAiInstruction(id, updates);
      res.json(instruction);
    } catch (error: any) {
      console.error('Error updating AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete an AI instruction
  app.delete('/api/tenants/:tenantId/ai-instructions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      await storage.deleteAiInstruction(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle an AI instruction active/inactive
  app.post('/api/tenants/:tenantId/ai-instructions/:id/toggle', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean' });
      }

      const instruction = await storage.toggleAiInstruction(id, isActive);
      res.json(instruction);
    } catch (error: any) {
      console.error('Error toggling AI instruction:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Google Maps Configuration
  // ============================================

  // Get Google Maps API key (for client-side map rendering)
  app.get('/api/maps/config', isAuthenticated, async (req: any, res) => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
    res.json({
      apiKey,
      enabled: !!apiKey,
    });
  });

  // ============================================
  // Community Residences (Neighborhood Archive)
  // ============================================

  // Batch-fetch linked applications for map detail view
  app.get('/api/tenants/:tenantId/residence-map-details', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.status(400).json({ error: 'ids query parameter is required' });
      }
      const ids = idsParam.split(',').slice(0, 50); // Max 50 IDs
      const result: Record<string, { linkedApplications: any[] }> = {};

      await Promise.all(ids.map(async (id) => {
        const residence = await storage.getCommunityResidence(id.trim());
        if (residence && residence.tenantId === tenantId) {
          const linkedApplications = await storage.getLinkedApplications(
            tenantId,
            residence.normalizedAddress
          );
          result[id.trim()] = { linkedApplications };
        }
      }));

      res.json(result);
    } catch (error: any) {
      console.error('[Residences] Map details error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List all residences for a tenant
  app.get('/api/tenants/:tenantId/residences', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const residences = await storage.listCommunityResidences(tenantId);
      res.json(residences);
    } catch (error: any) {
      console.error('[Residences] List error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single residence with photos and linked applications
  app.get('/api/tenants/:tenantId/residences/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const residence = await storage.getCommunityResidence(id);
      if (!residence) {
        return res.status(404).json({ error: 'Residence not found' });
      }
      const photos = await storage.listResidencePhotos(id);
      const linkedApplications = await storage.getLinkedApplications(
        residence.tenantId,
        residence.normalizedAddress
      );
      res.json({ ...residence, photos, linkedApplications });
    } catch (error: any) {
      console.error('[Residences] Get error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get email log preview (reconstructs the email from template + stored parameters)
  app.get('/api/email-logs/:id/preview', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const emailLog = await storage.getEmailLogById(id);
      if (!emailLog) {
        return res.status(404).json({ error: 'Email log not found' });
      }

      let html: string | null = null;
      let subject = emailLog.subject;
      let templateName: string | null = null;

      if (emailLog.templateId) {
        const { generatePreview, getTemplate } = await import('./emailTemplateRegistry');
        const template = getTemplate(emailLog.templateId);
        templateName = template?.name || null;
        const preview = generatePreview(emailLog.templateId, (emailLog.templateParameters as Record<string, string>) || {});
        if (preview) {
          subject = preview.subject;
          html = preview.html;
        }
      }

      if (!html) {
        html = `<div style="padding: 24px; font-family: sans-serif; color: #666;"><p>Email preview is not available for this template.</p><p><strong>Subject:</strong> ${emailLog.subject}</p><p><strong>To:</strong> ${emailLog.recipientEmail}</p></div>`;
      }

      res.json({
        id: emailLog.id,
        subject,
        recipientEmail: emailLog.recipientEmail,
        sentAt: emailLog.sentAt,
        status: emailLog.status,
        templateId: emailLog.templateId,
        templateName,
        html,
        deliveredAt: emailLog.deliveredAt,
        bouncedAt: emailLog.bouncedAt,
        openedAt: emailLog.openedAt,
        bounceType: emailLog.bounceType,
        bounceReason: emailLog.bounceReason,
      });
    } catch (error: any) {
      console.error('[Email Preview] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // SMTP2GO Webhook — delivery status updates (no auth middleware, validated by bearer token)
  app.post('/api/webhooks/smtp2go', async (req, res) => {
    try {
      const webhookSecret = process.env.SMTP2GO_WEBHOOK_SECRET;
      if (webhookSecret) {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      console.log('[Webhook] SMTP2GO payload:', JSON.stringify(req.body, null, 2));

      const { event, email_id, message, bounce, time } = req.body || {};
      if (!event || !email_id) {
        console.log('[Webhook] Skipped - missing event or email_id. Keys received:', Object.keys(req.body || {}));
        return res.status(200).json({ ok: true, skipped: 'missing event or email_id' });
      }

      const eventTime = time ? new Date(time) : new Date();

      const statusMap: Record<string, { status: string; updates: Record<string, any> }> = {
        delivered: { status: 'delivered', updates: { deliveredAt: eventTime } },
        bounce: { status: bounce === 'soft' ? 'soft_bounced' : 'bounced', updates: { bouncedAt: eventTime, bounceType: bounce || 'hard', bounceReason: message || null } },
        open: { status: 'opened', updates: { openedAt: eventTime } },
        spam: { status: 'spam_complaint', updates: {} },
        reject: { status: 'bounced', updates: { bouncedAt: eventTime, bounceType: 'hard', bounceReason: message || 'Previously bounced/spam/unsubscribed' } },
      };

      const mapping = statusMap[event];
      if (!mapping) {
        console.log(`[Webhook] Ignoring unhandled SMTP2GO event: ${event}`);
        return res.status(200).json({ ok: true, skipped: `unhandled event: ${event}` });
      }

      const updated = await storage.updateEmailLogByMessageId(email_id, {
        status: mapping.status,
        ...mapping.updates,
      });

      if (updated) {
        console.log(`[Webhook] Email ${email_id} status updated to ${mapping.status}`);
      } else {
        console.log(`[Webhook] No email log found for messageId: ${email_id}`);
      }

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error('[Webhook] SMTP2GO error:', error);
      res.status(200).json({ ok: true, error: 'internal' });
    }
  });

  // Get residence timeline
  app.get('/api/tenants/:tenantId/residences/:id/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;
      const residence = await storage.getCommunityResidence(id);
      if (!residence) {
        return res.status(404).json({ error: 'Residence not found' });
      }
      if (residence.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Residence does not belong to this tenant' });
      }
      const timeline = await storage.getResidenceTimeline(id, tenantId, residence.normalizedAddress);
      res.json(timeline);
    } catch (error: any) {
      console.error('[Residences] Timeline error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new residence
  app.post('/api/tenants/:tenantId/residences', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId } = req.params;
      const { propertyAddress, name, description, coordinates } = req.body;

      if (!propertyAddress || !propertyAddress.trim()) {
        return res.status(400).json({ error: 'Property address is required' });
      }

      const normalizedAddress = schema.normalizeAddress(propertyAddress);

      // Check for duplicate address
      const existing = await storage.getCommunityResidenceByAddress(tenantId, normalizedAddress);
      if (existing) {
        return res.status(409).json({ error: 'A residence with this address already exists', existingId: existing.id });
      }

      // Use pre-validated coordinates from frontend if provided, otherwise geocode via Radar
      let propertyCoordinates: { lat: number; lng: number } | null = null;
      if (coordinates && typeof coordinates.lat === 'number' && typeof coordinates.lng === 'number') {
        propertyCoordinates = { lat: coordinates.lat, lng: coordinates.lng };
      } else {
        try {
          const { radarService } = await import('./services/radarService');
          const validation = await radarService.validateAddress(propertyAddress);
          if (validation.isValid && validation.coordinates) {
            propertyCoordinates = {
              lat: validation.coordinates.latitude,
              lng: validation.coordinates.longitude,
            };
          }
        } catch (geoErr) {
          console.warn('[Residences] Geocoding failed, continuing without coordinates:', geoErr);
        }
      }

      const userId = req.session?.userId || req.user?.claims?.sub;
      const residence = await storage.createCommunityResidence({
        tenantId,
        propertyAddress: propertyAddress.trim(),
        normalizedAddress,
        propertyCoordinates,
        name: name?.trim() || null,
        description: description?.trim() || null,
        createdByUserId: userId,
      });

      // Auto-fetch satellite imagery if we have coordinates
      if (propertyCoordinates) {
        try {
          const { propertyBoundaryService } = await import('./services/propertyBoundaryService');
          const images = await propertyBoundaryService.getEnhancedSatelliteImages(propertyCoordinates);
          if (images) {
            // Upload satellite images to Azure
            if (images.propertyViewBase64) {
              const satBuffer = Buffer.from(images.propertyViewBase64, 'base64');
              const satBlobPath = `${tenantId}/residences/${residence.id}/satellite.png`;
              await azureBlobStorage.uploadFile('residence-images', satBuffer, 'satellite.png', 'image/png', satBlobPath);

              await storage.createResidencePhoto({
                residenceId: residence.id,
                photoType: 'satellite',
                caption: 'Satellite view',
                sortOrder: 100,
                blobPath: satBlobPath,
                containerName: 'residence-images',
                fileName: 'satellite.png',
                fileSize: satBuffer.length,
                mimeType: 'image/png',
                uploadedByUserId: userId,
              });

              await storage.updateCommunityResidence(residence.id, {
                satelliteImageBlobPath: satBlobPath,
              });
            }

            if (images.neighborhoodViewBase64) {
              const nbBuffer = Buffer.from(images.neighborhoodViewBase64, 'base64');
              const nbBlobPath = `${tenantId}/residences/${residence.id}/neighborhood.png`;
              await azureBlobStorage.uploadFile('residence-images', nbBuffer, 'neighborhood.png', 'image/png', nbBlobPath);

              await storage.createResidencePhoto({
                residenceId: residence.id,
                photoType: 'neighborhood',
                caption: 'Neighborhood view',
                sortOrder: 101,
                blobPath: nbBlobPath,
                containerName: 'residence-images',
                fileName: 'neighborhood.png',
                fileSize: nbBuffer.length,
                mimeType: 'image/png',
                uploadedByUserId: userId,
              });

              await storage.updateCommunityResidence(residence.id, {
                neighborhoodImageBlobPath: nbBlobPath,
              });
            }
          }
        } catch (satErr) {
          console.warn('[Residences] Satellite fetch failed:', satErr);
        }
      }

      // Return the freshly created residence with photos
      const updated = await storage.getCommunityResidence(residence.id);
      const photos = await storage.listResidencePhotos(residence.id);
      res.json({ ...updated, photos });
    } catch (error: any) {
      console.error('[Residences] Create error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update a residence
  app.patch('/api/tenants/:tenantId/residences/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const existing = await storage.getCommunityResidence(id);
      if (!existing) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      const updated = await storage.updateCommunityResidence(id, {
        name: name !== undefined ? (name?.trim() || null) : existing.name,
        description: description !== undefined ? (description?.trim() || null) : existing.description,
      });
      res.json(updated);
    } catch (error: any) {
      console.error('[Residences] Update error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a residence
  app.delete('/api/tenants/:tenantId/residences/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;

      const existing = await storage.getCommunityResidence(id);
      if (!existing) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      // Clean up blobs for all photos
      const photos = await storage.listResidencePhotos(id);
      for (const photo of photos) {
        try {
          await azureBlobStorage.deleteFile(photo.containerName, photo.blobPath);
        } catch (blobErr) {
          console.warn(`[Residences] Failed to delete blob ${photo.blobPath}:`, blobErr);
        }
      }

      await storage.deleteCommunityResidence(id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Residences] Delete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload photos to a residence
  app.post('/api/tenants/:tenantId/residences/:id/photos', isAuthenticated, upload.array('files', 5), async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const existing = await storage.getCommunityResidence(id);
      if (!existing) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      // Enforce max 5 uploaded photos
      const currentCount = await storage.countResidencePhotosByType(id, 'uploaded');
      if (currentCount + files.length > 5) {
        return res.status(400).json({ error: `Cannot exceed 5 uploaded photos. Currently ${currentCount}, trying to add ${files.length}.` });
      }

      const userId = req.session?.userId || req.user?.claims?.sub;
      const uploadedPhotos: schema.ResidencePhoto[] = [];

      for (const file of files) {
        const ext = file.originalname.split('.').pop() || 'jpg';
        const photoId = crypto.randomUUID();
        const blobPath = `${tenantId}/residences/${id}/${photoId}.${ext}`;

        await azureBlobStorage.uploadFile('residence-images', file.buffer, file.originalname, file.mimetype, blobPath);

        const photo = await storage.createResidencePhoto({
          residenceId: id,
          photoType: 'uploaded',
          sortOrder: currentCount + uploadedPhotos.length,
          blobPath,
          containerName: 'residence-images',
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedByUserId: userId,
        });
        uploadedPhotos.push(photo);
      }

      res.json(uploadedPhotos);
    } catch (error: any) {
      console.error('[Residences] Photo upload error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a photo
  app.delete('/api/tenants/:tenantId/residences/:id/photos/:photoId', isAuthenticated, async (req: any, res) => {
    try {
      const { photoId } = req.params;
      const photo = await storage.getResidencePhoto(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      // Delete blob from Azure
      try {
        await azureBlobStorage.deleteFile(photo.containerName, photo.blobPath);
      } catch (blobErr) {
        console.warn(`[Residences] Failed to delete blob ${photo.blobPath}:`, blobErr);
      }

      await storage.deleteResidencePhoto(photoId);

      // If deleting a mockup photo, clear the residence mockup fields so it can be regenerated cleanly
      if (photo.photoType === 'mockup') {
        const { id } = req.params;
        await storage.updateCommunityResidence(id, {
          mockupBlobPath: null,
          mockupGeneratedAt: null,
          mockupStatus: null,
          mockupError: null,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Residences] Photo delete error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Serve a residence photo (proxy from Azure)
  app.get('/api/tenants/:tenantId/residences/:id/photos/:photoId/view', async (req, res) => {
    try {
      const { photoId } = req.params;
      const photo = await storage.getResidencePhoto(photoId);
      if (!photo) {
        return res.status(404).json({ error: 'Photo not found' });
      }

      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({ error: 'Storage not configured' });
      }

      const imageBuffer = await azureBlobStorage.downloadFile(photo.containerName, photo.blobPath);
      res.setHeader('Content-Type', photo.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(imageBuffer);
    } catch (error: any) {
      console.error('[Residences] Photo view error:', error);
      res.status(404).json({ error: 'Photo not found' });
    }
  });

  // Generate AI mockup for a residence
  app.post('/api/tenants/:tenantId/residences/:id/generate-mockup', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const residence = await storage.getCommunityResidence(id);
      if (!residence) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      // Mark as generating
      await storage.updateCommunityResidence(id, {
        mockupStatus: 'generating',
        mockupError: null,
      });

      try {
        const { ImageGenerationService } = await import('./services/imageGenerationService');
        type ReferenceImage = import('./services/imageGenerationService').ReferenceImage;
        const imageGenService = new ImageGenerationService();

        // Fetch all photos for this residence to use as reference images
        const allPhotos = await storage.listResidencePhotos(id);
        const referenceImages: ReferenceImage[] = [];

        // Download uploaded photos (ground truth — highest priority, max 5)
        const uploadedPhotos = allPhotos.filter(p => p.photoType === 'uploaded').slice(0, 5);
        for (const photo of uploadedPhotos) {
          try {
            const buffer = await azureBlobStorage.downloadFile(photo.containerName, photo.blobPath);
            referenceImages.push({
              base64: buffer.toString('base64'),
              mimeType: photo.mimeType,
              photoType: 'uploaded',
              caption: photo.caption || undefined,
            });
          } catch (err) {
            console.warn(`[Residences] Could not load uploaded photo ${photo.id} for mockup:`, err);
          }
        }

        // Download satellite image
        const satellitePhotos = allPhotos.filter(p => p.photoType === 'satellite').slice(0, 1);
        for (const photo of satellitePhotos) {
          try {
            const buffer = await azureBlobStorage.downloadFile(photo.containerName, photo.blobPath);
            referenceImages.push({
              base64: buffer.toString('base64'),
              mimeType: photo.mimeType,
              photoType: 'satellite',
            });
          } catch (err) {
            console.warn('[Residences] Could not load satellite photo for mockup:', err);
          }
        }

        // Fallback: if no satellite photo record but residence has satelliteImageBlobPath
        if (satellitePhotos.length === 0 && residence.satelliteImageBlobPath) {
          try {
            const satBuffer = await azureBlobStorage.downloadFile('residence-images', residence.satelliteImageBlobPath);
            referenceImages.push({
              base64: satBuffer.toString('base64'),
              mimeType: 'image/png',
              photoType: 'satellite',
            });
          } catch (err) {
            console.warn('[Residences] Could not load satellite image from blob path for mockup:', err);
          }
        }

        // Download neighborhood image
        const neighborhoodPhotos = allPhotos.filter(p => p.photoType === 'neighborhood').slice(0, 1);
        for (const photo of neighborhoodPhotos) {
          try {
            const buffer = await azureBlobStorage.downloadFile(photo.containerName, photo.blobPath);
            referenceImages.push({
              base64: buffer.toString('base64'),
              mimeType: photo.mimeType,
              photoType: 'neighborhood',
            });
          } catch (err) {
            console.warn('[Residences] Could not load neighborhood photo for mockup:', err);
          }
        }

        const uploadedCount = referenceImages.filter(r => r.photoType === 'uploaded').length;
        const satCount = referenceImages.filter(r => r.photoType === 'satellite').length;
        const neighCount = referenceImages.filter(r => r.photoType === 'neighborhood').length;
        console.log(`[Residences] Generating mockup with ${referenceImages.length} reference images (${uploadedCount} uploaded, ${satCount} satellite, ${neighCount} neighborhood)`);

        const result = await imageGenService.generateMockup({
          projectType: 'residence-rendering',
          projectDescription: `Architectural rendering of the residence at ${residence.propertyAddress}${residence.name ? ` (${residence.name})` : ''}. ${residence.description || 'Show a clean, professional rendering of this property.'}`,
          propertyAddress: residence.propertyAddress,
          formData: {},
          referenceImages,
        });

        if (!result) {
          await storage.updateCommunityResidence(id, {
            mockupStatus: 'failed',
            mockupError: 'Image generation service returned no result',
          });
          return res.status(500).json({ error: 'Mockup generation failed' });
        }

        // Upload mockup to Azure
        const mockupBuffer = Buffer.from(result.base64, 'base64');
        const mockupBlobPath = `${residence.tenantId}/residences/${id}/mockup.png`;
        await azureBlobStorage.uploadFile('residence-images', mockupBuffer, 'mockup.png', result.mimeType, mockupBlobPath);

        // Create photo record
        const userId = req.session?.userId || req.user?.claims?.sub;
        await storage.createResidencePhoto({
          residenceId: id,
          photoType: 'mockup',
          caption: 'AI-generated mockup',
          sortOrder: 200,
          blobPath: mockupBlobPath,
          containerName: 'residence-images',
          fileName: 'mockup.png',
          fileSize: mockupBuffer.length,
          mimeType: result.mimeType,
          uploadedByUserId: userId,
        });

        await storage.updateCommunityResidence(id, {
          mockupBlobPath,
          mockupGeneratedAt: new Date(),
          mockupStatus: 'completed',
          mockupError: null,
        });

        const updated = await storage.getCommunityResidence(id);
        const photos = await storage.listResidencePhotos(id);
        res.json({ ...updated, photos });
      } catch (genErr: any) {
        console.error('[Residences] Mockup generation error:', genErr);
        await storage.updateCommunityResidence(id, {
          mockupStatus: 'failed',
          mockupError: genErr.message,
        });
        res.status(500).json({ error: genErr.message });
      }
    } catch (error: any) {
      console.error('[Residences] Generate mockup error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Re-fetch satellite imagery for a residence
  app.post('/api/tenants/:tenantId/residences/:id/fetch-satellite', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;
      const residence = await storage.getCommunityResidence(id);
      if (!residence) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      if (!residence.propertyCoordinates) {
        return res.status(400).json({ error: 'No coordinates available for this residence. Try updating the address.' });
      }

      const coords = residence.propertyCoordinates as { lat: number; lng: number };
      const { propertyBoundaryService } = await import('./services/propertyBoundaryService');
      const images = await propertyBoundaryService.getEnhancedSatelliteImages(coords);

      if (!images) {
        return res.status(500).json({ error: 'Failed to fetch satellite imagery' });
      }

      const userId = req.session?.userId || req.user?.claims?.sub;

      if (images.propertyViewBase64) {
        const satBuffer = Buffer.from(images.propertyViewBase64, 'base64');
        const satBlobPath = `${tenantId}/residences/${id}/satellite.png`;
        await azureBlobStorage.uploadFile('residence-images', satBuffer, 'satellite.png', 'image/png', satBlobPath);

        // Remove old satellite photo records
        const existingPhotos = await storage.listResidencePhotos(id);
        for (const p of existingPhotos.filter(p => p.photoType === 'satellite')) {
          await storage.deleteResidencePhoto(p.id);
        }

        await storage.createResidencePhoto({
          residenceId: id,
          photoType: 'satellite',
          caption: 'Satellite view',
          sortOrder: 100,
          blobPath: satBlobPath,
          containerName: 'residence-images',
          fileName: 'satellite.png',
          fileSize: satBuffer.length,
          mimeType: 'image/png',
          uploadedByUserId: userId,
        });

        await storage.updateCommunityResidence(id, { satelliteImageBlobPath: satBlobPath });
      }

      if (images.neighborhoodViewBase64) {
        const nbBuffer = Buffer.from(images.neighborhoodViewBase64, 'base64');
        const nbBlobPath = `${tenantId}/residences/${id}/neighborhood.png`;
        await azureBlobStorage.uploadFile('residence-images', nbBuffer, 'neighborhood.png', 'image/png', nbBlobPath);

        const existingPhotos = await storage.listResidencePhotos(id);
        for (const p of existingPhotos.filter(p => p.photoType === 'neighborhood')) {
          await storage.deleteResidencePhoto(p.id);
        }

        await storage.createResidencePhoto({
          residenceId: id,
          photoType: 'neighborhood',
          caption: 'Neighborhood view',
          sortOrder: 101,
          blobPath: nbBlobPath,
          containerName: 'residence-images',
          fileName: 'neighborhood.png',
          fileSize: nbBuffer.length,
          mimeType: 'image/png',
          uploadedByUserId: userId,
        });

        await storage.updateCommunityResidence(id, { neighborhoodImageBlobPath: nbBlobPath });
      }

      const updated = await storage.getCommunityResidence(id);
      const photos = await storage.listResidencePhotos(id);
      res.json({ ...updated, photos });
    } catch (error: any) {
      console.error('[Residences] Fetch satellite error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // RESIDENCE MOBILE UPLOAD (Token-based, public endpoints)
  // ============================================

  // Create upload token (authenticated - called from desktop)
  app.post('/api/tenants/:tenantId/residences/:id/upload-token', isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, id } = req.params;
      const userId = req.session?.userId || req.user?.claims?.sub;

      const residence = await storage.getCommunityResidence(id);
      if (!residence || residence.tenantId !== tenantId) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const uploadToken = await storage.createResidenceUploadToken({
        token,
        residenceId: id,
        tenantId,
        expiresAt,
        isUsed: false,
        photosUploaded: 0,
        createdByUserId: userId,
      });

      res.json({
        token: uploadToken.token,
        uploadUrl: `/residence-upload/${uploadToken.token}`,
        expiresAt: uploadToken.expiresAt,
        expiresInMs: 10 * 60 * 1000,
      });
    } catch (error: any) {
      console.error('[Residences] Error creating upload token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Validate residence upload token (public - called from mobile)
  app.get('/api/residence-upload/:token', async (req, res) => {
    try {
      const uploadToken = await storage.getResidenceUploadToken(req.params.token);

      if (!uploadToken) {
        return res.status(404).json({ error: 'Invalid upload link' });
      }
      if (new Date() > uploadToken.expiresAt) {
        return res.status(410).json({ error: 'This upload link has expired' });
      }
      if (uploadToken.isUsed) {
        return res.status(410).json({ error: 'This upload link has already been used' });
      }

      const residence = await storage.getCommunityResidence(uploadToken.residenceId);
      if (!residence) {
        return res.status(404).json({ error: 'Residence not found' });
      }

      res.json({
        residenceName: residence.name || residence.propertyAddress,
        propertyAddress: residence.propertyAddress,
        expiresAt: uploadToken.expiresAt,
        isValid: true,
      });
    } catch (error: any) {
      console.error('[Residences] Error validating upload token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload photos via token (public - called from mobile)
  app.post('/api/residence-upload/:token', upload.array('files', 5), async (req: any, res) => {
    try {
      if (!azureBlobStorage.isAvailable()) {
        return res.status(503).json({ error: 'File storage is not configured' });
      }

      const uploadToken = await storage.getResidenceUploadToken(req.params.token);
      if (!uploadToken) {
        return res.status(404).json({ error: 'Invalid upload link' });
      }
      if (new Date() > uploadToken.expiresAt) {
        return res.status(410).json({ error: 'This upload link has expired' });
      }
      if (uploadToken.isUsed) {
        return res.status(410).json({ error: 'This upload link has already been used' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      // Enforce max 5 uploaded photos total
      const existingCount = await storage.countResidencePhotosByType(uploadToken.residenceId, 'uploaded');
      if (existingCount + files.length > 5) {
        return res.status(400).json({ error: `Can only have 5 uploaded photos total. Currently ${existingCount}, tried to add ${files.length}.` });
      }

      const uploaded = [];
      for (const file of files) {
        if (!file.mimetype.startsWith('image/')) continue;

        const photoId = crypto.randomUUID();
        const ext = file.originalname?.split('.').pop() || 'jpg';
        const blobPath = `${uploadToken.tenantId}/residences/${uploadToken.residenceId}/${photoId}.${ext}`;

        await azureBlobStorage.uploadFile(
          'residence-images',
          file.buffer,
          file.originalname || `photo.${ext}`,
          file.mimetype,
          blobPath
        );

        const photo = await storage.createResidencePhoto({
          residenceId: uploadToken.residenceId,
          photoType: 'uploaded',
          caption: null,
          sortOrder: existingCount + uploaded.length,
          blobPath,
          containerName: 'residence-images',
          fileName: file.originalname || `photo.${ext}`,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedByUserId: uploadToken.createdByUserId,
        });
        uploaded.push(photo);
      }

      // Mark token as used
      await storage.markResidenceTokenAsUsed(req.params.token, uploaded.length);

      res.json({ success: true, photosUploaded: uploaded.length });
    } catch (error: any) {
      console.error('[Residences] Error uploading via token:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check residence upload token status (public - polled from desktop)
  app.get('/api/residence-upload/:token/status', async (req, res) => {
    try {
      const uploadToken = await storage.getResidenceUploadToken(req.params.token);
      if (!uploadToken) {
        return res.status(404).json({ error: 'Invalid upload link' });
      }

      res.json({
        isUsed: uploadToken.isUsed,
        isExpired: new Date() > uploadToken.expiresAt,
        photosUploaded: uploadToken.photosUploaded,
        usedAt: uploadToken.usedAt,
      });
    } catch (error: any) {
      console.error('[Residences] Error checking upload status:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
