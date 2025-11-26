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

      // Seed workflows for tenant and auto-create workflow for application
      try {
        await seedWorkflowTemplates(req.body.tenantId);
        const templates = await storage.listWorkflowTemplatesForTenant(req.body.tenantId);
        if (templates.length > 0) {
          await storage.createApplicationWorkflow({
            applicationId: application.id,
            workflowTemplateId: templates[0].id,
          });
        }
      } catch (workflowError) {
        console.error("Warning: Failed to create workflow:", workflowError);
        // Don't fail the entire application creation if workflow setup fails
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
          const applicationLink = `https://${tenant.subdomain}.civicflow.com/applications/${application.id}`;
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

  // Workflow Templates - list for tenant
  app.get("/api/workflows/templates", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.subdomain) {
        return res.status(400).json({ error: "No tenant context" });
      }
      const tenant = await storage.getTenantBySubdomain(req.subdomain);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });
      
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
      const workflow = await storage.getApplicationWorkflow(req.params.applicationId);
      if (!workflow) return res.status(404).json({ error: "Workflow not found" });

      const history = await storage.getWorkflowActionHistory(workflow.id);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching workflow history:", error);
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

  const httpServer = createServer(app);
  return httpServer;
}
