import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, or, sql, inArray, desc, lt, isNull, isNotNull } from "drizzle-orm";
import * as schema from "@shared/schema";
import { workflowEngine } from "./workflowEngine";
import { expandRecurringEvents, type ExpandedEvent, type EventWithType } from "./recurrenceExpander";
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
  getPropertiesByRole(userId: string, role: string): Promise<schema.Tenant[]>;
  getTenantsByManagementCompany(managementCompanyId: string): Promise<schema.Tenant[]>;
  createTenant(tenant: schema.InsertTenant): Promise<schema.Tenant>;
  updateTenant(id: string, updates: Partial<schema.InsertTenant>): Promise<schema.Tenant>;
  deleteTenant(id: string): Promise<void>;
  
  // User-Tenant-Roles
  getUserRolesForTenant(userId: string, tenantId: string): Promise<schema.UserTenantRole[]>;
  getUserTenants(userId: string): Promise<(schema.UserTenantRole & { tenant: schema.Tenant })[]>;
  getUserEffectiveRole(userId: string, tenantId: string): Promise<{
    role: string | null;
    allRoles: string[];
    isFromManagementCompany: boolean;
    managementCompanyId: string | null;
  }>;
  getTenantUsers(tenantId: string): Promise<(schema.User & { roles: string[] })[]>;
  assignUserRole(assignment: schema.InsertUserTenantRole): Promise<schema.UserTenantRole>;
  removeUserRole(userId: string, tenantId: string, role: string, deactivatedByUserId?: string): Promise<void>;
  removeUserFromTenant(userId: string, tenantId: string, deactivatedByUserId?: string): Promise<void>;

  // Property Rep Assignments
  getPropertyRepAssignments(propertyId: string): Promise<(schema.PropertyRepAssignment & { user: schema.User })[]>;
  getUserPropertyAssignments(userId: string): Promise<(schema.PropertyRepAssignment & { property: schema.Tenant })[]>;
  isUserAssignedToProperty(userId: string, propertyId: string): Promise<boolean>;
  createPropertyRepAssignment(assignment: schema.InsertPropertyRepAssignment): Promise<schema.PropertyRepAssignment>;
  updatePropertyRepAssignment(id: string, updates: Partial<schema.InsertPropertyRepAssignment>): Promise<schema.PropertyRepAssignment>;
  removePropertyRepAssignment(id: string): Promise<void>;
  bulkAssignRepToProperties(userId: string, propertyIds: string[], designation: string, assignedByUserId: string, demoCodeId?: string): Promise<schema.PropertyRepAssignment[]>;
  getPropertyRepInfo(propertyId: string): Promise<{
    reps: (schema.PropertyRepAssignment & { user: schema.User })[];
    fallbackRep: schema.User | null;
    fallbackTitle: string | null;
  }>;
  setDefaultFallbackRep(managementCompanyId: string, userId: string | null, title?: string): Promise<schema.Tenant>;

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
  listApplicationsByRole(role: string, tenantId: string, userId: string): Promise<(schema.Application & {
    workflowStage?: string;
    tenantName?: string;
    aiAnalysis?: { status: string; complianceScore?: number; riskLevel?: string } | null;
  })[]>;
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
  listBlueprintWorkflowTemplates(): Promise<schema.WorkflowTemplate[]>;
  listCustomWorkflowTemplatesForTenant(tenantId: string): Promise<schema.WorkflowTemplate[]>;
  createWorkflowTemplate(template: schema.InsertWorkflowTemplate): Promise<schema.WorkflowTemplate>;
  updateWorkflowTemplate(id: string, updates: Partial<schema.WorkflowTemplate>): Promise<schema.WorkflowTemplate>;
  cloneWorkflowTemplate(sourceId: string, targetTenantId: string, name: string, description: string | undefined, userId: string): Promise<schema.WorkflowTemplate>;
  createWorkflowTemplateVersion(parentId: string, name: string, description: string | undefined, steps: any, userId: string): Promise<schema.WorkflowTemplate>;
  deleteWorkflowTemplate(id: string): Promise<void>;
  updateTenantWorkflow(tenantId: string, workflowTemplateId: string | null): Promise<schema.Tenant>;

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

  // Calendar View (with recurring event expansion)
  getCalendarEvents(tenantIds: string[], startDate: Date, endDate: Date): Promise<ExpandedEvent[]>;

  // Recurring Event Exception Handling
  addEventExceptionDate(eventId: string, date: string): Promise<schema.Event>;
  createEventException(parentId: string, originalDate: string, updates: Partial<schema.InsertEvent>, userId: string): Promise<schema.Event>;
  splitRecurringSeries(parentId: string, splitDate: string, updates: Partial<schema.InsertEvent>, userId: string): Promise<{ original: schema.Event; newSeries: schema.Event }>;
  endRecurringSeries(eventId: string, endDate: Date): Promise<schema.Event>;

  // AI Analysis Credits
  getAiAnalysisCredits(tenantId: string): Promise<schema.AiAnalysisCredits | undefined>;
  createAiAnalysisCredits(credits: schema.InsertAiAnalysisCredits): Promise<schema.AiAnalysisCredits>;
  updateAiAnalysisCredits(tenantId: string, updates: Partial<schema.InsertAiAnalysisCredits>): Promise<schema.AiAnalysisCredits>;
  incrementAiCreditsUsed(tenantId: string): Promise<schema.AiAnalysisCredits>;
  resetAiCreditsForBillingCycle(tenantId: string): Promise<schema.AiAnalysisCredits>;
  setAiCreditsOverride(tenantId: string, override: { monthlyCredits?: number; overageCost?: string; reason: string; setByUserId: string }): Promise<schema.AiAnalysisCredits>;
  removeAiCreditsOverride(tenantId: string): Promise<schema.AiAnalysisCredits>;

  // AI Analyses
  createAiAnalysis(analysis: schema.InsertAiAnalysis): Promise<schema.AiAnalysis>;
  getAiAnalysis(id: string): Promise<schema.AiAnalysis | undefined>;
  getAiAnalysisForApplication(applicationId: string): Promise<schema.AiAnalysis[]>;
  listAiAnalysesForTenant(tenantId: string): Promise<schema.AiAnalysis[]>;
  getNextQueuedAiAnalysis(): Promise<schema.AiAnalysis | undefined>;
  getStaleProcessingAnalyses(maxAgeMs: number): Promise<schema.AiAnalysis[]>;
  updateAiAnalysis(id: string, updates: Partial<schema.AiAnalysis>): Promise<schema.AiAnalysis>;
  updateAiAnalysisStatus(id: string, status: string, errorMessage?: string): Promise<schema.AiAnalysis>;
  submitAiAnalysisFeedback(id: string, rating: number, feedback?: string): Promise<schema.AiAnalysis>;
  getAiAnalysisStats(tenantIds?: string[]): Promise<{
    totalAnalyses: number;
    pendingAnalyses: number;
    averageProcessingTimeMs: number;
    averageComplianceScore: number;
    successRate: number;
    totalCostUsd: string;
    averageRating: number | null;
  }>;

  // Application Events (audit log)
  createApplicationEvent(event: schema.InsertApplicationEvent): Promise<schema.ApplicationEvent>;
  getApplicationEvents(applicationId: string): Promise<schema.ApplicationEvent[]>;

  // Self-Service Community Join
  searchPublicCommunities(query: string): Promise<schema.Tenant[]>;
  selfServiceJoinCommunity(userId: string, tenantId: string): Promise<schema.UserTenantRole>;

  // Homeowner Verification
  verifyHomeowner(userId: string, tenantId: string, applicationId: string): Promise<schema.UserTenantRole | undefined>;
  isHomeownerVerified(userId: string, tenantId: string): Promise<boolean>;
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

  async getTenantsByManagementCompany(managementCompanyId: string): Promise<schema.Tenant[]> {
    return db
      .select()
      .from(schema.tenants)
      .where(
        and(
          eq(schema.tenants.managementCompanyId, managementCompanyId),
          eq(schema.tenants.isActive, true),
          eq(schema.tenants.type, 'community')
        )
      );
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
    // Get all user's roles with their tenants
    const userRoles = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.tenants, eq(schema.userTenantRoles.tenantId, schema.tenants.id))
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.isActive, true)
        )
      );

    // Collect community IDs and management company IDs
    const communityIds = new Set<string>();
    const managementCompanyIds = new Set<string>();
    const userRoleNames = userRoles.map(r => r.user_tenant_roles.role);

    // Check if user has management_manager or account_admin at any management company
    const hasManagerOrAdminAtMgmtCompany = userRoles.some(
      r => r.tenants.type === 'management_company' &&
           (r.user_tenant_roles.role === 'management_manager' || r.user_tenant_roles.role === 'account_admin')
    );

    // Check if user is only a management_rep (no manager/admin role)
    const isOnlyManagementRep = userRoles.some(
      r => r.tenants.type === 'management_company' && r.user_tenant_roles.role === 'management_rep'
    ) && !hasManagerOrAdminAtMgmtCompany;

    for (const roleData of userRoles) {
      const tenant = roleData.tenants;
      const role = roleData.user_tenant_roles.role;

      if (tenant.type === 'community') {
        // Direct community access
        communityIds.add(tenant.id);
      } else if (tenant.type === 'management_company') {
        // management_manager or account_admin at mgmt company = access to all managed communities
        if (role === 'management_manager' || role === 'account_admin') {
          managementCompanyIds.add(tenant.id);
        }
        // management_rep at mgmt company = handled via property assignments below
      }
    }

    // For management_manager/account_admin: Get all communities under their management companies
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

    // For management_rep: Only get properties they're assigned to
    if (isOnlyManagementRep) {
      const propertyAssignments = await this.getUserPropertyAssignments(userId);
      for (const assignment of propertyAssignments) {
        communityIds.add(assignment.propertyId);
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

  async getPropertiesByRole(userId: string, role: string): Promise<schema.Tenant[]> {
    // Get user's roles filtered by the specific role
    const userRoles = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.tenants, eq(schema.userTenantRoles.tenantId, schema.tenants.id))
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.role, role),
          eq(schema.userTenantRoles.isActive, true)
        )
      );

    const communityIds = new Set<string>();
    const managementCompanyIds = new Set<string>();

    for (const roleData of userRoles) {
      const tenant = roleData.tenants;

      if (tenant.type === 'community') {
        // Direct community access with this specific role
        communityIds.add(tenant.id);
      } else if (tenant.type === 'management_company') {
        // For account_admin or management_manager at mgmt company, get all managed communities
        if (role === 'management_manager' || role === 'account_admin') {
          managementCompanyIds.add(tenant.id);
        }
        // For management_rep, handled via property assignments below
      }
    }

    // For management_manager/account_admin at mgmt company: Get all communities under their management companies
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

    // For management_rep: Only get properties they're assigned to
    if (role === 'management_rep') {
      const propertyAssignments = await this.getUserPropertyAssignments(userId);
      for (const assignment of propertyAssignments) {
        communityIds.add(assignment.propertyId);
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
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.isActive, true)
        )
      );
  }

  async getUserTenants(userId: string): Promise<(schema.UserTenantRole & { tenant: schema.Tenant })[]> {
    const results = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.tenants, eq(schema.userTenantRoles.tenantId, schema.tenants.id))
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.isActive, true)
        )
      );

    return results.map(r => ({ ...r.user_tenant_roles, tenant: r.tenants }));
  }

  // Role hierarchy for determining effective role (highest privilege first)
  private readonly ROLE_HIERARCHY = [
    'super_admin',
    'account_admin',
    'management_manager',
    'management_rep',
    'poa_board_member',
    'poa_board_contributor',
    'delegated_rep',
    'homeowner',
  ];

  private getHighestPrivilegeRole(roles: string[]): string | null {
    for (const hierarchyRole of this.ROLE_HIERARCHY) {
      if (roles.includes(hierarchyRole)) {
        return hierarchyRole;
      }
    }
    return roles[0] || null;
  }

  /**
   * Get the effective role for a user on a specific tenant.
   * This considers role inheritance from management company:
   * - If tenant is a community and user has management_manager at the management company,
   *   they inherit that role for the community.
   * - If user has management_rep at management company, they only get access if assigned to this property.
   */
  async getUserEffectiveRole(userId: string, tenantId: string): Promise<{
    role: string | null;
    allRoles: string[];
    isFromManagementCompany: boolean;
    managementCompanyId: string | null;
  }> {
    // Get the target tenant
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { role: null, allRoles: [], isFromManagementCompany: false, managementCompanyId: null };
    }

    // Get user's direct roles on this tenant
    const directRoles = await this.getUserRolesForTenant(userId, tenantId);
    const directRoleNames = directRoles.map(r => r.role);

    // If tenant is a community with a management company, check inherited roles
    let inheritedRoles: string[] = [];
    let isFromManagementCompany = false;
    const managementCompanyId = tenant.managementCompanyId;

    if (tenant.type === 'community' && managementCompanyId) {
      // Get user's roles at the management company
      const mgmtRoles = await this.getUserRolesForTenant(userId, managementCompanyId);
      const mgmtRoleNames = mgmtRoles.map(r => r.role);

      // management_manager at mgmt company inherits to all communities
      if (mgmtRoleNames.includes('management_manager')) {
        inheritedRoles.push('management_manager');
        isFromManagementCompany = true;
      }

      // account_admin at mgmt company inherits to all communities
      if (mgmtRoleNames.includes('account_admin')) {
        inheritedRoles.push('account_admin');
        isFromManagementCompany = true;
      }

      // management_rep at mgmt company only inherits if assigned to this property
      if (mgmtRoleNames.includes('management_rep') && !mgmtRoleNames.includes('management_manager')) {
        const isAssigned = await this.isUserAssignedToProperty(userId, tenantId);
        if (isAssigned) {
          inheritedRoles.push('management_rep');
          isFromManagementCompany = true;
        }
      }
    }

    // Combine direct and inherited roles
    const allRoles = Array.from(new Set([...directRoleNames, ...inheritedRoles]));
    const effectiveRole = this.getHighestPrivilegeRole(allRoles);

    // Determine if the effective role came from management company
    const roleIsFromMgmtCompany = effectiveRole !== null &&
      inheritedRoles.includes(effectiveRole) &&
      !directRoleNames.includes(effectiveRole);

    return {
      role: effectiveRole,
      allRoles,
      isFromManagementCompany: roleIsFromMgmtCompany,
      managementCompanyId: managementCompanyId || null,
    };
  }

  async assignUserRole(assignment: schema.InsertUserTenantRole): Promise<schema.UserTenantRole> {
    const [role] = await db.insert(schema.userTenantRoles).values(assignment).returning();
    return role;
  }

  async getTenantUsers(tenantId: string): Promise<(schema.User & { roles: string[] })[]> {
    // Get all active user-role assignments for this tenant
    const assignments = await db
      .select()
      .from(schema.userTenantRoles)
      .innerJoin(schema.users, eq(schema.userTenantRoles.userId, schema.users.id))
      .where(
        and(
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.isActive, true)
        )
      );

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

  async removeUserRole(userId: string, tenantId: string, role: string, deactivatedByUserId?: string): Promise<void> {
    // Soft delete - mark as inactive instead of deleting
    await db
      .update(schema.userTenantRoles)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedByUserId: deactivatedByUserId || null,
      })
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.role, role),
          eq(schema.userTenantRoles.isActive, true)
        )
      );
  }

  async removeUserFromTenant(userId: string, tenantId: string, deactivatedByUserId?: string): Promise<void> {
    // Soft delete - mark all roles as inactive instead of deleting
    await db
      .update(schema.userTenantRoles)
      .set({
        isActive: false,
        deactivatedAt: new Date(),
        deactivatedByUserId: deactivatedByUserId || null,
      })
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.isActive, true)
        )
      );
  }

  // ============================================
  // PROPERTY REP ASSIGNMENT METHODS
  // ============================================

  // Get all rep assignments for a property with user details
  async getPropertyRepAssignments(propertyId: string): Promise<(schema.PropertyRepAssignment & { user: schema.User })[]> {
    const results = await db
      .select()
      .from(schema.propertyRepAssignments)
      .innerJoin(schema.users, eq(schema.propertyRepAssignments.userId, schema.users.id))
      .where(
        and(
          eq(schema.propertyRepAssignments.propertyId, propertyId),
          eq(schema.propertyRepAssignments.isActive, true)
        )
      )
      .orderBy(schema.propertyRepAssignments.designation);

    return results.map(r => ({
      ...r.property_rep_assignments,
      user: r.users,
    }));
  }

  // Get all properties assigned to a user
  async getUserPropertyAssignments(userId: string): Promise<(schema.PropertyRepAssignment & { property: schema.Tenant })[]> {
    const results = await db
      .select()
      .from(schema.propertyRepAssignments)
      .innerJoin(schema.tenants, eq(schema.propertyRepAssignments.propertyId, schema.tenants.id))
      .where(
        and(
          eq(schema.propertyRepAssignments.userId, userId),
          eq(schema.propertyRepAssignments.isActive, true)
        )
      );

    return results.map(r => ({
      ...r.property_rep_assignments,
      property: r.tenants,
    }));
  }

  // Check if user is assigned to a specific property
  async isUserAssignedToProperty(userId: string, propertyId: string): Promise<boolean> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.propertyRepAssignments)
      .where(
        and(
          eq(schema.propertyRepAssignments.userId, userId),
          eq(schema.propertyRepAssignments.propertyId, propertyId),
          eq(schema.propertyRepAssignments.isActive, true)
        )
      );
    return (result?.count || 0) > 0;
  }

  // Create a property rep assignment
  async createPropertyRepAssignment(assignment: schema.InsertPropertyRepAssignment): Promise<schema.PropertyRepAssignment> {
    const [result] = await db.insert(schema.propertyRepAssignments).values(assignment).returning();
    return result;
  }

  // Update a property rep assignment
  async updatePropertyRepAssignment(id: string, updates: Partial<schema.InsertPropertyRepAssignment>): Promise<schema.PropertyRepAssignment> {
    const [result] = await db
      .update(schema.propertyRepAssignments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.propertyRepAssignments.id, id))
      .returning();
    return result;
  }

  // Remove (deactivate) a property rep assignment
  async removePropertyRepAssignment(id: string): Promise<void> {
    await db
      .update(schema.propertyRepAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.propertyRepAssignments.id, id));
  }

  // Bulk assign rep to multiple properties
  async bulkAssignRepToProperties(
    userId: string,
    propertyIds: string[],
    designation: string,
    assignedByUserId: string,
    demoCodeId?: string
  ): Promise<schema.PropertyRepAssignment[]> {
    const assignments = propertyIds.map(propertyId => ({
      propertyId,
      userId,
      designation,
      assignedByUserId,
      demoCodeId,
    }));

    const results = await db
      .insert(schema.propertyRepAssignments)
      .values(assignments)
      .onConflictDoUpdate({
        target: [schema.propertyRepAssignments.propertyId, schema.propertyRepAssignments.userId],
        set: {
          designation,
          isActive: true,
          assignedByUserId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return results;
  }

  // Get rep info for homeowner display (with fallback to default rep)
  async getPropertyRepInfo(propertyId: string): Promise<{
    reps: (schema.PropertyRepAssignment & { user: schema.User })[];
    fallbackRep: schema.User | null;
    fallbackTitle: string | null;
  }> {
    // Get assigned reps
    const reps = await this.getPropertyRepAssignments(propertyId);

    // Get management company for fallback
    const property = await this.getTenant(propertyId);
    let fallbackRep: schema.User | null = null;
    let fallbackTitle: string | null = null;

    if (property?.managementCompanyId) {
      const mgmtCompany = await this.getTenant(property.managementCompanyId);
      if (mgmtCompany?.settings?.defaultRepUserId) {
        const rep = await this.getUser(mgmtCompany.settings.defaultRepUserId);
        if (rep) {
          fallbackRep = rep;
          fallbackTitle = mgmtCompany.settings.defaultRepTitle || null;
        }
      }
    }

    return { reps, fallbackRep, fallbackTitle };
  }

  // Set default fallback rep for a management company
  async setDefaultFallbackRep(managementCompanyId: string, userId: string | null, title?: string): Promise<schema.Tenant> {
    const currentTenant = await this.getTenant(managementCompanyId);
    const updatedSettings = {
      ...currentTenant?.settings,
      defaultRepUserId: userId,
      defaultRepTitle: title,
    };

    const [result] = await db
      .update(schema.tenants)
      .set({ settings: updatedSettings })
      .where(eq(schema.tenants.id, managementCompanyId))
      .returning();

    return result;
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
    else if (role === 'management_rep' || role === 'management_manager' || role === 'management_auxiliary' || role === 'account_admin') {
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

    // Enrich with workflow stage, tenant name, and AI analysis info
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

        // Get latest AI analysis for this application
        const aiAnalyses = await this.getAiAnalysisForApplication(app.id);
        const latestAnalysis = aiAnalyses.length > 0 ? aiAnalyses[aiAnalyses.length - 1] : null;
        const aiAnalysis = latestAnalysis ? {
          status: latestAnalysis.status,
          complianceScore: latestAnalysis.complianceScore ?? undefined,
          riskLevel: latestAnalysis.riskLevel ?? undefined
        } : null;

        return {
          ...app,
          workflowStage,
          tenantName: tenant?.name,
          aiAnalysis
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

  async listBlueprintWorkflowTemplates(): Promise<schema.WorkflowTemplate[]> {
    // Get all blueprint templates (global, available to all tenants)
    return db.select().from(schema.workflowTemplates).where(eq(schema.workflowTemplates.isBlueprint, true));
  }

  async listCustomWorkflowTemplatesForTenant(tenantId: string): Promise<schema.WorkflowTemplate[]> {
    // Get custom (non-blueprint) templates for a specific tenant
    return db.select().from(schema.workflowTemplates).where(
      and(
        eq(schema.workflowTemplates.tenantId, tenantId),
        eq(schema.workflowTemplates.isBlueprint, false)
      )
    );
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
    targetTenantId: string,
    name: string,
    description: string | undefined,
    userId: string
  ): Promise<schema.WorkflowTemplate> {
    const source = await this.getWorkflowTemplate(sourceId);
    if (!source) throw new Error("Source template not found");

    const cloned: schema.InsertWorkflowTemplate = {
      tenantId: targetTenantId, // Clone into the target tenant, not the source tenant
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

  async updateTenantWorkflow(tenantId: string, workflowTemplateId: string | null): Promise<schema.Tenant> {
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

    // Validate that the workflow template belongs to the same tenant as the application
    // Blueprint templates (tenantId is null) are allowed for any tenant
    if (template.tenantId && template.tenantId !== application.tenantId) {
      throw new Error("Workflow template is not accessible for this application's tenant");
    }

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

    // Map feature names to plan properties (camelCase) and usage properties
    // Note: plan properties are nested under subscription.plan, usage properties are on subscription directly
    const featureMap: Record<string, { planProp: string; usageProp?: string; flag?: boolean }> = {
      'communities': { planProp: 'maxCommunities', usageProp: 'usageCommunities' },
      'users': { planProp: 'maxUsers', usageProp: 'usageUsers' },
      'storage': { planProp: 'maxStorageGb', usageProp: 'usageStorageGb' },
      'forms': { planProp: 'maxForms', usageProp: 'usageForms' },
      'applications': { planProp: 'maxApplicationsPerMonth', usageProp: 'usageApplicationsCurrentMonth' },
      'custom_branding': { planProp: 'customBranding', flag: true },
      'ai_form_generation': { planProp: 'aiFormGeneration', flag: true },
      'advanced_reporting': { planProp: 'advancedReporting', flag: true },
      'api_access': { planProp: 'apiAccess', flag: true },
      'custom_workflows': { planProp: 'customWorkflows', flag: true },
      'white_label': { planProp: 'whiteLabel', flag: true },
      'priority_support': { planProp: 'prioritySupport', flag: true },
      'sso': { planProp: 'sso', flag: true },
      'audit_logs': { planProp: 'auditLogs', flag: true },
    };

    const mapping = featureMap[feature];
    if (!mapping) {
      return { hasAccess: false, limit: 0, current: 0, reason: 'Unknown feature' };
    }

    // For boolean flags - these are on the plan object
    if (mapping.flag) {
      const planValue = subscription.plan?.[mapping.planProp];
      const hasAccess = planValue === true;
      console.log(`[checkFeatureAccess] tenantId=${tenantId}, feature=${feature}, planProp=${mapping.planProp}, planValue=${planValue}, hasAccess=${hasAccess}`);
      console.log(`[checkFeatureAccess] subscription.plan:`, JSON.stringify(subscription.plan, null, 2));
      return {
        hasAccess,
        limit: null,
        current: 0,
        reason: hasAccess ? undefined : `Feature "${feature}" not available in current plan`,
      };
    }

    // For limits - limits are on plan, usage is on subscription
    const limit = subscription.plan?.[mapping.planProp];
    const current = mapping.usageProp ? subscription[mapping.usageProp] : 0;

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

  // Calendar View (with recurring event expansion)
  async getCalendarEvents(tenantIds: string[], startDate: Date, endDate: Date): Promise<ExpandedEvent[]> {
    // Query 1: Get non-recurring events in range + recurring base events that may have instances in range
    const events = await db
      .select({
        event: schema.events,
        eventType: schema.eventTypes,
      })
      .from(schema.events)
      .leftJoin(schema.eventTypes, eq(schema.events.eventTypeId, schema.eventTypes.id))
      .where(and(
        inArray(schema.events.tenantId, tenantIds),
        isNull(schema.events.parentEventId), // Exclude exception events (handled separately)
        or(
          // Non-recurring events in range
          and(
            isNull(schema.events.recurrenceRule),
            sql`${schema.events.startDatetime} >= ${startDate}`,
            sql`${schema.events.startDatetime} <= ${endDate}`
          ),
          // Recurring events that might have instances in range
          // (started before end of range, and either no end date or ends after start of range)
          and(
            isNotNull(schema.events.recurrenceRule),
            sql`${schema.events.startDatetime} <= ${endDate}`,
            or(
              isNull(schema.events.recurrenceEndDate),
              sql`${schema.events.recurrenceEndDate} >= ${startDate}`
            )
          )
        )
      ))
      .orderBy(schema.events.startDatetime);

    // Get the IDs of recurring events for exception lookup
    const recurringEventIds = events
      .filter(row => row.event.recurrenceRule)
      .map(row => row.event.id);

    // Query 2: Get exception events for the recurring events in range
    let exceptionEvents: EventWithType[] = [];
    if (recurringEventIds.length > 0) {
      const exceptions = await db
        .select({
          event: schema.events,
          eventType: schema.eventTypes,
        })
        .from(schema.events)
        .leftJoin(schema.eventTypes, eq(schema.events.eventTypeId, schema.eventTypes.id))
        .where(and(
          inArray(schema.events.parentEventId, recurringEventIds),
          sql`${schema.events.startDatetime} >= ${startDate}`,
          sql`${schema.events.startDatetime} <= ${endDate}`
        ));

      exceptionEvents = exceptions.map(row => ({
        ...row.event,
        eventType: row.eventType,
      }));
    }

    // Map events to EventWithType format
    const eventsWithType: EventWithType[] = events.map(row => ({
      ...row.event,
      eventType: row.eventType,
    }));

    // Expand recurring events and merge with exceptions
    return expandRecurringEvents(eventsWithType, exceptionEvents, startDate, endDate);
  }

  // ============================================
  // RECURRING EVENT EXCEPTION HANDLING
  // ============================================

  // Add a date to the exception dates (marks an occurrence as deleted)
  async addEventExceptionDate(eventId: string, date: string): Promise<schema.Event> {
    const event = await this.getEvent(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Parse existing exception dates and add the new one
    const existingDates = event.exceptionDates ? event.exceptionDates.split(',').filter(d => d) : [];
    if (!existingDates.includes(date)) {
      existingDates.push(date);
    }
    existingDates.sort();

    const [updated] = await db
      .update(schema.events)
      .set({
        exceptionDates: existingDates.join(','),
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();

    return updated;
  }

  // Create an exception event that overrides a specific occurrence
  async createEventException(
    parentId: string,
    originalDate: string,
    updates: Partial<schema.InsertEvent>,
    userId: string
  ): Promise<schema.Event> {
    const parent = await this.getEvent(parentId);
    if (!parent) {
      throw new Error('Parent event not found');
    }

    // Create the exception event
    const [exception] = await db
      .insert(schema.events)
      .values({
        tenantId: parent.tenantId,
        eventTypeId: parent.eventTypeId,
        title: updates.title || parent.title,
        description: updates.description !== undefined ? updates.description : parent.description,
        startDatetime: updates.startDatetime ? new Date(updates.startDatetime as string) : parent.startDatetime,
        endDatetime: updates.endDatetime ? new Date(updates.endDatetime as string) : parent.endDatetime,
        allDay: updates.allDay !== undefined ? updates.allDay : parent.allDay,
        location: updates.location !== undefined ? updates.location : parent.location,
        meetingUrl: updates.meetingUrl !== undefined ? updates.meetingUrl : parent.meetingUrl,
        status: updates.status || parent.status,
        isPublic: updates.isPublic !== undefined ? updates.isPublic : parent.isPublic,
        reminderDays: updates.reminderDays !== undefined ? updates.reminderDays : parent.reminderDays,
        noticeRequiredDays: updates.noticeRequiredDays !== undefined ? updates.noticeRequiredDays : parent.noticeRequiredDays,
        parentEventId: parentId,
        originalOccurrenceDate: originalDate,
        recurrenceRule: null, // Exception events don't recur
        recurrenceEndDate: null,
        createdByUserId: userId,
        demoCodeId: parent.demoCodeId,
      })
      .returning();

    // Add the original date to the parent's exception dates so we don't show duplicates
    await this.addEventExceptionDate(parentId, originalDate);

    return exception;
  }

  // Split a recurring series at a given date (for "edit this and future" operations)
  async splitRecurringSeries(
    parentId: string,
    splitDate: string,
    updates: Partial<schema.InsertEvent>,
    userId: string
  ): Promise<{ original: schema.Event; newSeries: schema.Event }> {
    const parent = await this.getEvent(parentId);
    if (!parent || !parent.recurrenceRule) {
      throw new Error('Parent event not found or is not recurring');
    }

    // End the original series the day before the split date
    const endDate = new Date(splitDate);
    endDate.setDate(endDate.getDate() - 1);

    const [original] = await db
      .update(schema.events)
      .set({
        recurrenceEndDate: endDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, parentId))
      .returning();

    // Create a new recurring event starting from the split date
    const splitDateTime = new Date(splitDate);
    // Preserve the original time
    splitDateTime.setHours(parent.startDatetime.getHours());
    splitDateTime.setMinutes(parent.startDatetime.getMinutes());

    const duration = parent.endDatetime.getTime() - parent.startDatetime.getTime();
    const newEndDateTime = new Date(splitDateTime.getTime() + duration);

    const [newSeries] = await db
      .insert(schema.events)
      .values({
        tenantId: parent.tenantId,
        eventTypeId: updates.eventTypeId || parent.eventTypeId,
        title: updates.title || parent.title,
        description: updates.description !== undefined ? updates.description : parent.description,
        startDatetime: splitDateTime,
        endDatetime: newEndDateTime,
        allDay: updates.allDay !== undefined ? updates.allDay : parent.allDay,
        location: updates.location !== undefined ? updates.location : parent.location,
        meetingUrl: updates.meetingUrl !== undefined ? updates.meetingUrl : parent.meetingUrl,
        status: updates.status || parent.status,
        isPublic: updates.isPublic !== undefined ? updates.isPublic : parent.isPublic,
        recurrenceRule: updates.recurrenceRule !== undefined ? updates.recurrenceRule : parent.recurrenceRule,
        recurrenceEndDate: parent.recurrenceEndDate, // Inherit original end date
        reminderDays: updates.reminderDays !== undefined ? updates.reminderDays : parent.reminderDays,
        noticeRequiredDays: updates.noticeRequiredDays !== undefined ? updates.noticeRequiredDays : parent.noticeRequiredDays,
        createdByUserId: userId,
        demoCodeId: parent.demoCodeId,
      })
      .returning();

    return { original, newSeries };
  }

  // End a recurring series at a given date (for "delete this and future" operations)
  async endRecurringSeries(eventId: string, endDate: Date): Promise<schema.Event> {
    const [updated] = await db
      .update(schema.events)
      .set({
        recurrenceEndDate: endDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();

    return updated;
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

  // Get events for iCal feed - returns events from past 3 months to next 12 months
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
    // Include events from past 3 months (calendar apps show history)
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    // Build conditions
    const conditions = [
      inArray(schema.events.tenantId, tenantIds),
      sql`${schema.events.startDatetime} >= ${threeMonthsAgo}`,
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

  // ============================================
  // AI ANALYSIS CREDITS
  // ============================================

  async getAiAnalysisCredits(tenantId: string): Promise<schema.AiAnalysisCredits | undefined> {
    const [credits] = await db
      .select()
      .from(schema.aiAnalysisCredits)
      .where(eq(schema.aiAnalysisCredits.tenantId, tenantId));
    return credits;
  }

  async createAiAnalysisCredits(credits: schema.InsertAiAnalysisCredits): Promise<schema.AiAnalysisCredits> {
    const [created] = await db
      .insert(schema.aiAnalysisCredits)
      .values(credits)
      .returning();
    return created;
  }

  async updateAiAnalysisCredits(tenantId: string, updates: Partial<schema.InsertAiAnalysisCredits>): Promise<schema.AiAnalysisCredits> {
    const [updated] = await db
      .update(schema.aiAnalysisCredits)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalysisCredits.tenantId, tenantId))
      .returning();
    return updated;
  }

  async incrementAiCreditsUsed(tenantId: string): Promise<schema.AiAnalysisCredits> {
    const [updated] = await db
      .update(schema.aiAnalysisCredits)
      .set({
        creditsUsedThisMonth: sql`${schema.aiAnalysisCredits.creditsUsedThisMonth} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalysisCredits.tenantId, tenantId))
      .returning();
    return updated;
  }

  async resetAiCreditsForBillingCycle(tenantId: string): Promise<schema.AiAnalysisCredits> {
    const [updated] = await db
      .update(schema.aiAnalysisCredits)
      .set({
        creditsUsedThisMonth: 0,
        billingCycleStart: new Date(),
        lastResetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalysisCredits.tenantId, tenantId))
      .returning();
    return updated;
  }

  async setAiCreditsOverride(
    tenantId: string,
    override: { monthlyCredits?: number; overageCost?: string; reason: string; setByUserId: string }
  ): Promise<schema.AiAnalysisCredits> {
    const [updated] = await db
      .update(schema.aiAnalysisCredits)
      .set({
        overrideMonthlyCredits: override.monthlyCredits,
        overrideOverageCost: override.overageCost,
        overrideReason: override.reason,
        overrideSetByUserId: override.setByUserId,
        overrideSetAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalysisCredits.tenantId, tenantId))
      .returning();
    return updated;
  }

  async removeAiCreditsOverride(tenantId: string): Promise<schema.AiAnalysisCredits> {
    const [updated] = await db
      .update(schema.aiAnalysisCredits)
      .set({
        overrideMonthlyCredits: null,
        overrideOverageCost: null,
        overrideReason: null,
        overrideSetByUserId: null,
        overrideSetAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalysisCredits.tenantId, tenantId))
      .returning();
    return updated;
  }

  // ============================================
  // AI ANALYSES
  // ============================================

  async createAiAnalysis(analysis: schema.InsertAiAnalysis): Promise<schema.AiAnalysis> {
    const [created] = await db
      .insert(schema.aiAnalyses)
      .values(analysis)
      .returning();
    return created;
  }

  async getAiAnalysis(id: string): Promise<schema.AiAnalysis | undefined> {
    const [analysis] = await db
      .select()
      .from(schema.aiAnalyses)
      .where(eq(schema.aiAnalyses.id, id));
    return analysis;
  }

  async getAiAnalysisForApplication(applicationId: string): Promise<schema.AiAnalysis[]> {
    return db
      .select()
      .from(schema.aiAnalyses)
      .where(eq(schema.aiAnalyses.applicationId, applicationId))
      .orderBy(desc(schema.aiAnalyses.queuedAt));
  }

  async listAiAnalysesForTenant(tenantId: string): Promise<schema.AiAnalysis[]> {
    return db
      .select()
      .from(schema.aiAnalyses)
      .where(eq(schema.aiAnalyses.tenantId, tenantId))
      .orderBy(desc(schema.aiAnalyses.queuedAt));
  }

  async listAllAiAnalyses(limit = 100): Promise<schema.AiAnalysis[]> {
    return db
      .select()
      .from(schema.aiAnalyses)
      .orderBy(desc(schema.aiAnalyses.queuedAt))
      .limit(limit);
  }

  async getNextQueuedAiAnalysis(): Promise<schema.AiAnalysis | undefined> {
    // Get next queued analysis, ordered by priority (desc) then queued time (asc)
    const [analysis] = await db
      .select()
      .from(schema.aiAnalyses)
      .where(eq(schema.aiAnalyses.status, 'queued'))
      .orderBy(desc(schema.aiAnalyses.priority), schema.aiAnalyses.queuedAt)
      .limit(1);
    return analysis;
  }

  async getStaleProcessingAnalyses(maxAgeMs: number): Promise<schema.AiAnalysis[]> {
    // Find analyses stuck in "processing" state for longer than maxAgeMs
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    return db
      .select()
      .from(schema.aiAnalyses)
      .where(
        and(
          eq(schema.aiAnalyses.status, 'processing'),
          lt(schema.aiAnalyses.startedAt, cutoffTime)
        )
      );
  }

  async updateAiAnalysis(id: string, updates: Partial<schema.AiAnalysis>): Promise<schema.AiAnalysis> {
    const [updated] = await db
      .update(schema.aiAnalyses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalyses.id, id))
      .returning();
    return updated;
  }

  async updateAiAnalysisStatus(id: string, status: string, errorMessage?: string): Promise<schema.AiAnalysis> {
    const updates: Partial<schema.AiAnalysis> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updates.startedAt = new Date();
    } else if (status === 'completed') {
      updates.completedAt = new Date();
    } else if (status === 'failed') {
      updates.errorMessage = errorMessage;
    }

    const [updated] = await db
      .update(schema.aiAnalyses)
      .set(updates)
      .where(eq(schema.aiAnalyses.id, id))
      .returning();
    return updated;
  }

  async submitAiAnalysisFeedback(id: string, rating: number, feedback?: string): Promise<schema.AiAnalysis> {
    const [updated] = await db
      .update(schema.aiAnalyses)
      .set({
        userRating: rating,
        userFeedback: feedback,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalyses.id, id))
      .returning();
    return updated;
  }

  async resetStuckAnalyses(): Promise<number> {
    // Reset ALL analyses that are in 'processing' status
    // This is useful when the server restarts and loses track of in-progress jobs
    const result = await db
      .update(schema.aiAnalyses)
      .set({
        status: 'pending',
        progress: 0,
        errorMessage: null,
        startedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAnalyses.status, 'processing'))
      .returning();

    return result.length;
  }

  async getAiAnalysisStats(tenantIds?: string[]): Promise<{
    totalAnalyses: number;
    pendingAnalyses: number;
    averageProcessingTimeMs: number;
    averageComplianceScore: number;
    successRate: number;
    totalCostUsd: string;
    averageRating: number | null;
  }> {
    const conditions = tenantIds && tenantIds.length > 0
      ? [inArray(schema.aiAnalyses.tenantId, tenantIds)]
      : [];

    // Get basic counts
    const [stats] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${schema.aiAnalyses.status} IN ('queued', 'processing'))::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${schema.aiAnalyses.status} = 'completed')::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${schema.aiAnalyses.status} = 'failed')::int`,
        avgProcessingTime: sql<number>`COALESCE(AVG(${schema.aiAnalyses.processingDurationMs}) FILTER (WHERE ${schema.aiAnalyses.status} = 'completed'), 0)::int`,
        avgComplianceScore: sql<number>`COALESCE(AVG(${schema.aiAnalyses.complianceScore}) FILTER (WHERE ${schema.aiAnalyses.status} = 'completed'), 0)::int`,
        totalCost: sql<string>`COALESCE(SUM(${schema.aiAnalyses.totalCostUsd}::numeric), 0)::text`,
        avgRating: sql<number | null>`AVG(${schema.aiAnalyses.userRating})`,
      })
      .from(schema.aiAnalyses)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const successRate = stats.total > 0
      ? (stats.completed / (stats.completed + stats.failed)) * 100
      : 0;

    return {
      totalAnalyses: stats.total,
      pendingAnalyses: stats.pending,
      averageProcessingTimeMs: stats.avgProcessingTime,
      averageComplianceScore: stats.avgComplianceScore,
      successRate: Math.round(successRate * 100) / 100,
      totalCostUsd: stats.totalCost,
      averageRating: stats.avgRating ? Math.round(stats.avgRating * 10) / 10 : null,
    };
  }

  // Application Events (audit log)
  async createApplicationEvent(event: schema.InsertApplicationEvent): Promise<schema.ApplicationEvent> {
    const [created] = await db
      .insert(schema.applicationEvents)
      .values(event)
      .returning();
    return created;
  }

  async getApplicationEvents(applicationId: string): Promise<schema.ApplicationEvent[]> {
    return db
      .select()
      .from(schema.applicationEvents)
      .where(eq(schema.applicationEvents.applicationId, applicationId))
      .orderBy(desc(schema.applicationEvents.createdAt));
  }

  // ============================================
  // SELF-SERVICE COMMUNITY JOIN
  // ============================================

  async searchPublicCommunities(query: string): Promise<schema.Tenant[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const lowercaseQuery = query.toLowerCase();
    const results = await db
      .select()
      .from(schema.tenants)
      .where(
        and(
          eq(schema.tenants.isActive, true),
          eq(schema.tenants.type, 'community'),
          eq(schema.tenants.allowPublicApplications, true),
          isNull(schema.tenants.demoCodeId), // Exclude demo accounts
          or(
            sql`LOWER(${schema.tenants.name}) LIKE ${`%${lowercaseQuery}%`}`,
            sql`LOWER(${schema.tenants.subdomain}) LIKE ${`%${lowercaseQuery}%`}`
          )
        )
      )
      .limit(10);

    return results;
  }

  async selfServiceJoinCommunity(userId: string, tenantId: string): Promise<schema.UserTenantRole> {
    // Check if tenant allows public applications
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      throw new Error('Community not found');
    }
    if (tenant.type !== 'community') {
      throw new Error('Can only join communities');
    }
    if (!tenant.allowPublicApplications) {
      throw new Error('This community does not allow self-service registration');
    }

    // Check if user already has a role in this tenant
    const existingRoles = await this.getUserRolesForTenant(userId, tenantId);
    if (existingRoles.length > 0) {
      throw new Error('You are already a member of this community');
    }

    // Create unverified homeowner role
    const [role] = await db
      .insert(schema.userTenantRoles)
      .values({
        userId,
        tenantId,
        role: 'homeowner',
        isVerified: false,
        isActive: true,
      })
      .returning();

    return role;
  }

  // ============================================
  // HOMEOWNER VERIFICATION
  // ============================================

  async verifyHomeowner(userId: string, tenantId: string, applicationId: string): Promise<schema.UserTenantRole | undefined> {
    const [updated] = await db
      .update(schema.userTenantRoles)
      .set({
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByApplicationId: applicationId,
      })
      .where(
        and(
          eq(schema.userTenantRoles.userId, userId),
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.role, 'homeowner'),
          eq(schema.userTenantRoles.isActive, true),
          eq(schema.userTenantRoles.isVerified, false) // Only update if not already verified
        )
      )
      .returning();

    return updated;
  }

  async isHomeownerVerified(userId: string, tenantId: string): Promise<boolean> {
    const roles = await this.getUserRolesForTenant(userId, tenantId);
    const homeownerRole = roles.find(r => r.role === 'homeowner');
    return homeownerRole?.isVerified ?? false;
  }
}

export const storage = new DbStorage();
