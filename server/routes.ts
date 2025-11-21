import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTenantSchema, insertFormTemplateSchema, insertApplicationSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Referenced from Replit Auth integration: blueprint:javascript_log_in_with_replit
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
      const validated = insertApplicationSchema.parse(req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}
