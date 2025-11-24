import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool, schema });

export interface IStorage {
  // Users - Referenced from Replit Auth integration
  getUser(id: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  upsertUser(user: schema.UpsertUser): Promise<schema.User>;
  
  // Tenants
  getTenant(id: string): Promise<schema.Tenant | undefined>;
  getTenantBySubdomain(subdomain: string): Promise<schema.Tenant | undefined>;
  listTenants(): Promise<schema.Tenant[]>;
  listAllTenants(): Promise<schema.Tenant[]>;
  getManagedProperties(userId: string): Promise<schema.Tenant[]>;
  createTenant(tenant: schema.InsertTenant): Promise<schema.Tenant>;
  updateTenant(id: string, updates: Partial<schema.InsertTenant>): Promise<schema.Tenant>;
  deleteTenant(id: string): Promise<void>;
  
  // User-Tenant-Roles
  getUserRolesForTenant(userId: string, tenantId: string): Promise<schema.UserTenantRole[]>;
  getUserTenants(userId: string): Promise<(schema.UserTenantRole & { tenant: schema.Tenant })[]>;
  getTenantUsers(tenantId: string): Promise<(schema.User & { roles: string[] })[]>;
  assignUserRole(assignment: schema.InsertUserTenantRole): Promise<schema.UserTenantRole>;
  removeUserRole(userId: string, tenantId: string, role: string): Promise<void>;
  removeUserFromTenant(userId: string, tenantId: string): Promise<void>;
  
  // Form Templates
  getFormTemplate(id: string): Promise<schema.FormTemplate | undefined>;
  getActiveFormTemplateForProjectType(tenantId: string, projectType: string): Promise<schema.FormTemplate | undefined>;
  listFormTemplatesForTenant(tenantId: string): Promise<schema.FormTemplate[]>;
  createFormTemplate(template: schema.InsertFormTemplate): Promise<schema.FormTemplate>;
  updateFormTemplate(id: string, template: Partial<schema.InsertFormTemplate>): Promise<schema.FormTemplate>;
  
  // Applications
  getApplication(id: string): Promise<schema.Application | undefined>;
  getApplicationCountForYear(tenantId: string, year: number): Promise<number>;
  listApplicationsForTenant(tenantId: string): Promise<schema.Application[]>;
  listApplicationsForUser(userId: string): Promise<schema.Application[]>;
  listApplicationsByRole(role: string, tenantId: string, userId: string): Promise<schema.Application[]>;
  createApplication(application: schema.InsertApplication): Promise<schema.Application>;
  updateApplicationStatus(
    id: string,
    status: string,
    reviewedByUserId?: string,
    reviewNotes?: string
  ): Promise<schema.Application>;

  // Demo Codes
  getDemoCode(id: string): Promise<schema.DemoCode | undefined>;
  getDemoCodeByCode(code: string): Promise<schema.DemoCode | undefined>;
  listDemoCodes(): Promise<schema.DemoCode[]>;
  createDemoCode(code: schema.InsertDemoCode): Promise<schema.DemoCode>;
  updateDemoCode(id: string, updates: Partial<Omit<schema.DemoCode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<schema.DemoCode>;
  deleteDemoCode(id: string): Promise<void>;
  incrementDemoCodeUsage(id: string): Promise<void>;

  // Demo Users
  getDemoUsersByCodeId(codeId: string): Promise<schema.User[]>;

  // Demo Sessions
  createDemoSession(session: schema.InsertDemoSession): Promise<schema.DemoSession>;
  endDemoSession(id: string): Promise<void>;
  getDemoSessionStats(codeId: string): Promise<any>;
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

  async upsertUser(userData: schema.UpsertUser): Promise<schema.User> {
    const [user] = await db
      .insert(schema.users)
      .values(userData)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
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

  async listAllTenants(): Promise<schema.Tenant[]> {
    return db.select().from(schema.tenants);
  }

  async createTenant(insertTenant: schema.InsertTenant): Promise<schema.Tenant> {
    const [tenant] = await db.insert(schema.tenants).values(insertTenant).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<schema.InsertTenant>): Promise<schema.Tenant> {
    const [tenant] = await db
      .update(schema.tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.tenants.id, id))
      .returning();
    return tenant;
  }

  async deleteTenant(id: string): Promise<void> {
    // Soft delete - set isActive to false
    await db
      .update(schema.tenants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.tenants.id, id));
  }

  async getManagedProperties(userId: string): Promise<schema.Tenant[]> {
    // Get all tenants where user has account_admin role
    const adminRoles = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.tenants, eq(schema.userTenantRoles.tenantId, schema.tenants.id))
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.role, 'account_admin')
        )
      );

    // Collect community IDs and management company IDs
    const communityIds = new Set<string>();
    const managementCompanyIds = new Set<string>();

    for (const role of adminRoles) {
      const tenant = role.tenants;
      if (tenant.type === 'community') {
        communityIds.add(tenant.id);
      } else if (tenant.type === 'management_company') {
        managementCompanyIds.add(tenant.id);
      }
    }

    // Get all communities managed by the management companies
    if (managementCompanyIds.size > 0) {
      const managedCommunities = await db
        .select()
        .from(schema.tenants)
        .where(
          and(
            eq(schema.tenants.type, 'community'),
            inArray(schema.tenants.managementCompanyId, Array.from(managementCompanyIds))
          )
        );

      for (const community of managedCommunities) {
        communityIds.add(community.id);
      }
    }

    // Fetch all unique tenants (both management companies and communities)
    const allTenantIds = [...Array.from(managementCompanyIds), ...Array.from(communityIds)];

    if (allTenantIds.length === 0) {
      return [];
    }

    const tenants = await db
      .select()
      .from(schema.tenants)
      .where(inArray(schema.tenants.id, allTenantIds));

    return tenants;
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

  async getTenantUsers(tenantId: string): Promise<(schema.User & { roles: string[] })[]> {
    // Get all user-role assignments for this tenant
    const assignments = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.users, eq(schema.userTenantRoles.userId, schema.users.id))
      .where(eq(schema.userTenantRoles.tenantId, tenantId));

    // Group by user and aggregate roles
    const userMap = new Map<string, schema.User & { roles: string[] }>();

    for (const assignment of assignments) {
      const userId = assignment.user_tenant_roles.userId;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          ...assignment.users,
          roles: []
        });
      }
      userMap.get(userId)!.roles.push(assignment.user_tenant_roles.role);
    }

    return Array.from(userMap.values());
  }

  async removeUserRole(userId: string, tenantId: string, role: string): Promise<void> {
    await db
      .delete(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.role, role)
        )
      );
  }

  async removeUserFromTenant(userId: string, tenantId: string): Promise<void> {
    await db
      .delete(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.tenantId, tenantId)
        )
      );
  }

  // Form Templates
  async getFormTemplate(id: string): Promise<schema.FormTemplate | undefined> {
    const [template] = await db.select().from(schema.formTemplates).where(eq(schema.formTemplates.id, id));
    return template;
  }

  async getActiveFormTemplateForProjectType(tenantId: string, projectType: string): Promise<schema.FormTemplate | undefined> {
    const [template] = await db
      .select()
      .from(schema.formTemplates)
      .where(
        and(
          eq(schema.formTemplates.tenantId, tenantId),
          eq(schema.formTemplates.projectType, projectType),
          eq(schema.formTemplates.isActive, true)
        )
      )
      .orderBy(desc(schema.formTemplates.version)) // Get highest version if multiple somehow exist
      .limit(1);
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

  async getApplicationCountForYear(tenantId: string, year: number): Promise<number> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.tenantId, tenantId),
          sql`${schema.applications.submittedAt} >= ${startOfYear}`,
          sql`${schema.applications.submittedAt} < ${endOfYear}`
        )
      );

    return result[0]?.count || 0;
  }

  async listApplicationsForTenant(tenantId: string): Promise<schema.Application[]> {
    return db.select().from(schema.applications).where(eq(schema.applications.tenantId, tenantId));
  }

  async listApplicationsForUser(userId: string): Promise<schema.Application[]> {
    return db.select().from(schema.applications).where(eq(schema.applications.submittedByUserId, userId));
  }

  async listApplicationsByRole(role: string, tenantId: string, userId: string): Promise<schema.Application[]> {
    // Homeowner: only see their own applications
    if (role === 'homeowner' || role === 'delegated_rep') {
      return db.select().from(schema.applications).where(
        and(
          eq(schema.applications.tenantId, tenantId),
          eq(schema.applications.submittedByUserId, userId)
        )
      );
    }

    // Board members: see all applications for their tenant
    if (role === 'poa_board_member' || role === 'poa_board_contributor' || role === 'hoa_board_member') {
      return db.select().from(schema.applications).where(eq(schema.applications.tenantId, tenantId));
    }

    // Management roles: see all applications for their managed tenants
    if (role === 'management_rep' || role === 'management_manager' || role === 'account_admin') {
      return db.select().from(schema.applications).where(eq(schema.applications.tenantId, tenantId));
    }

    // Super admin: see all
    if (role === 'super_admin') {
      return db.select().from(schema.applications);
    }

    // Default: return empty
    return [];
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

  // Demo Codes
  async getDemoCode(id: string): Promise<schema.DemoCode | undefined> {
    const [code] = await db.select().from(schema.demoCodes).where(eq(schema.demoCodes.id, id));
    return code;
  }

  async getDemoCodeByCode(code: string): Promise<schema.DemoCode | undefined> {
    const [demoCode] = await db.select().from(schema.demoCodes).where(eq(schema.demoCodes.code, code));
    return demoCode;
  }

  async listDemoCodes(): Promise<schema.DemoCode[]> {
    return db.select().from(schema.demoCodes);
  }

  async createDemoCode(insertCode: schema.InsertDemoCode): Promise<schema.DemoCode> {
    const [code] = await db.insert(schema.demoCodes).values(insertCode).returning();
    return code;
  }

  async updateDemoCode(id: string, updates: Partial<Omit<schema.DemoCode, 'id' | 'createdAt' | 'updatedAt'>>): Promise<schema.DemoCode> {
    const [code] = await db
      .update(schema.demoCodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.demoCodes.id, id))
      .returning();
    return code;
  }

  async deleteDemoCode(id: string): Promise<void> {
    // Cascade delete handles all related data automatically
    await db.delete(schema.demoCodes).where(eq(schema.demoCodes.id, id));
  }

  async incrementDemoCodeUsage(id: string): Promise<void> {
    await db
      .update(schema.demoCodes)
      .set({ currentUses: sql`${schema.demoCodes.currentUses} + 1` })
      .where(eq(schema.demoCodes.id, id));
  }

  // Demo Users
  async getDemoUsersByCodeId(codeId: string): Promise<schema.User[]> {
    return db.select().from(schema.users).where(eq(schema.users.demoCodeId, codeId));
  }

  // Demo Sessions
  async createDemoSession(insertSession: schema.InsertDemoSession): Promise<schema.DemoSession> {
    const [session] = await db.insert(schema.demoSessions).values(insertSession).returning();
    return session;
  }

  async endDemoSession(id: string): Promise<void> {
    await db
      .update(schema.demoSessions)
      .set({ endedAt: new Date() })
      .where(eq(schema.demoSessions.id, id));
  }

  async getDemoSessionStats(codeId: string): Promise<any> {
    const sessions = await db
      .select()
      .from(schema.demoSessions)
      .where(eq(schema.demoSessions.demoCodeId, codeId));

    const activeSessions = sessions.filter(s => !s.endedAt);

    return {
      totalSessions: sessions.length,
      activeSessions: activeSessions.length,
      averageDuration: sessions
        .filter(s => s.endedAt)
        .reduce((acc, s) => {
          const duration = s.endedAt!.getTime() - s.startedAt.getTime();
          return acc + duration;
        }, 0) / sessions.filter(s => s.endedAt).length,
    };
  }
}

export const storage = new DbStorage();
