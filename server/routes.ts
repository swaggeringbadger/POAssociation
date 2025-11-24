import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTenantSchema, insertFormTemplateSchema, insertApplicationSchema, insertDemoCodeSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { provisionDemoEcosystem } from "./provision";
import { AdditionalInfoService } from "./additionalInfoService";
import { z } from "zod";

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

  // Apply subdomain detection to all routes
  app.use(subdomainMiddleware);

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check for demo session first (session-based auth)
      if (req.session?.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user) {
          return res.json(user);
        }
      }

      // Check for Replit auth (OAuth-based auth)
      if (req.user?.claims?.sub) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        return res.json(user);
      }

      // Not authenticated
      res.status(401).json({ message: "Not authenticated" });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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

  // Get properties/communities managed by current user (account_admin role)
  app.get("/api/properties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const properties = await storage.getManagedProperties(userId);
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

  // Form Templates - Protected routes
  app.get("/api/tenants/:tenantId/forms", isAuthenticated, async (req, res) => {
    try {
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
  app.get("/api/applications/:id", isAuthenticated, async (req, res) => {
    try {
      const application = await storage.getApplication(req.params.id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/tenants/:tenantId/applications", isAuthenticated, async (req, res) => {
    try {
      const applications = await storage.listApplicationsForTenant(req.params.tenantId);
      res.json(applications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/applications", isAuthenticated, async (req, res) => {
    try {
      // Get form template to extract version and config
      const formTemplate = await storage.getFormTemplate(req.body.formTemplateId);
      if (!formTemplate) {
        return res.status(400).json({ error: "Invalid form template" });
      }

      // Calculate completeness score
      const config = await additionalInfoService.getFormTemplateConfig(req.body.formTemplateId);
      const completenessScore = config
        ? additionalInfoService.calculateCompletenessScore(config, req.body.formData || {})
        : 0;

      // Generate application number
      // Format: APP-YYYY-NNNN (e.g., APP-2024-0001)
      const year = new Date().getFullYear();
      const count = await storage.getApplicationCountForYear(req.body.tenantId, year);
      const applicationNumber = `APP-${year}-${String(count + 1).padStart(4, '0')}`;

      // Validate and create application
      const validated = insertApplicationSchema.parse({
        ...req.body,
        applicationNumber,
        formTemplateVersion: formTemplate.version,
        completenessScore,
      });

      const application = await storage.createApplication(validated);
      res.status(201).json(application);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: fromZodError(error).message });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/applications/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { status, reviewedByUserId, reviewNotes } = req.body;
      const application = await storage.updateApplicationStatus(
        req.params.id,
        status,
        reviewedByUserId,
        reviewNotes
      );
      res.json(application);
    } catch (error: any) {
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
          // Mark demo code as inactive on failure
          storage.updateDemoCode(demoCode.id, { isActive: false });
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
      const demoCode = await storage.updateDemoCode(req.params.id, req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}
