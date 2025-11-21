import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and } from "drizzle-orm";
import * as schema from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool, schema });

export interface IStorage {
  // Users
  getUser(id: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  
  // Tenants
  getTenant(id: string): Promise<schema.Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<schema.Tenant | undefined>;
  listTenants(): Promise<schema.Tenant[]>;
  createTenant(tenant: schema.InsertTenant): Promise<schema.Tenant>;
  
  // User-Tenant-Roles
  getUserRolesForTenant(userId: string, tenantId: string): Promise<schema.UserTenantRole[]>;
  getUserTenants(userId: string): Promise<(schema.UserTenantRole & { tenant: schema.Tenant })[]>;
  assignUserRole(assignment: schema.InsertUserTenantRole): Promise<schema.UserTenantRole>;
  
  // Form Templates
  getFormTemplate(id: string): Promise<schema.FormTemplate | undefined>;
  listFormTemplatesForTenant(tenantId: string): Promise<schema.FormTemplate[]>;
  createFormTemplate(template: schema.InsertFormTemplate): Promise<schema.FormTemplate>;
  updateFormTemplate(id: string, template: Partial<schema.InsertFormTemplate>): Promise<schema.FormTemplate>;
  
  // Applications
  getApplication(id: string): Promise<schema.Application | undefined>;
  listApplicationsForTenant(tenantId: string): Promise<schema.Application[]>;
  listApplicationsForUser(userId: string): Promise<schema.Application[]>;
  createApplication(application: schema.InsertApplication): Promise<schema.Application>;
  updateApplicationStatus(
    id: string, 
    status: string, 
    reviewedByUserId?: string, 
    reviewNotes?: string
  ): Promise<schema.Application>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(insertUser: schema.InsertUser): Promise<schema.User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  // Tenants
  async getTenant(id: string): Promise<schema.Tenant | undefined> {
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, id));
    return tenant;
  }

  async getTenantBySubdomain(subdomain: string): Promise<schema.Tenant | undefined> {
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.subdomain, subdomain));
    return tenant;
  }

  async listTenants(): Promise<schema.Tenant[]> {
    return db.select().from(schema.tenants).where(eq(schema.tenants.isActive, true));
  }

  async createTenant(insertTenant: schema.InsertTenant): Promise<schema.Tenant> {
    const [tenant] = await db.insert(schema.tenants).values(insertTenant).returning();
    return tenant;
  }

  // User-Tenant-Roles
  async getUserRolesForTenant(userId: string, tenantId: string): Promise<schema.UserTenantRole[]> {
    return db
      .select()
      .from(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.tenantId, tenantId)
        )
      );
  }

  async getUserTenants(userId: string): Promise<(schema.UserTenantRole & { tenant: schema.Tenant })[]> {
    const results = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.tenants, eq(schema.userTenantRoles.tenantId, schema.tenants.id))
      .where(eq(schema.userTenantRoles.userId, userId));
    
    return results.map(r => ({ ...r.user_tenant_roles, tenant: r.tenants }));
  }

  async assignUserRole(assignment: schema.InsertUserTenantRole): Promise<schema.UserTenantRole> {
    const [role] = await db.insert(schema.userTenantRoles).values(assignment).returning();
    return role;
  }

  // Form Templates
  async getFormTemplate(id: string): Promise<schema.FormTemplate | undefined> {
    const [template] = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, id));
    return template;
  }

  async listFormTemplatesForTenant(tenantId: string): Promise<schema.FormTemplate[]> {
    return db
      .select()
      .from(schema.formTemplates)
      .where(
        and(
          eq(schema.formTemplates.tenantId, tenantId),
          eq(schema.formTemplates.isActive, true)
        )
      );
  }

  async createFormTemplate(insertTemplate: schema.InsertFormTemplate): Promise<schema.FormTemplate> {
    const [template] = await db.insert(schema.formTemplates).values(insertTemplate).returning();
    return template;
  }

  async updateFormTemplate(id: string, updates: Partial<schema.InsertFormTemplate>): Promise<schema.FormTemplate> {
    const [template] = await db
      .update(schema.formTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.formTemplates.id, id))
      .returning();
    return template;
  }

  // Applications
  async getApplication(id: string): Promise<schema.Application | undefined> {
    const [application] = await db.select().from(schema.applications).where(eq(schema.applications.id, id));
    return application;
  }

  async listApplicationsForTenant(tenantId: string): Promise<schema.Application[]> {
    return db.select().from(schema.applications).where(eq(schema.applications.tenantId, tenantId));
  }

  async listApplicationsForUser(userId: string): Promise<schema.Application[]> {
    return db.select().from(schema.applications).where(eq(schema.applications.submittedByUserId, userId));
  }

  async createApplication(insertApplication: schema.InsertApplication): Promise<schema.Application> {
    const [application] = await db.insert(schema.applications).values(insertApplication).returning();
    return application;
  }

  async updateApplicationStatus(
    id: string,
    status: string,
    reviewedByUserId?: string,
    reviewNotes?: string
  ): Promise<schema.Application> {
    const [application] = await db
      .update(schema.applications)
      .set({
        status,
        reviewedAt: new Date(),
        reviewedByUserId,
        reviewNotes,
      })
      .where(eq(schema.applications.id, id))
      .returning();
    return application;
  }
}

export const storage = new DbStorage();
