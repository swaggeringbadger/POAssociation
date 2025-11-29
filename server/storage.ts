import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, or, sql, inArray, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import { workflowEngine } from "./workflowEngine";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle({ client: pool, schema });

export { db };

export interface IStorage {
  // Users - Referenced from Replit Auth integration
  getUser(id: string): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  upsertUser(user: schema.UpsertUser): Promise<schema.User>;
  updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; phoneNumber?: string; email?: string; notificationPreferences?: any }): Promise<schema.User>;
  
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
  updateApplication(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      propertyAddress: string;
      formData: any;
      status: string;
      completenessScore: number;
    }>
  ): Promise<schema.Application>;
  updateApplicationStatus(
    id: string,
    status: string,
    reviewedByUserId?: string,
    reviewNotes?: string
  ): Promise<schema.Application>;
  deleteApplication(id: string): Promise<void>;

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

  // Workflow Templates
  getWorkflowTemplate(id: string): Promise<schema.WorkflowTemplate | undefined>;
  listWorkflowTemplatesForTenant(tenantId: string): Promise<schema.WorkflowTemplate[]>;
  createWorkflowTemplate(template: schema.InsertWorkflowTemplate): Promise<schema.WorkflowTemplate>;
  updateWorkflowTemplate(id: string, updates: Partial<schema.WorkflowTemplate>): Promise<schema.WorkflowTemplate>;
  cloneWorkflowTemplate(sourceId: string, name: string, description: string | undefined, userId: string): Promise<schema.WorkflowTemplate>;
  createWorkflowTemplateVersion(parentId: string, name: string, description: string | undefined, steps: any, userId: string): Promise<schema.WorkflowTemplate>;
  deleteWorkflowTemplate(id: string): Promise<void>;
  updateTenantWorkflow(tenantId: string, workflowTemplateId: string): Promise<schema.Tenant>;

  // Comments
  addComment(comment: schema.InsertComment): Promise<schema.Comment>;
  getApplicationComments(applicationId: string): Promise<(schema.Comment & { user: schema.User })[]>;
  updateCommentResolved(commentId: string, isResolved: boolean): Promise<schema.Comment>;

  // Application Workflows
  createApplicationWorkflow(workflow: schema.InsertApplicationWorkflow): Promise<schema.ApplicationWorkflow>;
  getApplicationWorkflow(applicationId: string): Promise<schema.ApplicationWorkflow | undefined>;
  advanceApplicationWorkflow(applicationId: string, action: string, userId: string, stepIndex: number, notes?: string): Promise<schema.ApplicationWorkflow>;
  getWorkflowActionHistory(applicationWorkflowId: string): Promise<schema.WorkflowStepAction[]>;

  // AI Form Generations
  createAiFormGeneration(generation: schema.InsertAiFormGeneration): Promise<schema.AiFormGeneration>;
  getAiFormGeneration(id: string): Promise<schema.AiFormGeneration | undefined>;
  listAiFormGenerations(tenantId?: string): Promise<schema.AiFormGeneration[]>;
  updateAiFormGenerationStatus(id: string, status: string, approvedByUserId?: string): Promise<schema.AiFormGeneration>;
  linkFormTemplateToGeneration(generationId: string, formTemplateId: string): Promise<schema.AiFormGeneration>;

  // Documents
  createDocument(document: schema.InsertDocument): Promise<schema.Document>;
  getDocument(id: string): Promise<schema.Document | undefined>;
  listDocumentsByApplication(applicationId: string): Promise<schema.Document[]>;
  deleteDocument(id: string): Promise<void>;
  getDocumentsByRequirement(applicationId: string, requirementName: string): Promise<schema.Document[]>;

  // Document Upload Tokens (QR Code Mobile Upload)
  createDocumentUploadToken(token: schema.InsertDocumentUploadToken): Promise<schema.DocumentUploadToken>;
  getDocumentUploadToken(token: string): Promise<schema.DocumentUploadToken | undefined>;
  markTokenAsUsed(token: string, uploadedDocumentId: string): Promise<schema.DocumentUploadToken>;
  cleanupExpiredTokens(): Promise<number>;

  // Signatures
  createSignature(signature: schema.InsertSignature): Promise<schema.Signature>;
  getSignature(id: string): Promise<schema.Signature | undefined>;
  getApplicationSignature(applicationId: string): Promise<schema.Signature | undefined>;
  listApplicationSignatures(applicationId: string): Promise<schema.Signature[]>;

  // Subscriptions
  listSubscriptionPlans(tenantType?: 'management_company' | 'community'): Promise<any[]>;
  getSubscriptionPlan(id: string): Promise<any | undefined>;
  getTenantSubscription(tenantId: string): Promise<any | undefined>;
  updateTenantSubscription(tenantId: string, planId: string, changedByUserId?: string, changeReason?: string): Promise<any>;
  updateSubscriptionUsage(tenantId: string, usage: { communities?: number; users?: number; storageGb?: number; forms?: number; applications?: number }): Promise<void>;
  checkFeatureAccess(tenantId: string, feature: string): Promise<{ hasAccess: boolean; limit: number | null; current: number; reason?: string }>;

  // Compliance Categories
  listComplianceCategories(tenantId?: string): Promise<schema.ComplianceCategory[]>;
  getComplianceCategory(id: string): Promise<schema.ComplianceCategory | undefined>;
  createComplianceCategory(category: schema.InsertComplianceCategory): Promise<schema.ComplianceCategory>;

  // Compliance Items
  listComplianceItems(filters: {
    scope?: string;
    propertyId?: string;
    managementCompanyId?: string;
    categoryId?: string;
    status?: string;
    dueBefore?: Date;
    dueAfter?: Date;
  }): Promise<(schema.ComplianceItem & { category: schema.ComplianceCategory })[]>;
  getComplianceItem(id: string): Promise<(schema.ComplianceItem & { category: schema.ComplianceCategory; documents: schema.ComplianceDocument[] }) | undefined>;
  createComplianceItem(item: schema.InsertComplianceItem): Promise<schema.ComplianceItem>;
  updateComplianceItem(id: string, updates: Partial<schema.InsertComplianceItem>): Promise<schema.ComplianceItem>;
  deleteComplianceItem(id: string): Promise<void>;
  completeComplianceItem(id: string, userId: string, notes?: string): Promise<schema.ComplianceItem>;
  reopenComplianceItem(id: string): Promise<schema.ComplianceItem>;

  // Compliance Dashboard
  getComplianceDashboard(tenantIds: string[]): Promise<{
    upcoming: schema.ComplianceItem[];
    overdue: schema.ComplianceItem[];
    completedThisMonth: number;
    stats: { total: number; pending: number; overdue: number; completed: number };
  }>;

  // Compliance Documents
  createComplianceDocument(doc: schema.InsertComplianceDocument): Promise<schema.ComplianceDocument>;
  listComplianceDocuments(itemId: string): Promise<schema.ComplianceDocument[]>;
  getComplianceDocument(id: string): Promise<schema.ComplianceDocument | undefined>;
  deleteComplianceDocument(id: string): Promise<void>;

  // Event Types
  listEventTypes(): Promise<schema.EventType[]>;
  getEventType(id: string): Promise<schema.EventType | undefined>;

  // Events
  listEvents(filters: {
    tenantId?: string;
    tenantIds?: string[];
    eventTypeId?: string;
    status?: string;
    startAfter?: Date;
    startBefore?: Date;
  }): Promise<(schema.Event & { eventType: schema.EventType })[]>;
  getEvent(id: string): Promise<(schema.Event & {
    eventType: schema.EventType;
    attendees: schema.EventAttendee[];
    documents: schema.EventDocument[];
    applications: (schema.EventApplication & { application: schema.Application })[];
  }) | undefined>;
  createEvent(event: schema.InsertEvent): Promise<schema.Event>;
  updateEvent(id: string, updates: Partial<schema.InsertEvent>): Promise<schema.Event>;
  deleteEvent(id: string): Promise<void>;
  completeEvent(id: string): Promise<schema.Event>;
  cancelEvent(id: string): Promise<schema.Event>;

  // Event Attendees
  listEventAttendees(eventId: string): Promise<schema.EventAttendee[]>;
  addEventAttendee(attendee: schema.InsertEventAttendee): Promise<schema.EventAttendee>;
  updateEventAttendee(id: string, updates: Partial<schema.InsertEventAttendee>): Promise<schema.EventAttendee>;
  removeEventAttendee(id: string): Promise<void>;

  // Event Documents
  listEventDocuments(eventId: string): Promise<schema.EventDocument[]>;
  createEventDocument(doc: schema.InsertEventDocument): Promise<schema.EventDocument>;
  getEventDocument(id: string): Promise<schema.EventDocument | undefined>;
  deleteEventDocument(id: string): Promise<void>;

  // Event Applications (Review Packets)
  listEventApplications(eventId: string): Promise<(schema.EventApplication & { application: schema.Application })[]>;
  addEventApplication(link: schema.InsertEventApplication): Promise<schema.EventApplication>;
  updateEventApplication(id: string, updates: Partial<schema.InsertEventApplication>): Promise<schema.EventApplication>;
  removeEventApplication(id: string): Promise<void>;

  // Calendar View
  getCalendarEvents(tenantIds: string[], startDate: Date, endDate: Date): Promise<(schema.Event & { eventType: schema.EventType })[]>;
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

  async updateUserProfile(userId: string, updates: { firstName?: string; lastName?: string; phoneNumber?: string; email?: string }): Promise<schema.User> {
    const [user] = await db
      .update(schema.users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, userId))
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

  async listApplicationsByRole(role: string, tenantId: string, userId: string): Promise<(schema.Application & { workflowStage?: string })[]> {
    let applications: schema.Application[] = [];

    // Homeowner: only see their own applications
    if (role === 'homeowner' || role === 'delegated_rep') {
      applications = await db.select().from(schema.applications).where(
        and(
          eq(schema.applications.tenantId, tenantId),
          eq(schema.applications.submittedByUserId, userId)
        )
      );
    }
    // Board members: see all applications for their tenant
    else if (role === 'poa_board_member' || role === 'poa_board_contributor' || role === 'hoa_board_member') {
      applications = await db.select().from(schema.applications).where(eq(schema.applications.tenantId, tenantId));
    }
    // Management roles: see all applications for their managed tenants
    else if (role === 'management_rep' || role === 'management_manager' || role === 'account_admin') {
      // First check if the current tenant is a management company
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return [];
      
      if (tenant.type === 'management_company') {
        // Get all communities managed by this management company
        const communities = await db
          .select()
          .from(schema.tenants)
          .where(
            and(
              eq(schema.tenants.type, 'community'),
              eq(schema.tenants.managementCompanyId, tenantId)
            )
          );
        
        const communityIds = communities.map(c => c.id);
        if (communityIds.length === 0) return [];
        
        // Return applications from all managed communities
        applications = await db.select().from(schema.applications).where(
          inArray(schema.applications.tenantId, communityIds)
        );
      } else {
        // Single community tenant
        applications = await db.select().from(schema.applications).where(eq(schema.applications.tenantId, tenantId));
      }
    }
    // Super admin: see all
    else if (role === 'super_admin') {
      applications = await db.select().from(schema.applications);
    }

    // Enrich with workflow stage and tenant name info
    const enriched = await Promise.all(
      applications.map(async (app) => {
        const workflow = await this.getApplicationWorkflow(app.id);
        const tenant = await this.getTenant(app.tenantId);
        
        let workflowStage: string | undefined;
        if (workflow) {
          const template = await this.getWorkflowTemplate(workflow.workflowTemplateId);
          const steps = (template?.steps as any[]) || [];
          const currentStep = steps[workflow.currentStepIndex];
          workflowStage = currentStep?.title || 'Unknown';
        }
        
        return {
          ...app,
          workflowStage,
          tenantName: tenant?.name
        };
      })
    );

    return enriched;
  }

  async createApplication(insertApplication: schema.InsertApplication): Promise<schema.Application> {
    const [application] = await db.insert(schema.applications).values(insertApplication).returning();
    return application;
  }

  async updateApplication(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      propertyAddress: string;
      formData: any;
      status: string;
      completenessScore: number;
      signatureId: string;
    }>
  ): Promise<schema.Application> {
    const [application] = await db
      .update(schema.applications)
      .set(updates)
      .where(eq(schema.applications.id, id))
      .returning();
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

  async deleteApplication(id: string): Promise<void> {
    await db.delete(schema.applications).where(eq(schema.applications.id, id));
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

  // Workflow Templates
  async getWorkflowTemplate(id: string): Promise<schema.WorkflowTemplate | undefined> {
    const [template] = await db.select().from(schema.workflowTemplates).where(eq(schema.workflowTemplates.id, id));
    return template;
  }

  async listWorkflowTemplatesForTenant(tenantId: string): Promise<schema.WorkflowTemplate[]> {
    return db.select().from(schema.workflowTemplates).where(eq(schema.workflowTemplates.tenantId, tenantId));
  }

  async createWorkflowTemplate(template: schema.InsertWorkflowTemplate): Promise<schema.WorkflowTemplate> {
    const [created] = await db.insert(schema.workflowTemplates).values(template).returning();
    return created;
  }

  async updateWorkflowTemplate(id: string, updates: Partial<schema.WorkflowTemplate>): Promise<schema.WorkflowTemplate> {
    const [updated] = await db.update(schema.workflowTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.workflowTemplates.id, id))
      .returning();
    return updated;
  }

  async cloneWorkflowTemplate(
    sourceId: string,
    name: string,
    description: string | undefined,
    userId: string
  ): Promise<schema.WorkflowTemplate> {
    const source = await this.getWorkflowTemplate(sourceId);
    if (!source) throw new Error("Source template not found");

    const cloned: schema.InsertWorkflowTemplate = {
      tenantId: source.tenantId,
      name,
      description: description || source.description,
      steps: source.steps,
      isActive: false,
      version: 1,
      parentTemplateId: sourceId,
      isBlueprint: false,
      createdByUserId: userId,
    };

    return this.createWorkflowTemplate(cloned);
  }

  async createWorkflowTemplateVersion(
    parentId: string,
    name: string,
    description: string | undefined,
    steps: any,
    userId: string
  ): Promise<schema.WorkflowTemplate> {
    const parent = await this.getWorkflowTemplate(parentId);
    if (!parent) throw new Error("Parent template not found");

    // Get highest version number for this template lineage
    const parentTemplateId = parent.parentTemplateId || parentId;
    const versions = await db.select()
      .from(schema.workflowTemplates)
      .where(
        and(
          eq(schema.workflowTemplates.tenantId, parent.tenantId),
          or(
            eq(schema.workflowTemplates.id, parentTemplateId),
            eq(schema.workflowTemplates.parentTemplateId, parentTemplateId)
          )
        )
      );

    const maxVersion = Math.max(...versions.map(v => v.version || 1));

    const newVersion: schema.InsertWorkflowTemplate = {
      tenantId: parent.tenantId,
      name,
      description: description || parent.description,
      steps,
      isActive: false,
      version: maxVersion + 1,
      parentTemplateId: parentTemplateId,
      isBlueprint: false,
      createdByUserId: userId,
    };

    return this.createWorkflowTemplate(newVersion);
  }

  async deleteWorkflowTemplate(id: string): Promise<void> {
    await db.delete(schema.workflowTemplates).where(eq(schema.workflowTemplates.id, id));
  }

  async updateTenantWorkflow(tenantId: string, workflowTemplateId: string): Promise<schema.Tenant> {
    const [updated] = await db.update(schema.tenants).set({ workflowTemplateId }).where(eq(schema.tenants.id, tenantId)).returning();
    return updated;
  }

  // Comments
  async addComment(comment: schema.InsertComment): Promise<schema.Comment> {
    const [created] = await db.insert(schema.comments).values(comment).returning();
    return created;
  }

  async getApplicationComments(applicationId: string): Promise<(schema.Comment & { user: schema.User })[]> {
    return db.select().from(schema.comments)
      .innerJoin(schema.users, eq(schema.comments.userId, schema.users.id))
      .where(eq(schema.comments.applicationId, applicationId))
      .orderBy(schema.comments.createdAt);
  }

  async updateCommentResolved(commentId: string, isResolved: boolean): Promise<schema.Comment> {
    const [updated] = await db.update(schema.comments).set({ isResolved }).where(eq(schema.comments.id, commentId)).returning();
    return updated;
  }

  // Application Workflows
  async createApplicationWorkflow(workflow: schema.InsertApplicationWorkflow): Promise<schema.ApplicationWorkflow> {
    const [created] = await db.insert(schema.applicationWorkflows).values(workflow).returning();
    return created;
  }

  async getApplicationWorkflow(applicationId: string): Promise<schema.ApplicationWorkflow | undefined> {
    const [workflow] = await db.select().from(schema.applicationWorkflows).where(eq(schema.applicationWorkflows.applicationId, applicationId));
    return workflow;
  }

  async advanceApplicationWorkflow(applicationId: string, action: string, userId: string, stepIndex: number, notes?: string): Promise<schema.ApplicationWorkflow> {
    const workflow = await this.getApplicationWorkflow(applicationId);
    if (!workflow) throw new Error("Workflow not found");

    const template = await this.getWorkflowTemplate(workflow.workflowTemplateId);
    if (!template) throw new Error("Workflow template not found");

    const application = await this.getApplication(applicationId);
    if (!application) throw new Error("Application not found");

    const steps = template.steps as any[];
    let nextStepIndex: number;
    let status: "in_progress" | "completed" | "halted" = "in_progress";
    let completedAt: Date | null = null;

    // Check if this is an enhanced workflow (has step IDs and transitions)
    const isEnhancedWorkflow = steps[0] && typeof steps[0] === 'object' && 'id' in steps[0];

    if (isEnhancedWorkflow) {
      // Use WorkflowEngine for enhanced workflows with branching
      const currentStep = steps[workflow.currentStepIndex];

      const nextStepId = workflowEngine.getNextStep(currentStep, {
        formData: application.formData || {},
        action,
        userId,
        applicationId
      });

      if (!nextStepId) {
        // No next step - workflow is complete
        status = "completed";
        completedAt = new Date();
        nextStepIndex = workflow.currentStepIndex; // Stay at current step
      } else {
        // Find the next step by ID
        nextStepIndex = steps.findIndex((s: any) => s.id === nextStepId);
        if (nextStepIndex === -1) {
          throw new Error(`Invalid workflow: next step ${nextStepId} not found`);
        }
      }
    } else {
      // Legacy linear workflow - simple increment
      nextStepIndex = workflow.currentStepIndex + 1;

      if (action === "approved" || action === "rejected" || action === "conditionally_approved") {
        if (nextStepIndex >= steps.length) {
          status = "completed";
          completedAt = new Date();
          nextStepIndex = workflow.currentStepIndex; // Stay at current step
        }
      }
    }

    // Update workflow
    const [updated] = await db.update(schema.applicationWorkflows)
      .set({ currentStepIndex: nextStepIndex, status, completedAt })
      .where(eq(schema.applicationWorkflows.id, workflow.id))
      .returning();

    // Log action
    await db.insert(schema.workflowStepActions).values({
      applicationWorkflowId: workflow.id,
      stepIndex,
      action,
      userId,
      notes,
    });

    return updated;
  }

  async getWorkflowActionHistory(applicationWorkflowId: string): Promise<schema.WorkflowStepAction[]> {
    return db.select().from(schema.workflowStepActions).where(eq(schema.workflowStepActions.applicationWorkflowId, applicationWorkflowId)).orderBy(desc(schema.workflowStepActions.createdAt));
  }

  // AI Form Generations
  async createAiFormGeneration(generation: schema.InsertAiFormGeneration): Promise<schema.AiFormGeneration> {
    const [created] = await db.insert(schema.aiFormGenerations).values(generation).returning();
    return created;
  }

  async getAiFormGeneration(id: string): Promise<schema.AiFormGeneration | undefined> {
    const [generation] = await db.select().from(schema.aiFormGenerations).where(eq(schema.aiFormGenerations.id, id));
    return generation;
  }

  async listAiFormGenerations(tenantId?: string): Promise<schema.AiFormGeneration[]> {
    if (tenantId) {
      return db.select().from(schema.aiFormGenerations)
        .where(eq(schema.aiFormGenerations.tenantId, tenantId))
        .orderBy(desc(schema.aiFormGenerations.createdAt));
    }
    return db.select().from(schema.aiFormGenerations).orderBy(desc(schema.aiFormGenerations.createdAt));
  }

  async updateAiFormGenerationStatus(id: string, status: string, approvedByUserId?: string): Promise<schema.AiFormGeneration> {
    const updates: any = { status };
    if (approvedByUserId) {
      updates.approvedByUserId = approvedByUserId;
      updates.approvedAt = new Date();
    }

    const [updated] = await db.update(schema.aiFormGenerations)
      .set(updates)
      .where(eq(schema.aiFormGenerations.id, id))
      .returning();
    return updated;
  }

  async linkFormTemplateToGeneration(generationId: string, formTemplateId: string): Promise<schema.AiFormGeneration> {
    const [updated] = await db.update(schema.aiFormGenerations)
      .set({ formTemplateId })
      .where(eq(schema.aiFormGenerations.id, generationId))
      .returning();
    return updated;
  }

  // Documents
  async createDocument(document: schema.InsertDocument): Promise<schema.Document> {
    const [created] = await db.insert(schema.documents)
      .values(document)
      .returning();
    return created;
  }

  async getDocument(id: string): Promise<schema.Document | undefined> {
    const [document] = await db.select()
      .from(schema.documents)
      .where(eq(schema.documents.id, id))
      .limit(1);
    return document;
  }

  async listDocumentsByApplication(applicationId: string): Promise<schema.Document[]> {
    return await db.select()
      .from(schema.documents)
      .where(eq(schema.documents.applicationId, applicationId))
      .orderBy(schema.documents.uploadedAt);
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(schema.documents)
      .where(eq(schema.documents.id, id));
  }

  async getDocumentsByRequirement(applicationId: string, requirementName: string): Promise<schema.Document[]> {
    return await db.select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.applicationId, applicationId),
          eq(schema.documents.documentRequirementName, requirementName)
        )
      )
      .orderBy(schema.documents.uploadedAt);
  }

  // Document Upload Tokens (QR Code Mobile Upload)
  async createDocumentUploadToken(token: schema.InsertDocumentUploadToken): Promise<schema.DocumentUploadToken> {
    const [created] = await db.insert(schema.documentUploadTokens)
      .values(token)
      .returning();
    return created;
  }

  async getDocumentUploadToken(token: string): Promise<schema.DocumentUploadToken | undefined> {
    const [uploadToken] = await db.select()
      .from(schema.documentUploadTokens)
      .where(eq(schema.documentUploadTokens.token, token));
    return uploadToken;
  }

  async markTokenAsUsed(token: string, uploadedDocumentId: string): Promise<schema.DocumentUploadToken> {
    const [updated] = await db.update(schema.documentUploadTokens)
      .set({
        isUsed: true,
        uploadedDocumentId,
        usedAt: new Date(),
      })
      .where(eq(schema.documentUploadTokens.token, token))
      .returning();
    return updated;
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await db.delete(schema.documentUploadTokens)
      .where(sql`${schema.documentUploadTokens.expiresAt} < NOW()`);
    return result.rowCount || 0;
  }

  // Signatures
  async createSignature(signature: schema.InsertSignature): Promise<schema.Signature> {
    const [created] = await db.insert(schema.signatures)
      .values(signature)
      .returning();
    return created;
  }

  async getSignature(id: string): Promise<schema.Signature | undefined> {
    const [signature] = await db.select()
      .from(schema.signatures)
      .where(eq(schema.signatures.id, id))
      .limit(1);
    return signature;
  }

  async getApplicationSignature(applicationId: string): Promise<schema.Signature | undefined> {
    const [signature] = await db.select()
      .from(schema.signatures)
      .where(
        and(
          eq(schema.signatures.applicationId, applicationId),
          eq(schema.signatures.type, 'signature')
        )
      )
      .orderBy(desc(schema.signatures.signedAt))
      .limit(1);
    return signature;
  }

  async listApplicationSignatures(applicationId: string): Promise<schema.Signature[]> {
    return await db.select()
      .from(schema.signatures)
      .where(eq(schema.signatures.applicationId, applicationId))
      .orderBy(desc(schema.signatures.signedAt));
  }

  // Subscriptions
  async listSubscriptionPlans(tenantType?: 'management_company' | 'community'): Promise<any[]> {
    let query;
    if (tenantType) {
      const pattern = tenantType === 'management_company' ? 'management_%' : 'community_%';
      query = sql`
        SELECT * FROM subscription_plans
        WHERE is_active = true
        AND plan_type::text LIKE ${pattern}
        ORDER BY sort_order ASC
      `;
    } else {
      query = sql`
        SELECT * FROM subscription_plans
        WHERE is_active = true
        ORDER BY sort_order ASC
      `;
    }
    const result = await db.execute(query);

    // Transform to camelCase
    return result.rows.map((row: any) => ({
      id: row.id,
      planType: row.plan_type,
      name: row.name,
      description: row.description,
      priceMonthly: parseFloat(row.price_monthly),
      priceYearly: parseFloat(row.price_yearly),
      maxCommunities: row.max_communities,
      maxUsers: row.max_users,
      maxStorageGb: row.max_storage_gb,
      maxForms: row.max_forms,
      maxApplicationsPerMonth: row.max_applications_per_month,
      customBranding: row.custom_branding,
      aiFormGeneration: row.ai_form_generation,
      advancedReporting: row.advanced_reporting,
      apiAccess: row.api_access,
      customWorkflows: row.custom_workflows,
      whiteLabel: row.white_label,
      prioritySupport: row.priority_support,
      sso: row.sso,
      auditLogs: row.audit_logs,
      isActive: row.is_active,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getSubscriptionPlan(id: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM subscription_plans WHERE id = ${id} LIMIT 1
    `);
    return result.rows[0] as any;
  }

  async getTenantSubscription(tenantId: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT
        ts.id,
        ts.tenant_id,
        ts.plan_id,
        ts.status,
        ts.current_period_start,
        ts.current_period_end,
        ts.trial_ends_at,
        ts.canceled_at,
        ts.external_subscription_id,
        ts.external_customer_id,
        ts.usage_communities,
        ts.usage_users,
        ts.usage_storage_gb,
        ts.usage_forms,
        ts.usage_applications_current_month,
        ts.usage_reset_at,
        ts.created_at as subscription_created_at,
        ts.updated_at as subscription_updated_at,
        sp.id as plan_id,
        sp.plan_type,
        sp.name as plan_name,
        sp.description as plan_description,
        sp.price_monthly,
        sp.price_yearly,
        sp.max_communities,
        sp.max_users,
        sp.max_storage_gb,
        sp.max_forms,
        sp.max_applications_per_month,
        sp.custom_branding,
        sp.ai_form_generation,
        sp.advanced_reporting,
        sp.api_access,
        sp.custom_workflows,
        sp.white_label,
        sp.priority_support,
        sp.sso,
        sp.audit_logs,
        sp.is_active as plan_is_active,
        sp.sort_order,
        sp.created_at as plan_created_at,
        sp.updated_at as plan_updated_at
      FROM tenant_subscriptions ts
      JOIN subscription_plans sp ON ts.plan_id = sp.id
      WHERE ts.tenant_id = ${tenantId}
      LIMIT 1
    `);

    const row = result.rows[0] as any;
    if (!row) return undefined;

    // Transform to camelCase and structure with nested plan
    return {
      id: row.id,
      tenantId: row.tenant_id,
      planId: row.plan_id,
      plan: {
        id: row.plan_id,
        planType: row.plan_type,
        name: row.plan_name,
        description: row.plan_description,
        priceMonthly: parseFloat(row.price_monthly),
        priceYearly: parseFloat(row.price_yearly),
        maxCommunities: row.max_communities,
        maxUsers: row.max_users,
        maxStorageGb: row.max_storage_gb,
        maxForms: row.max_forms,
        maxApplicationsPerMonth: row.max_applications_per_month,
        customBranding: row.custom_branding,
        aiFormGeneration: row.ai_form_generation,
        advancedReporting: row.advanced_reporting,
        apiAccess: row.api_access,
        customWorkflows: row.custom_workflows,
        whiteLabel: row.white_label,
        prioritySupport: row.priority_support,
        sso: row.sso,
        auditLogs: row.audit_logs,
        isActive: row.plan_is_active,
        sortOrder: row.sort_order,
        createdAt: row.plan_created_at,
        updatedAt: row.plan_updated_at,
      },
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      trialEndsAt: row.trial_ends_at,
      canceledAt: row.canceled_at,
      externalSubscriptionId: row.external_subscription_id,
      externalCustomerId: row.external_customer_id,
      usageCommunities: row.usage_communities,
      usageUsers: row.usage_users,
      usageStorageGb: parseFloat(row.usage_storage_gb),
      usageForms: row.usage_forms,
      usageApplicationsCurrentMonth: row.usage_applications_current_month,
      usageResetAt: row.usage_reset_at,
      createdAt: row.subscription_created_at,
      updatedAt: row.subscription_updated_at,
    };
  }

  async updateTenantSubscription(
    tenantId: string,
    planId: string,
    changedByUserId?: string,
    changeReason?: string
  ): Promise<any> {
    // Get current subscription
    const current = await this.getTenantSubscription(tenantId);

    // Archive current subscription in history (disabled until table is created)
    // if (current) {
    //   await db.execute(sql`
    //     INSERT INTO subscription_history (tenant_id, plan_id, status, period_start, period_end, changed_by_user_id, change_reason)
    //     VALUES (${tenantId}, ${current.plan_id}, ${current.status}, ${current.current_period_start}, NOW(), ${changedByUserId || null}, ${changeReason || null})
    //   `);
    // }

    // Update or create new subscription
    const result = await db.execute(sql`
      INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, current_period_start, current_period_end)
      VALUES (${tenantId}, ${planId}, 'active', NOW(), NOW() + INTERVAL '1 month')
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        plan_id = ${planId},
        status = 'active',
        current_period_start = NOW(),
        current_period_end = NOW() + INTERVAL '1 month',
        updated_at = NOW()
      RETURNING *
    `);

    return result.rows[0] as any;
  }

  async updateSubscriptionUsage(
    tenantId: string,
    usage: { communities?: number; users?: number; storageGb?: number; forms?: number; applications?: number }
  ): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [];

    if (usage.communities !== undefined) {
      updates.push('usage_communities = $' + (values.length + 1));
      values.push(usage.communities);
    }
    if (usage.users !== undefined) {
      updates.push('usage_users = $' + (values.length + 1));
      values.push(usage.users);
    }
    if (usage.storageGb !== undefined) {
      updates.push('usage_storage_gb = $' + (values.length + 1));
      values.push(usage.storageGb);
    }
    if (usage.forms !== undefined) {
      updates.push('usage_forms = $' + (values.length + 1));
      values.push(usage.forms);
    }
    if (usage.applications !== undefined) {
      updates.push('usage_applications_current_month = $' + (values.length + 1));
      values.push(usage.applications);
    }

    if (updates.length > 0) {
      values.push(tenantId);
      await db.execute(sql.raw(`
        UPDATE tenant_subscriptions
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE tenant_id = $${values.length}
      `));
    }
  }

  async checkFeatureAccess(
    tenantId: string,
    feature: string
  ): Promise<{ hasAccess: boolean; limit: number | null; current: number; reason?: string }> {
    // In development mode, allow all features if subscription system isn't set up
    if (process.env.NODE_ENV === 'development') {
      try {
        const subscription = await this.getTenantSubscription(tenantId);
        if (!subscription) {
          // Grant access in development when subscription table doesn't exist
          return { hasAccess: true, limit: null, current: 0, reason: 'Development mode - no subscription required' };
        }
      } catch (error: any) {
        // If tenant_subscriptions table doesn't exist, allow access in development
        if (error.message?.includes('relation "tenant_subscriptions" does not exist')) {
          return { hasAccess: true, limit: null, current: 0, reason: 'Development mode - subscription table not created' };
        }
        throw error;
      }
    }

    const subscription = await this.getTenantSubscription(tenantId);

    if (!subscription) {
      return { hasAccess: false, limit: 0, current: 0, reason: 'No active subscription' };
    }

    // Map feature names to plan columns and usage columns
    const featureMap: Record<string, { planColumn: string; usageColumn?: string; flag?: boolean }> = {
      'communities': { planColumn: 'max_communities', usageColumn: 'usage_communities' },
      'users': { planColumn: 'max_users', usageColumn: 'usage_users' },
      'storage': { planColumn: 'max_storage_gb', usageColumn: 'usage_storage_gb' },
      'forms': { planColumn: 'max_forms', usageColumn: 'usage_forms' },
      'applications': { planColumn: 'max_applications_per_month', usageColumn: 'usage_applications_current_month' },
      'custom_branding': { planColumn: 'custom_branding', flag: true },
      'ai_form_generation': { planColumn: 'ai_form_generation', flag: true },
      'advanced_reporting': { planColumn: 'advanced_reporting', flag: true },
      'api_access': { planColumn: 'api_access', flag: true },
      'custom_workflows': { planColumn: 'custom_workflows', flag: true },
      'white_label': { planColumn: 'white_label', flag: true },
      'priority_support': { planColumn: 'priority_support', flag: true },
      'sso': { planColumn: 'sso', flag: true },
      'audit_logs': { planColumn: 'audit_logs', flag: true },
    };

    const mapping = featureMap[feature];
    if (!mapping) {
      return { hasAccess: false, limit: 0, current: 0, reason: 'Unknown feature' };
    }

    // For boolean flags
    if (mapping.flag) {
      const hasAccess = subscription[mapping.planColumn] === true;
      return {
        hasAccess,
        limit: null,
        current: 0,
        reason: hasAccess ? undefined : `Feature "${feature}" not available in current plan`,
      };
    }

    // For limits
    const limit = subscription[mapping.planColumn];
    const current = mapping.usageColumn ? subscription[mapping.usageColumn] : 0;

    if (limit === null) {
      // Unlimited
      return { hasAccess: true, limit: null, current };
    }

    const hasAccess = current < limit;
    return {
      hasAccess,
      limit,
      current,
      reason: hasAccess ? undefined : `Limit reached: ${current}/${limit} ${feature} used`,
    };
  }

  // ============================================
  // COMPLIANCE METHODS
  // ============================================

  // Compliance Categories
  async listComplianceCategories(tenantId?: string): Promise<schema.ComplianceCategory[]> {
    // Get system categories (tenantId is null) plus tenant-specific ones
    const conditions = tenantId
      ? or(eq(schema.complianceCategories.isSystem, true), eq(schema.complianceCategories.tenantId, tenantId))
      : eq(schema.complianceCategories.isSystem, true);

    return db
      .select()
      .from(schema.complianceCategories)
      .where(conditions)
      .orderBy(schema.complianceCategories.sortOrder);
  }

  async getComplianceCategory(id: string): Promise<schema.ComplianceCategory | undefined> {
    const [category] = await db
      .select()
      .from(schema.complianceCategories)
      .where(eq(schema.complianceCategories.id, id));
    return category;
  }

  async createComplianceCategory(category: schema.InsertComplianceCategory): Promise<schema.ComplianceCategory> {
    const [created] = await db
      .insert(schema.complianceCategories)
      .values(category)
      .returning();
    return created;
  }

  // Compliance Items
  async listComplianceItems(filters: {
    scope?: string;
    propertyId?: string;
    managementCompanyId?: string;
    categoryId?: string;
    status?: string;
    dueBefore?: Date;
    dueAfter?: Date;
  }): Promise<(schema.ComplianceItem & { category: schema.ComplianceCategory })[]> {
    const conditions = [];

    if (filters.scope) {
      conditions.push(eq(schema.complianceItems.scope, filters.scope));
    }
    if (filters.propertyId) {
      conditions.push(eq(schema.complianceItems.propertyId, filters.propertyId));
    }
    if (filters.managementCompanyId) {
      conditions.push(eq(schema.complianceItems.managementCompanyId, filters.managementCompanyId));
    }
    if (filters.categoryId) {
      conditions.push(eq(schema.complianceItems.categoryId, filters.categoryId));
    }
    if (filters.status && filters.status !== 'all') {
      conditions.push(eq(schema.complianceItems.status, filters.status));
    }
    if (filters.dueBefore) {
      conditions.push(sql`${schema.complianceItems.dueDate} <= ${filters.dueBefore}`);
    }
    if (filters.dueAfter) {
      conditions.push(sql`${schema.complianceItems.dueDate} >= ${filters.dueAfter}`);
    }

    const items = await db
      .select({
        item: schema.complianceItems,
        category: schema.complianceCategories,
      })
      .from(schema.complianceItems)
      .innerJoin(schema.complianceCategories, eq(schema.complianceItems.categoryId, schema.complianceCategories.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.complianceItems.dueDate);

    return items.map(({ item, category }) => ({ ...item, category }));
  }

  async getComplianceItem(id: string): Promise<(schema.ComplianceItem & { category: schema.ComplianceCategory; documents: schema.ComplianceDocument[] }) | undefined> {
    const [result] = await db
      .select({
        item: schema.complianceItems,
        category: schema.complianceCategories,
      })
      .from(schema.complianceItems)
      .innerJoin(schema.complianceCategories, eq(schema.complianceItems.categoryId, schema.complianceCategories.id))
      .where(eq(schema.complianceItems.id, id));

    if (!result) return undefined;

    const documents = await db
      .select()
      .from(schema.complianceDocuments)
      .where(eq(schema.complianceDocuments.complianceItemId, id))
      .orderBy(desc(schema.complianceDocuments.uploadedAt));

    return { ...result.item, category: result.category, documents };
  }

  async createComplianceItem(item: schema.InsertComplianceItem): Promise<schema.ComplianceItem> {
    // Calculate initial status based on due date
    const now = new Date();
    const dueDate = new Date(item.dueDate);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let status = 'pending';
    if (dueDate < now) {
      status = 'overdue';
    } else if (dueDate <= thirtyDaysFromNow) {
      status = 'upcoming';
    }

    const [created] = await db
      .insert(schema.complianceItems)
      .values({ ...item, status })
      .returning();
    return created;
  }

  async updateComplianceItem(id: string, updates: Partial<schema.InsertComplianceItem>): Promise<schema.ComplianceItem> {
    const [updated] = await db
      .update(schema.complianceItems)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.complianceItems.id, id))
      .returning();
    return updated;
  }

  async deleteComplianceItem(id: string): Promise<void> {
    await db.delete(schema.complianceItems).where(eq(schema.complianceItems.id, id));
  }

  async completeComplianceItem(id: string, userId: string, notes?: string): Promise<schema.ComplianceItem> {
    const item = await this.getComplianceItem(id);
    if (!item) throw new Error("Compliance item not found");

    const updateData: Partial<schema.InsertComplianceItem> = {
      status: 'completed',
      completedDate: new Date(),
      completedByUserId: userId,
    };
    if (notes) {
      updateData.notes = (item.notes ? item.notes + '\n\n' : '') + `Completed: ${notes}`;
    }

    // If recurring, calculate next due date
    if (item.recurrencePattern !== 'none') {
      const nextDue = this.calculateNextDueDate(item.dueDate, item.recurrencePattern);
      updateData.nextDueDate = nextDue;
    }

    return this.updateComplianceItem(id, updateData);
  }

  async reopenComplianceItem(id: string): Promise<schema.ComplianceItem> {
    const now = new Date();
    const item = await this.getComplianceItem(id);
    if (!item) throw new Error("Compliance item not found");

    const dueDate = new Date(item.dueDate);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let status = 'pending';
    if (dueDate < now) {
      status = 'overdue';
    } else if (dueDate <= thirtyDaysFromNow) {
      status = 'upcoming';
    }

    return this.updateComplianceItem(id, {
      status,
      completedDate: null,
      completedByUserId: null,
    });
  }

  private calculateNextDueDate(currentDue: Date, pattern: string): Date {
    const date = new Date(currentDue);
    switch (pattern) {
      case 'annual':
        date.setFullYear(date.getFullYear() + 1);
        break;
      case 'semi_annual':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
    }
    return date;
  }

  // Compliance Dashboard
  async getComplianceDashboard(tenantIds: string[]): Promise<{
    upcoming: schema.ComplianceItem[];
    overdue: schema.ComplianceItem[];
    completedThisMonth: number;
    stats: { total: number; pending: number; overdue: number; completed: number };
  }> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all items for these tenants
    const allItems = await db
      .select()
      .from(schema.complianceItems)
      .where(
        or(
          inArray(schema.complianceItems.propertyId, tenantIds),
          inArray(schema.complianceItems.managementCompanyId, tenantIds)
        )
      );

    const upcoming = allItems.filter(i =>
      i.status !== 'completed' &&
      new Date(i.dueDate) > now &&
      new Date(i.dueDate) <= thirtyDaysFromNow
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const overdue = allItems.filter(i =>
      i.status !== 'completed' &&
      new Date(i.dueDate) < now
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const completedThisMonth = allItems.filter(i =>
      i.status === 'completed' &&
      i.completedDate &&
      new Date(i.completedDate) >= startOfMonth
    ).length;

    const stats = {
      total: allItems.length,
      pending: allItems.filter(i => i.status === 'pending' || i.status === 'upcoming').length,
      overdue: overdue.length,
      completed: allItems.filter(i => i.status === 'completed').length,
    };

    return { upcoming, overdue, completedThisMonth, stats };
  }

  // Compliance Documents
  async createComplianceDocument(doc: schema.InsertComplianceDocument): Promise<schema.ComplianceDocument> {
    const [created] = await db
      .insert(schema.complianceDocuments)
      .values(doc)
      .returning();
    return created;
  }

  async listComplianceDocuments(itemId: string): Promise<schema.ComplianceDocument[]> {
    return db
      .select()
      .from(schema.complianceDocuments)
      .where(eq(schema.complianceDocuments.complianceItemId, itemId))
      .orderBy(desc(schema.complianceDocuments.uploadedAt));
  }

  async getComplianceDocument(id: string): Promise<schema.ComplianceDocument | undefined> {
    const [doc] = await db
      .select()
      .from(schema.complianceDocuments)
      .where(eq(schema.complianceDocuments.id, id));
    return doc;
  }

  async deleteComplianceDocument(id: string): Promise<void> {
    await db.delete(schema.complianceDocuments).where(eq(schema.complianceDocuments.id, id));
  }

  // ============================================
  // EVENTS & MEETINGS
  // ============================================

  // Event Types
  async listEventTypes(): Promise<schema.EventType[]> {
    return db
      .select()
      .from(schema.eventTypes)
      .orderBy(schema.eventTypes.sortOrder);
  }

  async getEventType(id: string): Promise<schema.EventType | undefined> {
    const [eventType] = await db
      .select()
      .from(schema.eventTypes)
      .where(eq(schema.eventTypes.id, id));
    return eventType;
  }

  // Events
  async listEvents(filters: {
    tenantId?: string;
    tenantIds?: string[];
    eventTypeId?: string;
    status?: string;
    startAfter?: Date;
    startBefore?: Date;
  }): Promise<(schema.Event & { eventType: schema.EventType })[]> {
    const conditions: any[] = [];

    if (filters.tenantId) {
      conditions.push(eq(schema.events.tenantId, filters.tenantId));
    }
    if (filters.tenantIds && filters.tenantIds.length > 0) {
      conditions.push(inArray(schema.events.tenantId, filters.tenantIds));
    }
    if (filters.eventTypeId) {
      conditions.push(eq(schema.events.eventTypeId, filters.eventTypeId));
    }
    if (filters.status) {
      conditions.push(eq(schema.events.status, filters.status));
    }
    if (filters.startAfter) {
      conditions.push(sql`${schema.events.startDatetime} >= ${filters.startAfter}`);
    }
    if (filters.startBefore) {
      conditions.push(sql`${schema.events.startDatetime} <= ${filters.startBefore}`);
    }

    const events = await db
      .select({
        event: schema.events,
        eventType: schema.eventTypes,
      })
      .from(schema.events)
      .leftJoin(schema.eventTypes, eq(schema.events.eventTypeId, schema.eventTypes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.events.startDatetime);

    return events.map(row => ({
      ...row.event,
      eventType: row.eventType!,
    }));
  }

  async getEvent(id: string): Promise<(schema.Event & {
    eventType: schema.EventType;
    attendees: schema.EventAttendee[];
    documents: schema.EventDocument[];
    applications: (schema.EventApplication & { application: schema.Application })[];
  }) | undefined> {
    const [eventRow] = await db
      .select({
        event: schema.events,
        eventType: schema.eventTypes,
      })
      .from(schema.events)
      .leftJoin(schema.eventTypes, eq(schema.events.eventTypeId, schema.eventTypes.id))
      .where(eq(schema.events.id, id));

    if (!eventRow) return undefined;

    const attendees = await db
      .select()
      .from(schema.eventAttendees)
      .where(eq(schema.eventAttendees.eventId, id));

    const documents = await db
      .select()
      .from(schema.eventDocuments)
      .where(eq(schema.eventDocuments.eventId, id));

    const applicationRows = await db
      .select({
        eventApp: schema.eventApplications,
        application: schema.applications,
      })
      .from(schema.eventApplications)
      .leftJoin(schema.applications, eq(schema.eventApplications.applicationId, schema.applications.id))
      .where(eq(schema.eventApplications.eventId, id))
      .orderBy(schema.eventApplications.orderIndex);

    return {
      ...eventRow.event,
      eventType: eventRow.eventType!,
      attendees,
      documents,
      applications: applicationRows.map(row => ({
        ...row.eventApp,
        application: row.application!,
      })),
    };
  }

  async createEvent(event: schema.InsertEvent): Promise<schema.Event> {
    const [newEvent] = await db.insert(schema.events).values(event as any).returning();
    return newEvent;
  }

  async updateEvent(id: string, updates: Partial<schema.InsertEvent>): Promise<schema.Event> {
    const [updatedEvent] = await db
      .update(schema.events)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(schema.events.id, id))
      .returning();
    return updatedEvent;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(schema.events).where(eq(schema.events.id, id));
  }

  async completeEvent(id: string): Promise<schema.Event> {
    const [event] = await db
      .update(schema.events)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(schema.events.id, id))
      .returning();
    return event;
  }

  async cancelEvent(id: string): Promise<schema.Event> {
    const [event] = await db
      .update(schema.events)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(schema.events.id, id))
      .returning();
    return event;
  }

  // Event Attendees
  async listEventAttendees(eventId: string): Promise<schema.EventAttendee[]> {
    return db
      .select()
      .from(schema.eventAttendees)
      .where(eq(schema.eventAttendees.eventId, eventId));
  }

  async addEventAttendee(attendee: schema.InsertEventAttendee): Promise<schema.EventAttendee> {
    const [newAttendee] = await db.insert(schema.eventAttendees).values(attendee).returning();
    return newAttendee;
  }

  async getEventAttendee(id: string): Promise<schema.EventAttendee | undefined> {
    const [attendee] = await db
      .select()
      .from(schema.eventAttendees)
      .where(eq(schema.eventAttendees.id, id));
    return attendee;
  }

  async updateEventAttendee(id: string, updates: Partial<schema.InsertEventAttendee>): Promise<schema.EventAttendee> {
    const [updated] = await db
      .update(schema.eventAttendees)
      .set(updates)
      .where(eq(schema.eventAttendees.id, id))
      .returning();
    return updated;
  }

  async removeEventAttendee(id: string): Promise<void> {
    await db.delete(schema.eventAttendees).where(eq(schema.eventAttendees.id, id));
  }

  // Event Documents
  async listEventDocuments(eventId: string): Promise<schema.EventDocument[]> {
    return db
      .select()
      .from(schema.eventDocuments)
      .where(eq(schema.eventDocuments.eventId, eventId));
  }

  async createEventDocument(doc: schema.InsertEventDocument): Promise<schema.EventDocument> {
    const [newDoc] = await db.insert(schema.eventDocuments).values(doc).returning();
    return newDoc;
  }

  async getEventDocument(id: string): Promise<schema.EventDocument | undefined> {
    const [doc] = await db
      .select()
      .from(schema.eventDocuments)
      .where(eq(schema.eventDocuments.id, id));
    return doc;
  }

  async deleteEventDocument(id: string): Promise<void> {
    await db.delete(schema.eventDocuments).where(eq(schema.eventDocuments.id, id));
  }

  // Event Applications (Review Packets)
  async listEventApplications(eventId: string): Promise<(schema.EventApplication & { application: schema.Application })[]> {
    const rows = await db
      .select({
        eventApp: schema.eventApplications,
        application: schema.applications,
      })
      .from(schema.eventApplications)
      .leftJoin(schema.applications, eq(schema.eventApplications.applicationId, schema.applications.id))
      .where(eq(schema.eventApplications.eventId, eventId))
      .orderBy(schema.eventApplications.orderIndex);

    return rows.map(row => ({
      ...row.eventApp,
      application: row.application!,
    }));
  }

  async addEventApplication(link: schema.InsertEventApplication): Promise<schema.EventApplication> {
    const [newLink] = await db.insert(schema.eventApplications).values(link).returning();
    return newLink;
  }

  async updateEventApplication(id: string, updates: Partial<schema.InsertEventApplication>): Promise<schema.EventApplication> {
    const [updated] = await db
      .update(schema.eventApplications)
      .set(updates)
      .where(eq(schema.eventApplications.id, id))
      .returning();
    return updated;
  }

  async removeEventApplication(id: string): Promise<void> {
    await db.delete(schema.eventApplications).where(eq(schema.eventApplications.id, id));
  }

  // Calendar View
  async getCalendarEvents(tenantIds: string[], startDate: Date, endDate: Date): Promise<(schema.Event & { eventType: schema.EventType })[]> {
    const events = await db
      .select({
        event: schema.events,
        eventType: schema.eventTypes,
      })
      .from(schema.events)
      .leftJoin(schema.eventTypes, eq(schema.events.eventTypeId, schema.eventTypes.id))
      .where(and(
        inArray(schema.events.tenantId, tenantIds),
        sql`${schema.events.startDatetime} >= ${startDate}`,
        sql`${schema.events.startDatetime} <= ${endDate}`
      ))
      .orderBy(schema.events.startDatetime);

    return events.map(row => ({
      ...row.event,
      eventType: row.eventType!,
    }));
  }

  // ============================================
  // CALENDAR FEED TOKENS
  // ============================================

  async createCalendarFeedToken(data: schema.InsertCalendarFeedToken): Promise<schema.CalendarFeedToken> {
    const [token] = await db.insert(schema.calendarFeedTokens).values(data).returning();
    return token;
  }

  async getCalendarFeedTokenByToken(token: string): Promise<schema.CalendarFeedToken | undefined> {
    const [feedToken] = await db
      .select()
      .from(schema.calendarFeedTokens)
      .where(and(
        eq(schema.calendarFeedTokens.token, token),
        eq(schema.calendarFeedTokens.isActive, true)
      ));
    return feedToken;
  }

  async getCalendarFeedTokenByUserId(userId: string): Promise<schema.CalendarFeedToken | undefined> {
    const [feedToken] = await db
      .select()
      .from(schema.calendarFeedTokens)
      .where(and(
        eq(schema.calendarFeedTokens.userId, userId),
        eq(schema.calendarFeedTokens.isActive, true)
      ));
    return feedToken;
  }

  async updateCalendarFeedTokenAccess(id: string): Promise<void> {
    await db
      .update(schema.calendarFeedTokens)
      .set({
        lastAccessedAt: new Date(),
        accessCount: sql`${schema.calendarFeedTokens.accessCount} + 1`,
      })
      .where(eq(schema.calendarFeedTokens.id, id));
  }

  async revokeCalendarFeedToken(id: string): Promise<void> {
    await db
      .update(schema.calendarFeedTokens)
      .set({ isActive: false })
      .where(eq(schema.calendarFeedTokens.id, id));
  }

  async deleteCalendarFeedToken(id: string): Promise<void> {
    await db.delete(schema.calendarFeedTokens).where(eq(schema.calendarFeedTokens.id, id));
  }

  // Get events for iCal feed - returns events for the next 12 months
  async getEventsForFeed(
    userId: string,
    tenantId?: string,
    eventTypeFilter?: string[]
  ): Promise<(schema.Event & { eventType: schema.EventType; tenant: schema.Tenant })[]> {
    // Get all tenants the user has access to
    const userTenants = await this.getUserTenants(userId);
    let tenantIds = userTenants.map(ut => ut.tenantId);

    // If tenantId filter specified, narrow down
    if (tenantId) {
      tenantIds = tenantIds.filter(id => id === tenantId);
    }

    if (tenantIds.length === 0) {
      return [];
    }

    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    // Build conditions
    const conditions = [
      inArray(schema.events.tenantId, tenantIds),
      sql`${schema.events.startDatetime} >= ${now}`,
      sql`${schema.events.startDatetime} <= ${oneYearFromNow}`,
      sql`${schema.events.status} != 'cancelled'`,
    ];

    // Add event type filter if specified
    if (eventTypeFilter && eventTypeFilter.length > 0) {
      conditions.push(inArray(schema.events.eventTypeId, eventTypeFilter));
    }

    const events = await db
      .select({
        event: schema.events,
        eventType: schema.eventTypes,
        tenant: schema.tenants,
      })
      .from(schema.events)
      .leftJoin(schema.eventTypes, eq(schema.events.eventTypeId, schema.eventTypes.id))
      .leftJoin(schema.tenants, eq(schema.events.tenantId, schema.tenants.id))
      .where(and(...conditions))
      .orderBy(schema.events.startDatetime);

    return events.map(row => ({
      ...row.event,
      eventType: row.eventType!,
      tenant: row.tenant!,
    }));
  }
}

export const storage = new DbStorage();
