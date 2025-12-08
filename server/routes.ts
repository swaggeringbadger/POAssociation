import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, db } from "./storage";
import { insertTenantSchema, insertFormTemplateSchema, insertApplicationSchema, insertDemoCodeSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { setupAuth, isAuthenticated } from "./replitAuth";
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

      // Get next upcoming scheduled event for this community
      const now = new Date();
      const upcomingEvents = await storage.listEvents({
        tenantId: tenant.id,
        status: 'scheduled',
        startAfter: now,
      });

      // Get the first upcoming event (already ordered by startDatetime)
      const nextEvent = upcomingEvents.length > 0 ? upcomingEvents[0] : null;

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
        nextEvent: nextEvent ? {
          id: nextEvent.id,
          title: nextEvent.title,
          startDatetime: nextEvent.startDatetime,
          endDatetime: nextEvent.endDatetime,
          location: nextEvent.location || null,
          meetingUrl: nextEvent.meetingUrl || null,
          eventType: nextEvent.eventType ? {
            name: nextEvent.eventType.name,
            slug: nextEvent.eventType.slug,
          } : null,
        } : null,
      });
    } catch (error: any) {
      console.error('Error fetching public community info:', error);
      res.status(500).json({ error: 'Failed to fetch community info' });
    }
  });

  // Public contact form endpoint - sends to POA_CONTACT_EMAIL
  // POST /api/public/contact - Submit contact form or demo request
  app.post('/api/public/contact', async (req, res) => {
    try {
      const { mode, name, email, phone, company, communitySize, message, preferredTime } = req.body;

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

      // Validate and create application
      const validated = insertApplicationSchema.parse({
        ...req.body,
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
          const applicationLink = `https://${tenant.subdomain}.poassociation.com/applications/${application.id}`;
          const applicantName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Resident';
          
          console.log(`[Email] SENDING to: ${user.email}, app: ${req.body.title}`);
          const emailResult = await emailService.sendApplicationSubmitted(
            user.email,
            req.body.title || 'Modification Application',
            applicantName,
            tenant.name,
            applicationLink
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

  // Update application (for homeowner edits)
  app.patch("/api/applications/:id", isAuthenticated, async (req, res) => {
    try {
      const applicationId = req.params.id;
      const userId = (req as any).session?.userId || (req as any).user?.claims?.sub;
      
      // Fetch application to verify ownership
      const application = await storage.getApplication(applicationId);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      
      // Verify user is the submitter
      if (application.submittedByUserId !== userId) {
        return res.status(403).json({ error: "You don't have permission to edit this application" });
      }
      
      // Verify application can be edited (draft, pending, or under_review)
      if (!['draft', 'pending', 'under_review'].includes(application.status)) {
        return res.status(400).json({ error: "This application cannot be edited in its current status" });
      }
      
      const { title, description, propertyAddress, formData, status } = req.body;
      
      // Calculate new completeness score if formData changed
      let completenessScore = application.completenessScore;
      if (formData) {
        const config = await additionalInfoService.getFormTemplateConfig(application.formTemplateId);
        if (config) {
          completenessScore = additionalInfoService.calculateCompletenessScore(config, formData);
        }
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
      
      // Send email notification if application was reset to pending from under_review
      try {
        if (application.status === 'under_review' && status === 'pending') {
          const user = await storage.getUser(userId);
          const tenant = await storage.getTenant(application.tenantId);
          
          if (user && tenant && user.email) {
            const { emailService } = await import('./emailService');
            const applicationLink = `https://${tenant.subdomain}.poassociation.com/applications/${applicationId}`;
            const applicantName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Valued Resident';
            
            await emailService.sendApplicationSubmitted(
              user.email,
              title || application.title,
              applicantName,
              tenant.name,
              applicationLink
            );
          }
        }
      } catch (emailError) {
        console.error("[Email] Error sending application update email:", emailError);
        // Don't fail the update if email fails
      }
      
      res.json(updatedApplication);
    } catch (error: any) {
      console.error("[PATCH /api/applications/:id] Error:", error);
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
      const analyses = await storage.listAllAiAnalyses(limit);
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

  // Workflow Templates - list for tenant
  app.get("/api/workflows/templates", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.subdomain) {
        return res.status(400).json({ error: "No tenant context" });
      }
      const tenant = await storage.getTenantBySubdomain(req.subdomain);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      // Check if tenant has access to Custom Workflows feature
      const featureAccess = await storage.checkFeatureAccess(tenant.id, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

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

      // Check if tenant has access to Custom Workflows feature
      const featureAccess = await storage.checkFeatureAccess(app.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

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

      // Check if tenant has access to Custom Workflows feature
      const featureAccess = await storage.checkFeatureAccess(application.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

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

      // Check if tenant has access to Custom Workflows feature
      const featureAccess = await storage.checkFeatureAccess(application.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

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

      // Check if tenant has access to Custom Workflows feature
      const featureAccess = await storage.checkFeatureAccess(application.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan",
          requiredPlan: featureAccess.requiredPlan,
          currentPlan: featureAccess.currentPlan
        });
      }

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

        // Get custom templates for this tenant (always fetch to check for locked ones)
        const allCustomTemplates = await storage.listCustomWorkflowTemplatesForTenant(targetTenantId);

        // Check if target tenant has custom_workflows feature
        const featureAccess = await storage.checkFeatureAccess(targetTenantId, 'custom_workflows');
        console.log('[workflow-templates] featureAccess for', targetTenantId, ':', featureAccess);
        hasCustomWorkflows = featureAccess.hasAccess;
        canClone = featureAccess.hasAccess;

        // Get current plan name and determine required plan for the modal
        const subscription = await storage.getTenantSubscription(targetTenantId);
        currentPlan = subscription?.plan?.name || 'Free';

        // Determine required plan based on tenant type (from plan_type prefix)
        const planType = subscription?.plan?.planType || '';
        if (planType.startsWith('management_')) {
          requiredPlan = 'Starter'; // Management companies need Starter+
        } else {
          requiredPlan = 'Premium'; // Communities need Premium+
        }

        if (hasCustomWorkflows) {
          // User has access - show all custom templates
          customTemplates = allCustomTemplates;
        } else {
          // User downgraded - custom templates are locked
          lockedWorkflowCount = allCustomTemplates.length;
          customTemplates = []; // Don't show them, they're locked
          cloneDisabledReason = `Upgrade to ${requiredPlan} or higher to clone and customize workflows`;
        }
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
      // Include feature access info so frontend knows if user can edit
      let hasCustomWorkflows = true;
      if (process.env.NODE_ENV !== 'development') {
        const featureAccess = await storage.checkFeatureAccess(template.tenantId, 'custom_workflows');
        hasCustomWorkflows = featureAccess.hasAccess;
      }

      res.json({ ...template, hasCustomWorkflows });
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

      // Check feature access on the TARGET tenant (not the source)
      const featureAccess = await storage.checkFeatureAccess(targetTenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in this property's subscription plan. Upgrade to Professional or Enterprise."
        });
      }

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

      // Check feature access
      const featureAccess = await storage.checkFeatureAccess(template.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan"
        });
      }

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

      // Check feature access
      const featureAccess = await storage.checkFeatureAccess(template.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan"
        });
      }

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

        // If it's a custom template, verify the property has access to custom workflows
        if (!template.isBlueprint) {
          const featureAccess = await storage.checkFeatureAccess(propertyId, 'custom_workflows');
          if (!featureAccess.hasAccess) {
            return res.status(403).json({
              error: "Custom workflows are not available in this property's subscription plan"
            });
          }
        }
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

      // Check feature access
      const featureAccess = await storage.checkFeatureAccess(template.tenantId, 'custom_workflows');
      if (!featureAccess.hasAccess) {
        return res.status(403).json({
          error: "Custom Workflows are not available in your subscription plan"
        });
      }

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

      if (!tenant.designGuidelinesUrl) {
        return res.status(400).json({
          error: "No design guidelines URL configured for this property. Please add one in settings first."
        });
      }

      // Import AI generation service
      const { aiFormGenerationService } = await import('./aiFormGenerationService');

      // Generate form
      const result = await aiFormGenerationService.generateForm(
        tenant.designGuidelinesUrl,
        applicationType
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
      const { tenantId } = req.query;
      const generations = await storage.listAiFormGenerations(tenantId);
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
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's roles across all tenants
    const userTenants = await storage.getUserTenants(userId);
    const userRoles = userTenants.map(ut => ut.role);

    const allowedRoles = ['management_manager', 'super_admin'];
    const readOnlyRoles = ['management_rep'];

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
  app.get('/api/compliance/categories', requireComplianceAccess, async (req: any, res) => {
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
  app.post('/api/compliance/categories', requireComplianceAccess, async (req: any, res) => {
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
  app.get('/api/compliance/dashboard', requireComplianceAccess, async (req: any, res) => {
    try {
      // Get tenant IDs this user has access to
      const tenantIds = req.userTenants.map((ut: any) => ut.tenantId);
      const dashboard = await storage.getComplianceDashboard(tenantIds);
      res.json(dashboard);
    } catch (error: any) {
      console.error('Error getting compliance dashboard:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // List compliance items
  app.get('/api/compliance/items', requireComplianceAccess, async (req: any, res) => {
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
  app.get('/api/compliance/items/:id', requireComplianceAccess, async (req: any, res) => {
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
  app.post('/api/compliance/items', requireComplianceAccess, async (req: any, res) => {
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
  app.patch('/api/compliance/items/:id', requireComplianceAccess, async (req: any, res) => {
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
  app.delete('/api/compliance/items/:id', requireComplianceAccess, async (req: any, res) => {
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
  app.post('/api/compliance/items/:id/complete', requireComplianceAccess, async (req: any, res) => {
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
  app.post('/api/compliance/items/:id/reopen', requireComplianceAccess, async (req: any, res) => {
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
  app.post('/api/compliance/items/:itemId/documents', requireComplianceAccess, upload.single('file'), async (req: any, res) => {
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
  app.get('/api/compliance/items/:itemId/documents', requireComplianceAccess, async (req: any, res) => {
    try {
      const documents = await storage.listComplianceDocuments(req.params.itemId);
      res.json(documents);
    } catch (error: any) {
      console.error('Error listing compliance documents:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Download compliance document
  app.get('/api/compliance/documents/:id/download', requireComplianceAccess, async (req: any, res) => {
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
  app.delete('/api/compliance/documents/:id', requireComplianceAccess, async (req: any, res) => {
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
    console.log('requireEventsAccess - session:', req.session);
    console.log('requireEventsAccess - user:', req.user);
    const userId = req.session?.userId || req.user?.claims?.sub;
    console.log('requireEventsAccess - userId:', userId);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    req.userId = userId; // Set for downstream handlers

    // Get user's roles across all tenants
    const userTenants = await storage.getUserTenants(userId);
    const userRoles = userTenants.map(ut => ut.role);

    // Full access roles can create/edit/delete events AND see all events (public + non-public)
    const fullAccessRoles = ['management_manager', 'super_admin', 'poa_board_member', 'account_admin'];
    // Staff roles can view all events (public + non-public) but not create/edit
    const staffRoles = ['management_rep', 'poa_board_contributor'];
    // Member roles can only view public events
    const memberRoles = ['homeowner'];

    if (fullAccessRoles.some(r => userRoles.includes(r))) {
      req.eventsAccess = 'full';
      req.canSeeNonPublic = true; // Can see board-only events
      req.userTenants = userTenants;
      return next();
    }

    if (req.method === 'GET' && staffRoles.some(r => userRoles.includes(r))) {
      req.eventsAccess = 'read';
      req.canSeeNonPublic = true; // Staff can see board-only events
      req.userTenants = userTenants;
      return next();
    }

    if (req.method === 'GET' && memberRoles.some(r => userRoles.includes(r))) {
      req.eventsAccess = 'read';
      req.canSeeNonPublic = false; // Members can only see public events
      req.userTenants = userTenants;
      return next();
    }

    // If user has any tenant access, allow read-only for public events only
    if (req.method === 'GET' && userTenants.length > 0) {
      req.eventsAccess = 'read';
      req.canSeeNonPublic = false;
      req.userTenants = userTenants;
      return next();
    }

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
      if (!tenantIds.includes(event.tenantId)) {
        return res.status(403).json({ error: 'Access denied to this event' });
      }

      // Check visibility - non-public events require staff/board access
      if (!event.isPublic && !req.canSeeNonPublic) {
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
  // CALENDAR FEED (iCal) ROUTES
  // ============================================

  // Generate iCal content from events
  function generateICalContent(events: any[], calendarName: string): string {
    const icalLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//POA Association//Calendar//EN',
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
      const userId = req.userId;

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
      const userId = req.userId;

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
      const { includeSatellite = true, includeMockups = true, includeBreakdownReport = false, mockupQuality = 'standard' } = req.body;

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

  // Get subscription for a community
  app.get('/api/communities/:communityId/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const { communitySubscriptionService } = await import('./services/communitySubscriptionService');
      const { communityId } = req.params;
      const subscription = await communitySubscriptionService.getSubscriptionWithTier(communityId);
      if (!subscription) {
        return res.status(404).json({ error: 'No subscription found for this community' });
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
        `https://poassociation.com/billing?invoice=${invoiceId}`
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

      const { address } = req.body;

      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: 'Address is required' });
      }

      const result = await radarService.validateAddress(address);
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

  const httpServer = createServer(app);
  return httpServer;
}
