import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { eq, and, or, sql, inArray, notInArray, desc, asc, lt, gte, lte, isNull, isNotNull } from "drizzle-orm";
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
  // Email + password auth
  createUserWithPassword(data: { email: string; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<schema.User>;
  setUserPassword(userId: string, passwordHash: string): Promise<void>;
  setEmailVerified(userId: string): Promise<void>;
  incrementFailedLogins(userId: string): Promise<number>;
  resetFailedLogins(userId: string): Promise<void>;
  setLockedUntil(userId: string, lockedUntil: Date | null): Promise<void>;
  markUserMcpConnected(userId: string): Promise<boolean>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<schema.PasswordResetToken>;
  getPasswordResetTokenByHash(tokenHash: string): Promise<schema.PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: string): Promise<void>;
  createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<schema.EmailVerificationToken>;
  getEmailVerificationTokenByHash(tokenHash: string): Promise<schema.EmailVerificationToken | undefined>;
  markEmailVerificationTokenUsed(id: string): Promise<void>;
  
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
  getAccountAdminCommunities(managementCompanyId: string): Promise<Record<string, { id: string; name: string }[]>>;

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
  listAiFormGenerations(tenantId?: string, startDate?: Date, endDate?: Date): Promise<schema.AiFormGeneration[]>;
  updateAiFormGenerationStatus(id: string, status: string, approvedByUserId?: string): Promise<schema.AiFormGeneration>;
  linkFormTemplateToGeneration(generationId: string, formTemplateId: string): Promise<schema.AiFormGeneration>;

  // Documents
  createDocument(document: schema.InsertDocument): Promise<schema.Document>;
  getDocument(id: string): Promise<schema.Document | undefined>;
  listDocumentsByApplication(applicationId: string): Promise<schema.Document[]>;
  deleteDocument(id: string): Promise<void>;
  getDocumentsByRequirement(applicationId: string, requirementName: string): Promise<schema.Document[]>;

  // Research Dossier
  createDossierEntry(entry: schema.InsertResearchDossierEntry): Promise<schema.ResearchDossierEntry>;
  getDossierEntry(id: string): Promise<schema.ResearchDossierEntry | undefined>;
  listDossierEntriesByApplication(applicationId: string): Promise<schema.ResearchDossierEntry[]>;
  deleteDossierEntry(id: string): Promise<void>;
  setDossierEntryVerified(id: string, userId: string): Promise<schema.ResearchDossierEntry | undefined>;
  addDossierItem(item: schema.InsertResearchDossierItem): Promise<schema.ResearchDossierItem>;
  getDossierItem(id: string): Promise<schema.ResearchDossierItem | undefined>;
  listDossierItemsByEntry(entryId: string): Promise<schema.ResearchDossierItem[]>;
  deleteDossierItem(id: string): Promise<void>;
  getDossierForApplication(applicationId: string): Promise<(schema.ResearchDossierEntry & { items: schema.ResearchDossierItem[] })[]>;

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
  incrementTenantApplicationCount(tenantId: string): Promise<void>;
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
  listAllAiAnalyses(limit?: number, startDate?: Date, endDate?: Date): Promise<schema.AiAnalysis[]>;
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

  // ============================================
  // CO-APPLICANT SYSTEM
  // ============================================

  // Invitations
  createInvitation(invitation: schema.InsertInvitation): Promise<schema.Invitation>;
  getInvitation(id: string): Promise<schema.Invitation | undefined>;
  getInvitationByToken(token: string): Promise<schema.Invitation | undefined>;
  getPendingInvitationsForEmail(email: string): Promise<schema.Invitation[]>;
  updateInvitationStatus(id: string, status: string, acceptedAt?: Date, declinedAt?: Date): Promise<schema.Invitation>;
  revokeInvitation(id: string): Promise<schema.Invitation>;
  resendInvitation(id: string): Promise<schema.Invitation>;
  expireOldInvitations(): Promise<number>;

  // Household Members
  createHouseholdMember(member: schema.InsertHouseholdMember): Promise<schema.HouseholdMember>;
  getHouseholdMember(id: string): Promise<schema.HouseholdMember | undefined>;
  getHouseholdMembersForPrimaryUser(primaryUserId: string, tenantId: string): Promise<(schema.HouseholdMember & { memberUser: schema.User | null })[]>;
  getHouseholdMembershipsForUser(userId: string): Promise<(schema.HouseholdMember & { primaryUser: schema.User; tenant: schema.Tenant })[]>;
  updateHouseholdMemberStatus(id: string, status: string, removedByUserId?: string): Promise<schema.HouseholdMember>;
  acceptHouseholdInvitation(householdMemberId: string, memberUserId: string): Promise<schema.HouseholdMember>;
  isHouseholdMemberOf(userId: string, primaryUserId: string, tenantId: string): Promise<boolean>;
  getActiveHouseholdMemberIds(primaryUserId: string, tenantId: string): Promise<string[]>;

  // Contractors
  createContractor(contractor: schema.InsertContractor): Promise<schema.Contractor>;
  getContractor(id: string): Promise<schema.Contractor | undefined>;
  getContractorByUserId(userId: string): Promise<schema.Contractor | undefined>;
  getContractorByReferralCode(code: string): Promise<schema.Contractor | undefined>;
  updateContractor(id: string, updates: Partial<schema.InsertContractor>): Promise<schema.Contractor>;
  searchContractors(query: string, limit?: number): Promise<(schema.Contractor & { user: schema.User })[]>;
  generateReferralCode(contractorId: string, customCode?: string): Promise<string>;
  incrementContractorApplicationCount(contractorId: string): Promise<void>;
  incrementContractorReferralCount(contractorId: string, successful?: boolean): Promise<void>;

  // Application Collaborators
  createApplicationCollaborator(collaborator: schema.InsertApplicationCollaborator): Promise<schema.ApplicationCollaborator>;
  getApplicationCollaborator(id: string): Promise<schema.ApplicationCollaborator | undefined>;
  getApplicationCollaborators(applicationId: string): Promise<(schema.ApplicationCollaborator & { contractor: schema.Contractor & { user: schema.User } })[]>;
  getCollaboratorApplications(contractorId: string): Promise<(schema.ApplicationCollaborator & { application: schema.Application & { tenant: schema.Tenant } })[]>;
  updateApplicationCollaboratorStatus(id: string, status: string, acceptedAt?: Date, removedAt?: Date): Promise<schema.ApplicationCollaborator>;
  canContractorAccessApplication(userId: string, applicationId: string): Promise<boolean>;
  getContractorDashboard(contractorId: string): Promise<{
    applications: (schema.ApplicationCollaborator & { application: schema.Application & { tenant: schema.Tenant } })[];
    stats: { totalApplications: number; activeApplications: number; completedApplications: number };
  }>;

  // Contractor Referrals
  createContractorReferral(referral: schema.InsertContractorReferral): Promise<schema.ContractorReferral>;
  getContractorReferrals(contractorId: string): Promise<(schema.ContractorReferral & { tenant: schema.Tenant })[]>;
  updateReferralStatus(id: string, status: string, qualifiedAt?: Date, paidAt?: Date, payoutAmount?: string, payoutNotes?: string): Promise<schema.ContractorReferral>;
  getReferralStats(contractorId: string): Promise<{ total: number; qualified: number; paid: number; pending: number }>;

  // Tour Progress
  getTourProgress(userId: string, pageKey: string, role: string): Promise<schema.UserTourProgress | undefined>;
  getUserTourProgressList(userId: string): Promise<schema.UserTourProgress[]>;
  markTourCompleted(data: schema.InsertUserTourProgress): Promise<schema.UserTourProgress>;
  resetTourProgress(userId: string, pageKey?: string, role?: string): Promise<void>;

  // Tour Content Overrides (Admin)
  listTourContentOverrides(): Promise<schema.TourContentOverride[]>;
  getTourContentOverride(pageKey: string, role: string): Promise<schema.TourContentOverride | undefined>;
  upsertTourContentOverride(data: schema.InsertTourContentOverride): Promise<schema.TourContentOverride>;
  deleteTourContentOverride(pageKey: string, role: string): Promise<void>;

  // Delegated Application Edits
  createApplicationFieldEdit(edit: schema.InsertApplicationFieldEdit): Promise<schema.ApplicationFieldEdit>;
  getApplicationFieldEdits(applicationId: string): Promise<(schema.ApplicationFieldEdit & { editedByUser: { id: string; firstName: string | null; lastName: string | null } })[]>;
  getFieldEditHistory(applicationId: string, fieldPath: string): Promise<schema.ApplicationFieldEdit[]>;
  getApplicationEditSummary(applicationId: string): Promise<{
    totalEdits: number;
    editedFields: string[];
    lastEdit: schema.ApplicationFieldEdit | null;
    editorSummary: Array<{ userId: string; name: string; role: string; editCount: number }>;
  }>;

  // AI Context Sources
  listAiContextSources(tenantId: string, includeInactive?: boolean): Promise<schema.AiContextSource[]>;
  getAiContextSource(id: string): Promise<schema.AiContextSource | undefined>;
  createAiContextSource(source: schema.InsertAiContextSource): Promise<schema.AiContextSource>;
  updateAiContextSource(id: string, updates: Partial<schema.InsertAiContextSource>): Promise<schema.AiContextSource>;
  deleteAiContextSource(id: string): Promise<void>;
  toggleAiContextSource(id: string, isActive: boolean): Promise<schema.AiContextSource>;
  reorderAiContextSources(tenantId: string, orderedIds: string[]): Promise<void>;
  getActiveAiContextSourcesForForm(tenantId: string, formType?: string): Promise<schema.AiContextSource[]>;

  // AI Instructions
  listAiInstructions(tenantId: string, scope?: string, formType?: string): Promise<schema.AiInstruction[]>;
  getAiInstruction(id: string): Promise<schema.AiInstruction | undefined>;
  createAiInstruction(instruction: schema.InsertAiInstruction): Promise<schema.AiInstruction>;
  updateAiInstruction(id: string, updates: Partial<schema.InsertAiInstruction>): Promise<schema.AiInstruction>;
  deleteAiInstruction(id: string): Promise<void>;
  toggleAiInstruction(id: string, isActive: boolean): Promise<schema.AiInstruction>;
  getActiveInstructionsForAnalysis(tenantId: string, formType?: string): Promise<string>;

  // Community Residences (Neighborhood Archive)
  listCommunityResidences(tenantId: string): Promise<(schema.CommunityResidence & { photoCount: number; thumbnailPhotoId: string | null })[]>;
  getCommunityResidence(id: string): Promise<schema.CommunityResidence | undefined>;
  getCommunityResidenceByAddress(tenantId: string, normalizedAddress: string): Promise<schema.CommunityResidence | undefined>;
  createCommunityResidence(data: schema.InsertCommunityResidence): Promise<schema.CommunityResidence>;
  updateCommunityResidence(id: string, updates: Partial<schema.InsertCommunityResidence>): Promise<schema.CommunityResidence>;
  deleteCommunityResidence(id: string): Promise<void>;
  getLinkedApplications(tenantId: string, normalizedAddress: string): Promise<schema.Application[]>;
  getResidenceTimeline(residenceId: string, tenantId: string, normalizedAddress: string): Promise<any>;

  // Email Logs
  createEmailLog(log: schema.InsertEmailLog): Promise<schema.EmailLog>;
  getEmailLogById(id: string): Promise<schema.EmailLog | undefined>;
  getEmailLogsByApplication(applicationId: string): Promise<schema.EmailLog[]>;
  updateEmailLogByMessageId(messageId: string, updates: { status: string; deliveredAt?: Date; bouncedAt?: Date; openedAt?: Date; bounceType?: string; bounceReason?: string }): Promise<schema.EmailLog | undefined>;

  // Residence Photos
  listResidencePhotos(residenceId: string): Promise<schema.ResidencePhoto[]>;
  createResidencePhoto(data: schema.InsertResidencePhoto): Promise<schema.ResidencePhoto>;
  deleteResidencePhoto(id: string): Promise<void>;
  getResidencePhoto(id: string): Promise<schema.ResidencePhoto | undefined>;
  countResidencePhotosByType(residenceId: string, photoType: string): Promise<number>;

  // Residence Upload Tokens (QR Code Mobile Upload)
  createResidenceUploadToken(token: schema.InsertResidenceUploadToken): Promise<schema.ResidenceUploadToken>;
  getResidenceUploadToken(token: string): Promise<schema.ResidenceUploadToken | undefined>;
  markResidenceTokenAsUsed(token: string, photosUploaded: number): Promise<schema.ResidenceUploadToken>;

  // MCP Reviewer Tokens
  createMcpToken(data: { userId: string; tenantId: string; token: string; label?: string | null; expiresAt?: Date | null; source?: "plaintext" | "oauth"; oauthClientId?: string | null }): Promise<schema.McpToken>;
  listMcpTokensForUserInTenant(userId: string, tenantId: string): Promise<schema.McpToken[]>;
  getMcpTokenByValue(token: string): Promise<schema.McpToken | undefined>;
  revokeMcpToken(id: string, userId: string): Promise<schema.McpToken | undefined>;
  touchMcpToken(id: string): Promise<void>;
  logMcpToolCall(entry: schema.InsertMcpToolCall): Promise<void>;

  // MCP OAuth (DCR + authorization codes)
  createOauthClient(data: { clientName: string; redirectUris: string[]; scope?: string | null }): Promise<schema.OauthClient>;
  getOauthClient(clientId: string): Promise<schema.OauthClient | undefined>;
  touchOauthClient(clientId: string): Promise<void>;
  createAuthorizationCode(data: {
    code: string;
    clientId: string;
    userId: string;
    tenantId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope?: string | null;
    resource?: string | null;
    expiresAt: Date;
  }): Promise<schema.OauthAuthorizationCode>;
  consumeAuthorizationCode(code: string): Promise<schema.OauthAuthorizationCode | undefined>;
  deactivateOauthTokensForClient(userId: string, tenantId: string, oauthClientId: string): Promise<void>;
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

  // Email + password auth
  async createUserWithPassword(data: { email: string; passwordHash: string; firstName?: string | null; lastName?: string | null }): Promise<schema.User> {
    const [user] = await db
      .insert(schema.users)
      .values({
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
      })
      .returning();
    return user;
  }

  async setUserPassword(userId: string, passwordHash: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async setEmailVerified(userId: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async incrementFailedLogins(userId: string): Promise<number> {
    const [user] = await db
      .update(schema.users)
      .set({ failedLoginAttempts: sql`${schema.users.failedLoginAttempts} + 1`, updatedAt: new Date() })
      .where(eq(schema.users.id, userId))
      .returning({ failedLoginAttempts: schema.users.failedLoginAttempts });
    return user?.failedLoginAttempts ?? 0;
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await db
      .update(schema.users)
      .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  async setLockedUntil(userId: string, lockedUntil: Date | null): Promise<void> {
    await db
      .update(schema.users)
      .set({ lockedUntil, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
  }

  /**
   * Stamp the first-MCP-connect timestamp. Idempotent + cheap: the WHERE clause
   * only matches when mcp_connected_at IS NULL, so repeat MCP calls are no-ops
   * (no write). Returns true when this call was the one that set it (first
   * connect), which the caller may use to fire a one-time welcome.
   */
  async markUserMcpConnected(userId: string): Promise<boolean> {
    const rows = await db
      .update(schema.users)
      .set({ mcpConnectedAt: new Date() })
      .where(and(eq(schema.users.id, userId), isNull(schema.users.mcpConnectedAt)))
      .returning({ id: schema.users.id });
    return rows.length > 0;
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<schema.PasswordResetToken> {
    const [row] = await db
      .insert(schema.passwordResetTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    return row;
  }

  async getPasswordResetTokenByHash(tokenHash: string): Promise<schema.PasswordResetToken | undefined> {
    const [row] = await db
      .select()
      .from(schema.passwordResetTokens)
      .where(eq(schema.passwordResetTokens.tokenHash, tokenHash));
    return row;
  }

  async markPasswordResetTokenUsed(id: string): Promise<void> {
    await db
      .update(schema.passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.passwordResetTokens.id, id));
  }

  async createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<schema.EmailVerificationToken> {
    const [row] = await db
      .insert(schema.emailVerificationTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning();
    return row;
  }

  async getEmailVerificationTokenByHash(tokenHash: string): Promise<schema.EmailVerificationToken | undefined> {
    const [row] = await db
      .select()
      .from(schema.emailVerificationTokens)
      .where(eq(schema.emailVerificationTokens.tokenHash, tokenHash));
    return row;
  }

  async markEmailVerificationTokenUsed(id: string): Promise<void> {
    await db
      .update(schema.emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(schema.emailVerificationTokens.id, id));
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

  async getAccountAdminCommunities(managementCompanyId: string): Promise<Record<string, { id: string; name: string }[]>> {
    // Get all communities managed by this management company
    const managedCommunities = await this.getTenantsByManagementCompany(managementCompanyId);
    if (managedCommunities.length === 0) return {};

    const communityIds = managedCommunities.map(c => c.id);

    // Find all account_admin role assignments at those communities
    const adminRoles = await db
      .select({
        userId: schema.userTenantRoles.userId,
        tenantId: schema.userTenantRoles.tenantId,
      })
      .from(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.role, 'account_admin'),
          eq(schema.userTenantRoles.isActive, true),
          inArray(schema.userTenantRoles.tenantId, communityIds)
        )
      );

    // Build a lookup of community id -> name
    const communityMap = new Map(managedCommunities.map(c => [c.id, c.name]));

    // Group by userId
    const result: Record<string, { id: string; name: string }[]> = {};
    for (const row of adminRoles) {
      if (!result[row.userId]) {
        result[row.userId] = [];
      }
      result[row.userId].push({
        id: row.tenantId,
        name: communityMap.get(row.tenantId) || 'Unknown Community',
      });
    }

    return result;
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

  async listAiFormGenerations(tenantId?: string, startDate?: Date, endDate?: Date): Promise<schema.AiFormGeneration[]> {
    const conditions = [];

    if (tenantId) {
      conditions.push(eq(schema.aiFormGenerations.tenantId, tenantId));
    }
    if (startDate) {
      conditions.push(gte(schema.aiFormGenerations.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.aiFormGenerations.createdAt, endDate));
    }

    if (conditions.length > 0) {
      return db.select().from(schema.aiFormGenerations)
        .where(and(...conditions))
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

  // Research Dossier
  async createDossierEntry(entry: schema.InsertResearchDossierEntry): Promise<schema.ResearchDossierEntry> {
    const [created] = await db.insert(schema.researchDossierEntries)
      .values(entry)
      .returning();
    return created;
  }

  async getDossierEntry(id: string): Promise<schema.ResearchDossierEntry | undefined> {
    const [entry] = await db.select()
      .from(schema.researchDossierEntries)
      .where(eq(schema.researchDossierEntries.id, id))
      .limit(1);
    return entry;
  }

  async listDossierEntriesByApplication(applicationId: string): Promise<schema.ResearchDossierEntry[]> {
    return await db.select()
      .from(schema.researchDossierEntries)
      .where(eq(schema.researchDossierEntries.applicationId, applicationId))
      .orderBy(desc(schema.researchDossierEntries.createdAt));
  }

  async deleteDossierEntry(id: string): Promise<void> {
    await db.delete(schema.researchDossierEntries)
      .where(eq(schema.researchDossierEntries.id, id));
  }

  async setDossierEntryVerified(id: string, userId: string): Promise<schema.ResearchDossierEntry | undefined> {
    const [updated] = await db.update(schema.researchDossierEntries)
      .set({ verifiedByUserId: userId, verifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.researchDossierEntries.id, id))
      .returning();
    return updated;
  }

  async addDossierItem(item: schema.InsertResearchDossierItem): Promise<schema.ResearchDossierItem> {
    const [created] = await db.insert(schema.researchDossierItems)
      .values(item)
      .returning();
    return created;
  }

  async getDossierItem(id: string): Promise<schema.ResearchDossierItem | undefined> {
    const [item] = await db.select()
      .from(schema.researchDossierItems)
      .where(eq(schema.researchDossierItems.id, id))
      .limit(1);
    return item;
  }

  async listDossierItemsByEntry(entryId: string): Promise<schema.ResearchDossierItem[]> {
    return await db.select()
      .from(schema.researchDossierItems)
      .where(eq(schema.researchDossierItems.entryId, entryId))
      .orderBy(asc(schema.researchDossierItems.position));
  }

  async deleteDossierItem(id: string): Promise<void> {
    await db.delete(schema.researchDossierItems)
      .where(eq(schema.researchDossierItems.id, id));
  }

  async getDossierForApplication(applicationId: string): Promise<(schema.ResearchDossierEntry & { items: schema.ResearchDossierItem[] })[]> {
    const entries = await this.listDossierEntriesByApplication(applicationId);
    if (entries.length === 0) return [];
    const entryIds = entries.map((e) => e.id);
    const items = await db.select()
      .from(schema.researchDossierItems)
      .where(inArray(schema.researchDossierItems.entryId, entryIds))
      .orderBy(asc(schema.researchDossierItems.position));
    const byEntry = new Map<string, schema.ResearchDossierItem[]>();
    for (const item of items) {
      const list = byEntry.get(item.entryId) ?? [];
      list.push(item);
      byEntry.set(item.entryId, list);
    }
    return entries.map((e) => ({ ...e, items: byEntry.get(e.id) ?? [] }));
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

  async incrementTenantApplicationCount(tenantId: string): Promise<void> {
    await db.execute(sql`
      UPDATE tenant_subscriptions
      SET usage_applications_current_month = COALESCE(usage_applications_current_month, 0) + 1,
          updated_at = NOW()
      WHERE tenant_id = ${tenantId}
    `);
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

  async createComplianceItem(item: any): Promise<schema.ComplianceItem> {
    // Calculate initial status based on due date
    const now = new Date();
    // Ensure dueDate is a proper Date object
    const parsedDueDate = item.dueDate instanceof Date ? item.dueDate : new Date(item.dueDate);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let status = 'pending';
    if (parsedDueDate < now) {
      status = 'overdue';
    } else if (parsedDueDate <= thirtyDaysFromNow) {
      status = 'upcoming';
    }

    const [created] = await db
      .insert(schema.complianceItems)
      .values({
        scope: String(item.scope),
        propertyId: item.propertyId || null,
        managementCompanyId: item.managementCompanyId || null,
        categoryId: String(item.categoryId),
        title: String(item.title),
        description: item.description || null,
        dueDate: parsedDueDate,
        recurrencePattern: item.recurrencePattern || 'none',
        recurrenceDay: item.recurrenceDay || null,
        recurrenceMonth: item.recurrenceMonth || null,
        priority: item.priority || 'normal',
        reminderDays: item.reminderDays || [30, 14, 7, 1],
        notes: item.notes || null,
        externalReference: item.externalReference || null,
        createdByUserId: item.createdByUserId || null,
        demoCodeId: item.demoCodeId || null,
        status: status,
      })
      .returning();
    return created;
  }

  async updateComplianceItem(id: string, updates: Partial<schema.InsertComplianceItem>): Promise<schema.ComplianceItem> {
    // Convert dueDate to Date object if provided as string
    const processedUpdates = {
      ...updates,
      ...(updates.dueDate ? { dueDate: new Date(updates.dueDate) } : {}),
      updatedAt: new Date()
    };

    const [updated] = await db
      .update(schema.complianceItems)
      .set(processedUpdates)
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

  async listAllAiAnalyses(limit = 100, startDate?: Date, endDate?: Date): Promise<schema.AiAnalysis[]> {
    const conditions = [];

    if (startDate) {
      conditions.push(gte(schema.aiAnalyses.queuedAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.aiAnalyses.queuedAt, endDate));
    }

    if (conditions.length > 0) {
      return db
        .select()
        .from(schema.aiAnalyses)
        .where(and(...conditions))
        .orderBy(desc(schema.aiAnalyses.queuedAt))
        .limit(limit);
    }

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

  // ============================================
  // CO-APPLICANT SYSTEM IMPLEMENTATIONS
  // ============================================

  // Invitations
  async createInvitation(invitation: schema.InsertInvitation): Promise<schema.Invitation> {
    const [created] = await db.insert(schema.invitations).values(invitation).returning();
    return created;
  }

  async getInvitation(id: string): Promise<schema.Invitation | undefined> {
    const [invitation] = await db.select().from(schema.invitations).where(eq(schema.invitations.id, id));
    return invitation;
  }

  async getInvitationByToken(token: string): Promise<schema.Invitation | undefined> {
    const [invitation] = await db.select().from(schema.invitations).where(eq(schema.invitations.token, token));
    return invitation;
  }

  async getPendingInvitationsForEmail(email: string): Promise<schema.Invitation[]> {
    return db.select()
      .from(schema.invitations)
      .where(
        and(
          eq(schema.invitations.inviteeEmail, email.toLowerCase()),
          eq(schema.invitations.status, 'pending')
        )
      );
  }

  async updateInvitationStatus(id: string, status: string, acceptedAt?: Date, declinedAt?: Date): Promise<schema.Invitation> {
    const updates: any = { status };
    if (acceptedAt) updates.acceptedAt = acceptedAt;
    if (declinedAt) updates.declinedAt = declinedAt;

    const [updated] = await db.update(schema.invitations)
      .set(updates)
      .where(eq(schema.invitations.id, id))
      .returning();
    return updated;
  }

  async revokeInvitation(id: string): Promise<schema.Invitation> {
    const [revoked] = await db.update(schema.invitations)
      .set({ status: 'revoked' })
      .where(eq(schema.invitations.id, id))
      .returning();
    return revoked;
  }

  async resendInvitation(id: string): Promise<schema.Invitation> {
    const [updated] = await db.update(schema.invitations)
      .set({
        emailResendCount: sql`${schema.invitations.emailResendCount} + 1`,
        lastResendAt: new Date()
      })
      .where(eq(schema.invitations.id, id))
      .returning();
    return updated;
  }

  async expireOldInvitations(): Promise<number> {
    const result = await db.update(schema.invitations)
      .set({ status: 'expired' })
      .where(
        and(
          eq(schema.invitations.status, 'pending'),
          lt(schema.invitations.expiresAt, new Date())
        )
      );
    return result.rowCount ?? 0;
  }

  // Household Members
  async createHouseholdMember(member: schema.InsertHouseholdMember): Promise<schema.HouseholdMember> {
    const [created] = await db.insert(schema.householdMembers).values(member).returning();
    return created;
  }

  async getHouseholdMember(id: string): Promise<schema.HouseholdMember | undefined> {
    const [member] = await db.select().from(schema.householdMembers).where(eq(schema.householdMembers.id, id));
    return member;
  }

  async getHouseholdMembersForPrimaryUser(primaryUserId: string, tenantId: string): Promise<(schema.HouseholdMember & { memberUser: schema.User | null })[]> {
    const members = await db.select({
      householdMember: schema.householdMembers,
      memberUser: schema.users,
    })
      .from(schema.householdMembers)
      .leftJoin(schema.users, eq(schema.householdMembers.memberUserId, schema.users.id))
      .where(
        and(
          eq(schema.householdMembers.primaryUserId, primaryUserId),
          eq(schema.householdMembers.tenantId, tenantId),
          or(
            eq(schema.householdMembers.status, 'pending'),
            eq(schema.householdMembers.status, 'active')
          )
        )
      );

    return members.map(m => ({
      ...m.householdMember,
      memberUser: m.memberUser,
    }));
  }

  async getHouseholdMembershipsForUser(userId: string): Promise<(schema.HouseholdMember & { primaryUser: schema.User; tenant: schema.Tenant })[]> {
    const memberships = await db.select({
      householdMember: schema.householdMembers,
      primaryUser: schema.users,
      tenant: schema.tenants,
    })
      .from(schema.householdMembers)
      .innerJoin(schema.users, eq(schema.householdMembers.primaryUserId, schema.users.id))
      .innerJoin(schema.tenants, eq(schema.householdMembers.tenantId, schema.tenants.id))
      .where(
        and(
          eq(schema.householdMembers.memberUserId, userId),
          eq(schema.householdMembers.status, 'active')
        )
      );

    return memberships.map(m => ({
      ...m.householdMember,
      primaryUser: m.primaryUser,
      tenant: m.tenant,
    }));
  }

  async updateHouseholdMemberStatus(id: string, status: string, removedByUserId?: string): Promise<schema.HouseholdMember> {
    const updates: any = { status, updatedAt: new Date() };
    if (status === 'removed' || status === 'left') {
      updates.removedAt = new Date();
      if (removedByUserId) updates.removedByUserId = removedByUserId;
    }

    const [updated] = await db.update(schema.householdMembers)
      .set(updates)
      .where(eq(schema.householdMembers.id, id))
      .returning();
    return updated;
  }

  async acceptHouseholdInvitation(householdMemberId: string, memberUserId: string): Promise<schema.HouseholdMember> {
    const [updated] = await db.update(schema.householdMembers)
      .set({
        memberUserId,
        status: 'active',
        acceptedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.householdMembers.id, householdMemberId))
      .returning();
    return updated;
  }

  async isHouseholdMemberOf(userId: string, primaryUserId: string, tenantId: string): Promise<boolean> {
    const [member] = await db.select()
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.memberUserId, userId),
          eq(schema.householdMembers.primaryUserId, primaryUserId),
          eq(schema.householdMembers.tenantId, tenantId),
          eq(schema.householdMembers.status, 'active')
        )
      );
    return !!member;
  }

  async getActiveHouseholdMemberIds(primaryUserId: string, tenantId: string): Promise<string[]> {
    const members = await db.select({ memberUserId: schema.householdMembers.memberUserId })
      .from(schema.householdMembers)
      .where(
        and(
          eq(schema.householdMembers.primaryUserId, primaryUserId),
          eq(schema.householdMembers.tenantId, tenantId),
          eq(schema.householdMembers.status, 'active'),
          isNotNull(schema.householdMembers.memberUserId)
        )
      );
    return members.map(m => m.memberUserId!).filter(Boolean);
  }

  // Contractors
  async createContractor(contractor: schema.InsertContractor): Promise<schema.Contractor> {
    const [created] = await db.insert(schema.contractors).values(contractor).returning();
    return created;
  }

  async getContractor(id: string): Promise<schema.Contractor | undefined> {
    const [contractor] = await db.select().from(schema.contractors).where(eq(schema.contractors.id, id));
    return contractor;
  }

  async getContractorByUserId(userId: string): Promise<schema.Contractor | undefined> {
    const [contractor] = await db.select().from(schema.contractors).where(eq(schema.contractors.userId, userId));
    return contractor;
  }

  async getContractorByReferralCode(code: string): Promise<schema.Contractor | undefined> {
    const [contractor] = await db.select().from(schema.contractors).where(eq(schema.contractors.referralCode, code.toUpperCase()));
    return contractor;
  }

  async updateContractor(id: string, updates: Partial<schema.InsertContractor>): Promise<schema.Contractor> {
    const [updated] = await db.update(schema.contractors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.contractors.id, id))
      .returning();
    return updated;
  }

  async searchContractors(query: string, limit = 20): Promise<(schema.Contractor & { user: schema.User })[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const results = await db.select({
      contractor: schema.contractors,
      user: schema.users,
    })
      .from(schema.contractors)
      .innerJoin(schema.users, eq(schema.contractors.userId, schema.users.id))
      .where(
        and(
          eq(schema.contractors.isPubliclySearchable, true),
          or(
            sql`LOWER(${schema.contractors.companyName}) LIKE ${searchTerm}`,
            sql`LOWER(${schema.users.firstName}) LIKE ${searchTerm}`,
            sql`LOWER(${schema.users.lastName}) LIKE ${searchTerm}`,
            sql`LOWER(${schema.users.email}) LIKE ${searchTerm}`
          )
        )
      )
      .limit(limit);

    return results.map(r => ({
      ...r.contractor,
      user: r.user,
    }));
  }

  async generateReferralCode(contractorId: string, customCode?: string): Promise<string> {
    // Generate a unique referral code
    let code: string;
    if (customCode) {
      code = customCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      // Check if custom code is already taken
      const existing = await this.getContractorByReferralCode(code);
      if (existing && existing.id !== contractorId) {
        throw new Error('This referral code is already taken');
      }
    } else {
      // Generate random 8-character code
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoiding ambiguous characters
      code = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    await db.update(schema.contractors)
      .set({
        referralCode: code,
        referralCodeCreatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(schema.contractors.id, contractorId));

    return code;
  }

  async incrementContractorApplicationCount(contractorId: string): Promise<void> {
    await db.update(schema.contractors)
      .set({
        totalApplications: sql`${schema.contractors.totalApplications} + 1`,
        updatedAt: new Date()
      })
      .where(eq(schema.contractors.id, contractorId));
  }

  async incrementContractorReferralCount(contractorId: string, successful = false): Promise<void> {
    const updates: any = {
      totalReferrals: sql`${schema.contractors.totalReferrals} + 1`,
      updatedAt: new Date()
    };
    if (successful) {
      updates.successfulReferrals = sql`${schema.contractors.successfulReferrals} + 1`;
    }
    await db.update(schema.contractors)
      .set(updates)
      .where(eq(schema.contractors.id, contractorId));
  }

  // Application Collaborators
  async createApplicationCollaborator(collaborator: schema.InsertApplicationCollaborator): Promise<schema.ApplicationCollaborator> {
    const [created] = await db.insert(schema.applicationCollaborators).values(collaborator).returning();
    // Increment contractor's application count
    await this.incrementContractorApplicationCount(collaborator.contractorId);
    return created;
  }

  async getApplicationCollaborator(id: string): Promise<schema.ApplicationCollaborator | undefined> {
    const [collaborator] = await db.select().from(schema.applicationCollaborators).where(eq(schema.applicationCollaborators.id, id));
    return collaborator;
  }

  async getApplicationCollaborators(applicationId: string): Promise<(schema.ApplicationCollaborator & { contractor: schema.Contractor & { user: schema.User } })[]> {
    const collaborators = await db.select({
      collaborator: schema.applicationCollaborators,
      contractor: schema.contractors,
      user: schema.users,
    })
      .from(schema.applicationCollaborators)
      .innerJoin(schema.contractors, eq(schema.applicationCollaborators.contractorId, schema.contractors.id))
      .innerJoin(schema.users, eq(schema.contractors.userId, schema.users.id))
      .where(
        and(
          eq(schema.applicationCollaborators.applicationId, applicationId),
          or(
            eq(schema.applicationCollaborators.status, 'pending'),
            eq(schema.applicationCollaborators.status, 'active')
          )
        )
      );

    return collaborators.map(c => ({
      ...c.collaborator,
      contractor: {
        ...c.contractor,
        user: c.user,
      },
    }));
  }

  async getCollaboratorApplications(contractorId: string): Promise<(schema.ApplicationCollaborator & { application: schema.Application & { tenant: schema.Tenant } })[]> {
    const collaborations = await db.select({
      collaborator: schema.applicationCollaborators,
      application: schema.applications,
      tenant: schema.tenants,
    })
      .from(schema.applicationCollaborators)
      .innerJoin(schema.applications, eq(schema.applicationCollaborators.applicationId, schema.applications.id))
      .innerJoin(schema.tenants, eq(schema.applications.tenantId, schema.tenants.id))
      .where(eq(schema.applicationCollaborators.contractorId, contractorId))
      .orderBy(desc(schema.applicationCollaborators.invitedAt));

    return collaborations.map(c => ({
      ...c.collaborator,
      application: {
        ...c.application,
        tenant: c.tenant,
      },
    }));
  }

  async updateApplicationCollaboratorStatus(id: string, status: string, acceptedAt?: Date, removedAt?: Date): Promise<schema.ApplicationCollaborator> {
    const updates: any = { status };
    if (acceptedAt) updates.acceptedAt = acceptedAt;
    if (removedAt) updates.removedAt = removedAt;

    const [updated] = await db.update(schema.applicationCollaborators)
      .set(updates)
      .where(eq(schema.applicationCollaborators.id, id))
      .returning();
    return updated;
  }

  async canContractorAccessApplication(userId: string, applicationId: string): Promise<boolean> {
    // First, get the contractor profile for this user
    const contractor = await this.getContractorByUserId(userId);
    if (!contractor) return false;

    // Check if they have an active collaboration on this application
    const [collaboration] = await db.select()
      .from(schema.applicationCollaborators)
      .where(
        and(
          eq(schema.applicationCollaborators.contractorId, contractor.id),
          eq(schema.applicationCollaborators.applicationId, applicationId),
          eq(schema.applicationCollaborators.status, 'active')
        )
      );

    return !!collaboration;
  }

  async getContractorDashboard(contractorId: string): Promise<{
    applications: (schema.ApplicationCollaborator & { application: schema.Application & { tenant: schema.Tenant } })[];
    stats: { totalApplications: number; activeApplications: number; completedApplications: number };
  }> {
    const applications = await this.getCollaboratorApplications(contractorId);

    const stats = {
      totalApplications: applications.length,
      activeApplications: applications.filter(a => a.status === 'active' || a.status === 'pending').length,
      completedApplications: applications.filter(a => a.status === 'completed').length,
    };

    return { applications, stats };
  }

  // Contractor Referrals
  async createContractorReferral(referral: schema.InsertContractorReferral): Promise<schema.ContractorReferral> {
    const [created] = await db.insert(schema.contractorReferrals).values(referral).returning();
    // Increment contractor's referral count
    await this.incrementContractorReferralCount(referral.contractorId);
    return created;
  }

  async getContractorReferrals(contractorId: string): Promise<(schema.ContractorReferral & { tenant: schema.Tenant })[]> {
    const referrals = await db.select({
      referral: schema.contractorReferrals,
      tenant: schema.tenants,
    })
      .from(schema.contractorReferrals)
      .innerJoin(schema.tenants, eq(schema.contractorReferrals.tenantId, schema.tenants.id))
      .where(eq(schema.contractorReferrals.contractorId, contractorId))
      .orderBy(desc(schema.contractorReferrals.signedUpAt));

    return referrals.map(r => ({
      ...r.referral,
      tenant: r.tenant,
    }));
  }

  async updateReferralStatus(id: string, status: string, qualifiedAt?: Date, paidAt?: Date, payoutAmount?: string, payoutNotes?: string): Promise<schema.ContractorReferral> {
    const updates: any = { status, updatedAt: new Date() };
    if (qualifiedAt) updates.qualifiedAt = qualifiedAt;
    if (paidAt) updates.paidAt = paidAt;
    if (payoutAmount) updates.payoutAmount = payoutAmount;
    if (payoutNotes) updates.payoutNotes = payoutNotes;

    const [updated] = await db.update(schema.contractorReferrals)
      .set(updates)
      .where(eq(schema.contractorReferrals.id, id))
      .returning();

    // If marking as qualified/successful, update contractor's successful referral count
    if (status === 'qualified') {
      await this.incrementContractorReferralCount(updated.contractorId, true);
    }

    return updated;
  }

  async getReferralStats(contractorId: string): Promise<{ total: number; qualified: number; paid: number; pending: number }> {
    const referrals = await db.select({ status: schema.contractorReferrals.status })
      .from(schema.contractorReferrals)
      .where(eq(schema.contractorReferrals.contractorId, contractorId));

    return {
      total: referrals.length,
      qualified: referrals.filter(r => r.status === 'qualified').length,
      paid: referrals.filter(r => r.status === 'paid').length,
      pending: referrals.filter(r => r.status === 'pending').length,
    };
  }

  // ============================================
  // Tour Progress
  // ============================================

  async getTourProgress(userId: string, pageKey: string, role: string): Promise<schema.UserTourProgress | undefined> {
    const [progress] = await db.select()
      .from(schema.userTourProgress)
      .where(
        and(
          eq(schema.userTourProgress.userId, userId),
          eq(schema.userTourProgress.pageKey, pageKey),
          eq(schema.userTourProgress.role, role)
        )
      );
    return progress;
  }

  async getUserTourProgressList(userId: string): Promise<schema.UserTourProgress[]> {
    return db.select()
      .from(schema.userTourProgress)
      .where(eq(schema.userTourProgress.userId, userId));
  }

  async markTourCompleted(data: schema.InsertUserTourProgress): Promise<schema.UserTourProgress> {
    const [progress] = await db.insert(schema.userTourProgress)
      .values({
        ...data,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.userTourProgress.userId, schema.userTourProgress.pageKey, schema.userTourProgress.role],
        set: {
          completedAt: new Date(),
        },
      })
      .returning();
    return progress;
  }

  async resetTourProgress(userId: string, pageKey?: string, role?: string): Promise<void> {
    const conditions = [eq(schema.userTourProgress.userId, userId)];
    if (pageKey) {
      conditions.push(eq(schema.userTourProgress.pageKey, pageKey));
    }
    if (role) {
      conditions.push(eq(schema.userTourProgress.role, role));
    }
    await db.delete(schema.userTourProgress).where(and(...conditions));
  }

  // Tour Content Overrides (Admin)
  async listTourContentOverrides(): Promise<schema.TourContentOverride[]> {
    return db.select()
      .from(schema.tourContentOverrides)
      .orderBy(schema.tourContentOverrides.pageKey, schema.tourContentOverrides.role);
  }

  async getTourContentOverride(pageKey: string, role: string): Promise<schema.TourContentOverride | undefined> {
    const [override] = await db.select()
      .from(schema.tourContentOverrides)
      .where(
        and(
          eq(schema.tourContentOverrides.pageKey, pageKey),
          eq(schema.tourContentOverrides.role, role)
        )
      );
    return override;
  }

  async upsertTourContentOverride(data: schema.InsertTourContentOverride): Promise<schema.TourContentOverride> {
    const [override] = await db.insert(schema.tourContentOverrides)
      .values(data)
      .onConflictDoUpdate({
        target: [schema.tourContentOverrides.pageKey, schema.tourContentOverrides.role],
        set: {
          pageTitle: data.pageTitle,
          isEnabled: data.isEnabled,
          steps: data.steps,
          updatedByUserId: data.updatedByUserId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return override;
  }

  async deleteTourContentOverride(pageKey: string, role: string): Promise<void> {
    await db.delete(schema.tourContentOverrides)
      .where(
        and(
          eq(schema.tourContentOverrides.pageKey, pageKey),
          eq(schema.tourContentOverrides.role, role)
        )
      );
  }

  // ============================================
  // INTELLIGENT AGENDA SYSTEM
  // ============================================

  // Agenda Sections
  async listAgendaSections(): Promise<schema.AgendaSection[]> {
    return db.select()
      .from(schema.agendaSections)
      .orderBy(schema.agendaSections.sortOrder);
  }

  async getAgendaSection(id: string): Promise<schema.AgendaSection | undefined> {
    const [section] = await db.select()
      .from(schema.agendaSections)
      .where(eq(schema.agendaSections.id, id));
    return section;
  }

  async getAgendaSectionBySlug(slug: string): Promise<schema.AgendaSection | undefined> {
    const [section] = await db.select()
      .from(schema.agendaSections)
      .where(eq(schema.agendaSections.slug, slug));
    return section;
  }

  // Meeting Templates
  async listMeetingTemplates(tenantId?: string): Promise<schema.MeetingTemplate[]> {
    // Get system templates (null tenantId) and optionally tenant-specific ones
    const conditions = [eq(schema.meetingTemplates.isActive, true)];

    if (tenantId) {
      // Include both system templates and tenant-specific ones
      return db.select()
        .from(schema.meetingTemplates)
        .where(
          and(
            eq(schema.meetingTemplates.isActive, true),
            or(
              isNull(schema.meetingTemplates.tenantId),
              eq(schema.meetingTemplates.tenantId, tenantId)
            )
          )
        )
        .orderBy(schema.meetingTemplates.name);
    }

    // Just system templates
    return db.select()
      .from(schema.meetingTemplates)
      .where(
        and(
          eq(schema.meetingTemplates.isActive, true),
          isNull(schema.meetingTemplates.tenantId)
        )
      )
      .orderBy(schema.meetingTemplates.name);
  }

  async getMeetingTemplate(id: string): Promise<schema.MeetingTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.meetingTemplates)
      .where(eq(schema.meetingTemplates.id, id));
    return template;
  }

  async getDefaultMeetingTemplate(eventTypeSlug: string): Promise<schema.MeetingTemplate | undefined> {
    const [template] = await db.select()
      .from(schema.meetingTemplates)
      .where(
        and(
          eq(schema.meetingTemplates.eventTypeSlug, eventTypeSlug),
          eq(schema.meetingTemplates.isDefault, true),
          eq(schema.meetingTemplates.isActive, true)
        )
      );
    return template;
  }

  async createMeetingTemplate(data: schema.InsertMeetingTemplate): Promise<schema.MeetingTemplate> {
    const [template] = await db.insert(schema.meetingTemplates)
      .values(data)
      .returning();
    return template;
  }

  async updateMeetingTemplate(id: string, data: Partial<schema.InsertMeetingTemplate>): Promise<schema.MeetingTemplate> {
    const [template] = await db.update(schema.meetingTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.meetingTemplates.id, id))
      .returning();
    return template;
  }

  // Event Agenda Items
  async getEventAgenda(eventId: string): Promise<{
    sections: schema.AgendaSection[];
    items: (schema.EventAgendaItem & { application?: schema.Application; presenter?: schema.User })[];
  }> {
    // Get all agenda sections
    const sections = await this.listAgendaSections();

    // Get all agenda items for this event with related data
    const items = await db.select({
      item: schema.eventAgendaItems,
      application: schema.applications,
      presenter: schema.users,
    })
      .from(schema.eventAgendaItems)
      .leftJoin(schema.applications, eq(schema.eventAgendaItems.applicationId, schema.applications.id))
      .leftJoin(schema.users, eq(schema.eventAgendaItems.presenterId, schema.users.id))
      .where(eq(schema.eventAgendaItems.eventId, eventId))
      .orderBy(schema.eventAgendaItems.sectionId, schema.eventAgendaItems.orderIndex);

    return {
      sections,
      items: items.map(row => ({
        ...row.item,
        application: row.application || undefined,
        presenter: row.presenter || undefined,
      })),
    };
  }

  async addAgendaItem(data: schema.InsertEventAgendaItem): Promise<schema.EventAgendaItem> {
    const [item] = await db.insert(schema.eventAgendaItems)
      .values(data)
      .returning();
    if (!item) {
      throw new Error('Failed to create agenda item');
    }
    return item;
  }

  async updateAgendaItem(id: string, data: Partial<schema.InsertEventAgendaItem>): Promise<schema.EventAgendaItem> {
    const [item] = await db.update(schema.eventAgendaItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.eventAgendaItems.id, id))
      .returning();
    return item;
  }

  async deleteAgendaItem(id: string): Promise<void> {
    await db.delete(schema.eventAgendaItems)
      .where(eq(schema.eventAgendaItems.id, id));
  }

  async reorderAgendaItems(eventId: string, sectionId: string, itemIds: string[]): Promise<void> {
    // Update order indexes for all items in the section
    for (let i = 0; i < itemIds.length; i++) {
      await db.update(schema.eventAgendaItems)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(
          and(
            eq(schema.eventAgendaItems.id, itemIds[i]),
            eq(schema.eventAgendaItems.eventId, eventId),
            eq(schema.eventAgendaItems.sectionId, sectionId)
          )
        );
    }
  }

  // Application Journey - get all meetings an application has been part of
  async getApplicationJourney(applicationId: string): Promise<{
    meetings: Array<{
      event: schema.Event;
      agendaItem: schema.EventAgendaItem;
      section: schema.AgendaSection;
    }>;
  }> {
    const rows = await db.select({
      event: schema.events,
      agendaItem: schema.eventAgendaItems,
      section: schema.agendaSections,
    })
      .from(schema.eventAgendaItems)
      .innerJoin(schema.events, eq(schema.eventAgendaItems.eventId, schema.events.id))
      .innerJoin(schema.agendaSections, eq(schema.eventAgendaItems.sectionId, schema.agendaSections.id))
      .where(eq(schema.eventAgendaItems.applicationId, applicationId))
      .orderBy(schema.events.startDatetime);

    return {
      meetings: rows.map(row => ({
        event: row.event,
        agendaItem: row.agendaItem,
        section: row.section,
      })),
    };
  }

  // Smart Suggestions - get applications that need review
  async getAgendaSuggestions(tenantId: string): Promise<{
    newBusiness: schema.Application[];
    oldBusiness: schema.Application[];
    finalApproval: schema.Application[];
  }> {
    // Get all non-terminated applications for this tenant
    // Excluded: rejected and withdrawn are terminal states
    const terminatedStatuses = ['rejected', 'withdrawn'];
    const applications = await db.select()
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.tenantId, tenantId),
          notInArray(schema.applications.status, terminatedStatuses)
        )
      )
      .orderBy(schema.applications.submittedAt);

    // For each application, get its meeting history to determine review stage
    const categorized: {
      newBusiness: schema.Application[];
      oldBusiness: schema.Application[];
      finalApproval: schema.Application[];
    } = {
      newBusiness: [],
      oldBusiness: [],
      finalApproval: [],
    };

    for (const app of applications) {
      // Get meeting history
      const history = await db.select({
        decision: schema.eventAgendaItems.decision,
        addedAt: schema.eventAgendaItems.addedAt,
      })
        .from(schema.eventAgendaItems)
        .where(eq(schema.eventAgendaItems.applicationId, app.id))
        .orderBy(schema.eventAgendaItems.addedAt);

      // Determine review stage
      if (history.length === 0) {
        categorized.newBusiness.push(app);
      } else {
        const lastDecision = history[history.length - 1].decision;
        if (['tabled', 'needs_info', 'deferred'].includes(lastDecision || '')) {
          categorized.oldBusiness.push(app);
        } else if (lastDecision === 'conditional' || lastDecision === 'recommended') {
          categorized.finalApproval.push(app);
        } else {
          // Default to old business if seen before
          categorized.oldBusiness.push(app);
        }
      }
    }

    return categorized;
  }

  // Finalize agenda
  async finalizeEventAgenda(eventId: string, userId: string): Promise<schema.Event> {
    const [event] = await db.update(schema.events)
      .set({
        agendaFinalized: true,
        agendaFinalizedAt: new Date(),
        agendaFinalizedByUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();
    return event;
  }

  async unfinalizeEventAgenda(eventId: string): Promise<schema.Event> {
    const [event] = await db.update(schema.events)
      .set({
        agendaFinalized: false,
        agendaFinalizedAt: null,
        agendaFinalizedByUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();
    return event;
  }

  // ==================== Meeting Facilitator Methods ====================

  async claimFacilitator(eventId: string, userId: string): Promise<schema.Event> {
    const [event] = await db.update(schema.events)
      .set({
        facilitatorUserId: userId,
        facilitatorClaimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();
    return event;
  }

  async releaseFacilitator(eventId: string): Promise<schema.Event> {
    const [event] = await db.update(schema.events)
      .set({
        facilitatorUserId: null,
        facilitatorClaimedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();
    return event;
  }

  async startMeeting(eventId: string): Promise<schema.Event> {
    const [event] = await db.update(schema.events)
      .set({
        meetingStartedAt: new Date(),
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();
    return event;
  }

  async endMeeting(eventId: string): Promise<schema.Event> {
    const [event] = await db.update(schema.events)
      .set({
        meetingEndedAt: new Date(),
        status: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(schema.events.id, eventId))
      .returning();
    return event;
  }

  // ==================== Section Completion Methods ====================

  async markSectionComplete(
    eventId: string,
    sectionId: string,
    userId: string,
    notes?: string
  ): Promise<schema.MeetingSectionCompletion> {
    const [completion] = await db.insert(schema.meetingSectionCompletions)
      .values({
        eventId,
        sectionId,
        completedByUserId: userId,
        notes: notes || null,
      })
      .onConflictDoUpdate({
        target: [schema.meetingSectionCompletions.eventId, schema.meetingSectionCompletions.sectionId],
        set: {
          completedByUserId: userId,
          completedAt: new Date(),
          notes: notes || null,
        },
      })
      .returning();
    return completion;
  }

  async unmarkSectionComplete(eventId: string, sectionId: string): Promise<void> {
    await db.delete(schema.meetingSectionCompletions)
      .where(
        and(
          eq(schema.meetingSectionCompletions.eventId, eventId),
          eq(schema.meetingSectionCompletions.sectionId, sectionId)
        )
      );
  }

  async getSectionCompletions(eventId: string): Promise<schema.MeetingSectionCompletion[]> {
    return db.select()
      .from(schema.meetingSectionCompletions)
      .where(eq(schema.meetingSectionCompletions.eventId, eventId));
  }

  // ==================== Meeting Attendance Methods ====================

  async initializeMeetingAttendance(eventId: string, tenantId: string): Promise<schema.MeetingAttendance[]> {
    // Pre-populate with board members, contributors, delegated reps, and management
    // Homeowners and others can be added manually during the meeting
    const prePopulateRoles = [
      'poa_board_member',
      'poa_board_contributor',
      'delegated_rep',
      'management_rep',
      'management_manager',
    ];

    // Query community tenant
    const communityRoles = await db.select()
      .from(schema.userTenantRoles)
      .where(
        and(
          eq(schema.userTenantRoles.tenantId, tenantId),
          eq(schema.userTenantRoles.isActive, true),
          inArray(schema.userTenantRoles.role, prePopulateRoles)
        )
      );

    // Also query parent management company if exists
    const tenant = await this.getTenant(tenantId);
    let mgmtRoles: typeof communityRoles = [];
    if (tenant?.managementCompanyId) {
      mgmtRoles = await db.select()
        .from(schema.userTenantRoles)
        .where(
          and(
            eq(schema.userTenantRoles.tenantId, tenant.managementCompanyId),
            eq(schema.userTenantRoles.isActive, true),
            inArray(schema.userTenantRoles.role, prePopulateRoles)
          )
        );
    }

    const roles = [...communityRoles, ...mgmtRoles];

    if (roles.length === 0) {
      return [];
    }

    // Map user roles to attendee role categories
    const roleToAttendeeRole = (role: string): string => {
      if (role.startsWith('poa_') || role === 'delegated_rep') return 'board_member';
      if (role.startsWith('management_')) return 'management';
      return 'guest';
    };

    // Deduplicate by userId — a user with multiple roles should appear once
    // with the highest-priority attendee role
    const rolePriority: Record<string, number> = {
      board_member: 1,
      management: 2,
      guest: 3,
    };
    const userMap = new Map<string, string>();
    for (const r of roles) {
      const attendeeRole = roleToAttendeeRole(r.role);
      const existing = userMap.get(r.userId);
      if (!existing || (rolePriority[attendeeRole] || 99) < (rolePriority[existing] || 99)) {
        userMap.set(r.userId, attendeeRole);
      }
    }

    const attendanceRecords = Array.from(userMap.entries()).map(([userId, attendeeRole]) => ({
      eventId,
      userId,
      status: 'expected' as const,
      attendeeRole,
    }));

    // Insert all, ignoring duplicates
    const inserted = await db.insert(schema.meetingAttendance)
      .values(attendanceRecords)
      .onConflictDoNothing()
      .returning();

    return inserted;
  }

  async markAttendance(
    eventId: string,
    userId: string,
    status: schema.AttendanceStatus,
    markedByUserId: string,
    notes?: string
  ): Promise<schema.MeetingAttendance> {
    const [attendance] = await db.update(schema.meetingAttendance)
      .set({
        status,
        markedAt: new Date(),
        markedByUserId,
        notes: notes || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.meetingAttendance.eventId, eventId),
          eq(schema.meetingAttendance.userId, userId)
        )
      )
      .returning();
    return attendance;
  }

  async addAttendee(data: schema.InsertMeetingAttendance): Promise<schema.MeetingAttendance> {
    const [attendance] = await db.insert(schema.meetingAttendance)
      .values(data)
      .returning();
    return attendance;
  }

  async removeAttendee(eventId: string, userId: string): Promise<void> {
    await db.delete(schema.meetingAttendance)
      .where(
        and(
          eq(schema.meetingAttendance.eventId, eventId),
          eq(schema.meetingAttendance.userId, userId)
        )
      );
  }

  async getMeetingAttendance(eventId: string): Promise<(schema.MeetingAttendance & { user: schema.User })[]> {
    const rows = await db.select({
      attendance: schema.meetingAttendance,
      user: schema.users,
    })
      .from(schema.meetingAttendance)
      .innerJoin(schema.users, eq(schema.meetingAttendance.userId, schema.users.id))
      .where(eq(schema.meetingAttendance.eventId, eventId))
      .orderBy(schema.meetingAttendance.attendeeRole, schema.users.lastName);

    return rows.map(r => ({
      ...r.attendance,
      user: r.user,
    }));
  }

  // ==================== Presentation Mode Data ====================

  async getEventPresentationData(eventId: string): Promise<{
    event: schema.Event;
    agenda: {
      sections: schema.AgendaSection[];
      items: (schema.EventAgendaItem & {
        application?: schema.Application & { formTemplate?: schema.FormTemplate };
        presenter?: schema.User;
      })[];
      completions: schema.MeetingSectionCompletion[];
    };
    attendance: (schema.MeetingAttendance & { user: schema.User })[];
    facilitator?: schema.User;
  }> {
    // Get event with facilitator
    const eventRows = await db.select({
      event: schema.events,
      facilitator: schema.users,
    })
      .from(schema.events)
      .leftJoin(schema.users, eq(schema.events.facilitatorUserId, schema.users.id))
      .where(eq(schema.events.id, eventId));

    if (eventRows.length === 0) {
      throw new Error('Event not found');
    }

    const eventRow = eventRows[0];

    // Get agenda sections
    const sections = await this.listAgendaSections();

    // Get agenda items with applications, form templates, and presenters
    const items = await db.select({
      item: schema.eventAgendaItems,
      application: schema.applications,
      formTemplate: schema.formTemplates,
      presenter: schema.users,
    })
      .from(schema.eventAgendaItems)
      .leftJoin(schema.applications, eq(schema.eventAgendaItems.applicationId, schema.applications.id))
      .leftJoin(schema.formTemplates, eq(schema.applications.formTemplateId, schema.formTemplates.id))
      .leftJoin(schema.users, eq(schema.eventAgendaItems.presenterId, schema.users.id))
      .where(eq(schema.eventAgendaItems.eventId, eventId))
      .orderBy(schema.eventAgendaItems.sectionId, schema.eventAgendaItems.orderIndex);

    const completions = await this.getSectionCompletions(eventId);
    const attendance = await this.getMeetingAttendance(eventId);

    return {
      event: eventRow.event,
      agenda: {
        sections,
        items: items.map(row => ({
          ...row.item,
          application: row.application ? {
            ...row.application,
            formTemplate: row.formTemplate || undefined,
          } : undefined,
          presenter: row.presenter || undefined,
        })),
        completions,
      },
      attendance,
      facilitator: eventRow.facilitator || undefined,
    };
  }

  // ==================== Document OCR Methods ====================

  async updateDocumentOcr(documentId: string, data: {
    ocrText?: string;
    ocrConfidence?: number;
    ocrProcessedAt?: Date;
    ocrStatus?: string;
    ocrError?: string;
    enhancedBlobPath?: string;
    enhancementConfidence?: number;
    isHandwritten?: boolean;
  }): Promise<schema.Document> {
    const [updated] = await db.update(schema.documents)
      .set(data)
      .where(eq(schema.documents.id, documentId))
      .returning();
    return updated;
  }

  async getDocumentsNeedingOcr(applicationId: string): Promise<schema.Document[]> {
    // Get documents that haven't been processed or failed
    return await db.select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.applicationId, applicationId),
          or(
            isNull(schema.documents.ocrStatus),
            eq(schema.documents.ocrStatus, 'pending'),
            eq(schema.documents.ocrStatus, 'failed')
          )
        )
      )
      .orderBy(schema.documents.uploadedAt);
  }

  async getDocumentsWithOcr(applicationId: string): Promise<schema.Document[]> {
    return await db.select()
      .from(schema.documents)
      .where(eq(schema.documents.applicationId, applicationId))
      .orderBy(schema.documents.uploadedAt);
  }

  // Document OCR Jobs
  async createDocumentOcrJob(data: {
    applicationId: string;
    requestedByUserId: string | null;
    status: string;
    totalDocuments: number;
    processedDocuments?: number;
    includeImageEnhancement?: boolean;
  }): Promise<schema.DocumentOcrJob> {
    const [job] = await db.insert(schema.documentOcrJobs)
      .values({
        applicationId: data.applicationId,
        requestedByUserId: data.requestedByUserId,
        status: data.status,
        totalDocuments: data.totalDocuments,
        processedDocuments: data.processedDocuments ?? 0,
        includeImageEnhancement: data.includeImageEnhancement ?? true,
      })
      .returning();
    return job;
  }

  async getDocumentOcrJob(jobId: string): Promise<schema.DocumentOcrJob | undefined> {
    const [job] = await db.select()
      .from(schema.documentOcrJobs)
      .where(eq(schema.documentOcrJobs.id, jobId))
      .limit(1);
    return job;
  }

  async updateDocumentOcrJob(jobId: string, data: {
    status?: string;
    processedDocuments?: number;
    totalCostUsd?: string;
    startedAt?: Date;
    completedAt?: Date;
    errorMessage?: string;
  }): Promise<schema.DocumentOcrJob> {
    const [updated] = await db.update(schema.documentOcrJobs)
      .set(data)
      .where(eq(schema.documentOcrJobs.id, jobId))
      .returning();
    return updated;
  }

  async getNextQueuedOcrJob(): Promise<schema.DocumentOcrJob | undefined> {
    const [job] = await db.select()
      .from(schema.documentOcrJobs)
      .where(eq(schema.documentOcrJobs.status, 'queued'))
      .orderBy(schema.documentOcrJobs.createdAt)
      .limit(1);
    return job;
  }

  async getPendingOcrJob(applicationId: string): Promise<schema.DocumentOcrJob | undefined> {
    const [job] = await db.select()
      .from(schema.documentOcrJobs)
      .where(
        and(
          eq(schema.documentOcrJobs.applicationId, applicationId),
          or(
            eq(schema.documentOcrJobs.status, 'queued'),
            eq(schema.documentOcrJobs.status, 'processing')
          )
        )
      )
      .limit(1);
    return job;
  }

  async getStaleOcrJobs(maxProcessingTimeMs: number): Promise<schema.DocumentOcrJob[]> {
    const cutoffTime = new Date(Date.now() - maxProcessingTimeMs);
    return await db.select()
      .from(schema.documentOcrJobs)
      .where(
        and(
          eq(schema.documentOcrJobs.status, 'processing'),
          lt(schema.documentOcrJobs.startedAt, cutoffTime)
        )
      );
  }

  async getOcrJobsForApplication(applicationId: string): Promise<schema.DocumentOcrJob[]> {
    return await db.select()
      .from(schema.documentOcrJobs)
      .where(eq(schema.documentOcrJobs.applicationId, applicationId))
      .orderBy(desc(schema.documentOcrJobs.createdAt));
  }

  // ============================================
  // Delegated Application Edits
  // ============================================

  async createApplicationFieldEdit(edit: schema.InsertApplicationFieldEdit): Promise<schema.ApplicationFieldEdit> {
    const [created] = await db
      .insert(schema.applicationFieldEdits)
      .values(edit)
      .returning();

    // Update application's delegated edit tracking
    await db.update(schema.applications)
      .set({
        hasDelegatedEdits: true,
        lastDelegatedEditAt: new Date(),
        lastDelegatedEditByUserId: edit.editedByUserId,
      })
      .where(eq(schema.applications.id, edit.applicationId));

    return created;
  }

  async getApplicationFieldEdits(applicationId: string): Promise<(schema.ApplicationFieldEdit & { editedByUser: { id: string; firstName: string | null; lastName: string | null } })[]> {
    const edits = await db
      .select({
        edit: schema.applicationFieldEdits,
        editedByUser: {
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        },
      })
      .from(schema.applicationFieldEdits)
      .leftJoin(schema.users, eq(schema.applicationFieldEdits.editedByUserId, schema.users.id))
      .where(eq(schema.applicationFieldEdits.applicationId, applicationId))
      .orderBy(desc(schema.applicationFieldEdits.editedAt));

    return edits.map(row => ({
      ...row.edit,
      editedByUser: row.editedByUser!,
    }));
  }

  async getFieldEditHistory(applicationId: string, fieldPath: string): Promise<schema.ApplicationFieldEdit[]> {
    return db
      .select()
      .from(schema.applicationFieldEdits)
      .where(and(
        eq(schema.applicationFieldEdits.applicationId, applicationId),
        eq(schema.applicationFieldEdits.fieldPath, fieldPath)
      ))
      .orderBy(desc(schema.applicationFieldEdits.editedAt));
  }

  async getApplicationEditSummary(applicationId: string): Promise<{
    totalEdits: number;
    editedFields: string[];
    lastEdit: schema.ApplicationFieldEdit | null;
    editorSummary: Array<{ userId: string; name: string; role: string; editCount: number }>;
  }> {
    // Get all edits for this application
    const edits = await db
      .select({
        edit: schema.applicationFieldEdits,
        editedByUser: {
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName,
        },
      })
      .from(schema.applicationFieldEdits)
      .leftJoin(schema.users, eq(schema.applicationFieldEdits.editedByUserId, schema.users.id))
      .where(eq(schema.applicationFieldEdits.applicationId, applicationId))
      .orderBy(desc(schema.applicationFieldEdits.editedAt));

    if (edits.length === 0) {
      return {
        totalEdits: 0,
        editedFields: [],
        lastEdit: null,
        editorSummary: [],
      };
    }

    // Get unique field paths
    const editedFields = [...new Set(edits.map(e => e.edit.fieldPath))];

    // Calculate editor summary
    const editorMap = new Map<string, { userId: string; name: string; role: string; editCount: number }>();
    for (const edit of edits) {
      const userId = edit.edit.editedByUserId;
      if (!editorMap.has(userId)) {
        const name = [edit.editedByUser?.firstName, edit.editedByUser?.lastName]
          .filter(Boolean)
          .join(' ') || 'Unknown';
        editorMap.set(userId, {
          userId,
          name,
          role: edit.edit.editedByRole,
          editCount: 0,
        });
      }
      editorMap.get(userId)!.editCount++;
    }

    return {
      totalEdits: edits.length,
      editedFields,
      lastEdit: edits[0].edit,
      editorSummary: Array.from(editorMap.values()),
    };
  }

  // ============================================
  // AI Context Sources
  // ============================================

  async listAiContextSources(tenantId: string, includeInactive = false): Promise<schema.AiContextSource[]> {
    const conditions = [eq(schema.aiContextSources.tenantId, tenantId)];
    if (!includeInactive) {
      conditions.push(eq(schema.aiContextSources.isActive, true));
    }
    return db.select()
      .from(schema.aiContextSources)
      .where(and(...conditions))
      .orderBy(asc(schema.aiContextSources.priority), asc(schema.aiContextSources.createdAt));
  }

  async getAiContextSource(id: string): Promise<schema.AiContextSource | undefined> {
    const [source] = await db.select()
      .from(schema.aiContextSources)
      .where(eq(schema.aiContextSources.id, id));
    return source;
  }

  async createAiContextSource(source: schema.InsertAiContextSource): Promise<schema.AiContextSource> {
    const [created] = await db.insert(schema.aiContextSources)
      .values(source)
      .returning();
    return created;
  }

  async updateAiContextSource(id: string, updates: Partial<schema.InsertAiContextSource>): Promise<schema.AiContextSource> {
    const [updated] = await db.update(schema.aiContextSources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.aiContextSources.id, id))
      .returning();
    return updated;
  }

  async deleteAiContextSource(id: string): Promise<void> {
    await db.delete(schema.aiContextSources)
      .where(eq(schema.aiContextSources.id, id));
  }

  async toggleAiContextSource(id: string, isActive: boolean): Promise<schema.AiContextSource> {
    const [updated] = await db.update(schema.aiContextSources)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schema.aiContextSources.id, id))
      .returning();
    return updated;
  }

  async reorderAiContextSources(tenantId: string, orderedIds: string[]): Promise<void> {
    // Update priority based on position in the orderedIds array
    for (let i = 0; i < orderedIds.length; i++) {
      await db.update(schema.aiContextSources)
        .set({ priority: i + 1, updatedAt: new Date() })
        .where(and(
          eq(schema.aiContextSources.id, orderedIds[i]),
          eq(schema.aiContextSources.tenantId, tenantId)
        ));
    }
  }

  async getActiveAiContextSourcesForForm(tenantId: string, formType?: string): Promise<schema.AiContextSource[]> {
    const allSources = await db.select()
      .from(schema.aiContextSources)
      .where(and(
        eq(schema.aiContextSources.tenantId, tenantId),
        eq(schema.aiContextSources.isActive, true)
      ))
      .orderBy(asc(schema.aiContextSources.priority), asc(schema.aiContextSources.createdAt));

    // Filter to sources that apply to this form type
    return allSources.filter(source => {
      // If applies to all forms, include it
      if (source.appliesToAllForms) return true;
      // If formType is specified and matches, include it
      if (formType && source.appliesToFormTypes?.includes(formType)) return true;
      // Otherwise, only include if no formType was specified
      return !formType;
    });
  }

  // ============================================
  // AI Instructions
  // ============================================

  async listAiInstructions(tenantId: string, scope?: string, formType?: string): Promise<schema.AiInstruction[]> {
    const conditions = [eq(schema.aiInstructions.tenantId, tenantId)];
    if (scope) {
      conditions.push(eq(schema.aiInstructions.scope, scope));
    }
    if (formType) {
      conditions.push(eq(schema.aiInstructions.formType, formType));
    }
    return db.select()
      .from(schema.aiInstructions)
      .where(and(...conditions))
      .orderBy(asc(schema.aiInstructions.scope), asc(schema.aiInstructions.createdAt));
  }

  async getAiInstruction(id: string): Promise<schema.AiInstruction | undefined> {
    const [instruction] = await db.select()
      .from(schema.aiInstructions)
      .where(eq(schema.aiInstructions.id, id));
    return instruction;
  }

  async createAiInstruction(instruction: schema.InsertAiInstruction): Promise<schema.AiInstruction> {
    const [created] = await db.insert(schema.aiInstructions)
      .values(instruction)
      .returning();
    return created;
  }

  async updateAiInstruction(id: string, updates: Partial<schema.InsertAiInstruction>): Promise<schema.AiInstruction> {
    const [updated] = await db.update(schema.aiInstructions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.aiInstructions.id, id))
      .returning();
    return updated;
  }

  async deleteAiInstruction(id: string): Promise<void> {
    await db.delete(schema.aiInstructions)
      .where(eq(schema.aiInstructions.id, id));
  }

  async toggleAiInstruction(id: string, isActive: boolean): Promise<schema.AiInstruction> {
    const [updated] = await db.update(schema.aiInstructions)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(schema.aiInstructions.id, id))
      .returning();
    return updated;
  }

  async getActiveInstructionsForAnalysis(tenantId: string, formType?: string): Promise<string> {
    // Get community-level instructions
    const communityInstructions = await db.select()
      .from(schema.aiInstructions)
      .where(and(
        eq(schema.aiInstructions.tenantId, tenantId),
        eq(schema.aiInstructions.scope, 'community'),
        eq(schema.aiInstructions.isActive, true)
      ))
      .orderBy(asc(schema.aiInstructions.createdAt));

    // Get form-type-specific instructions if formType is provided
    let formTypeInstructions: schema.AiInstruction[] = [];
    if (formType) {
      formTypeInstructions = await db.select()
        .from(schema.aiInstructions)
        .where(and(
          eq(schema.aiInstructions.tenantId, tenantId),
          eq(schema.aiInstructions.scope, 'form_type'),
          eq(schema.aiInstructions.formType, formType),
          eq(schema.aiInstructions.isActive, true)
        ))
        .orderBy(asc(schema.aiInstructions.createdAt));
    }

    // Combine instructions with clear section headers
    const parts: string[] = [];

    if (communityInstructions.length > 0) {
      parts.push('=== Community Instructions ===');
      for (const inst of communityInstructions) {
        parts.push(`[${inst.title}]`);
        parts.push(inst.instructions);
        parts.push('');
      }
    }

    if (formTypeInstructions.length > 0) {
      parts.push(`=== ${formType} Specific Instructions ===`);
      for (const inst of formTypeInstructions) {
        parts.push(`[${inst.title}]`);
        parts.push(inst.instructions);
        parts.push('');
      }
    }

    return parts.join('\n').trim();
  }

  // ============================================
  // Community Residences (Neighborhood Archive)
  // ============================================

  async listCommunityResidences(tenantId: string): Promise<(schema.CommunityResidence & { photoCount: number; thumbnailPhotoId: string | null })[]> {
    const residences = await db.select()
      .from(schema.communityResidences)
      .where(eq(schema.communityResidences.tenantId, tenantId))
      .orderBy(desc(schema.communityResidences.updatedAt));

    // Get photo counts and best thumbnail photo (prefer satellite > uploaded > any)
    const results = await Promise.all(residences.map(async (r) => {
      const photos = await db.select({ id: schema.residencePhotos.id, photoType: schema.residencePhotos.photoType })
        .from(schema.residencePhotos)
        .where(eq(schema.residencePhotos.residenceId, r.id));
      const thumbnail = photos.find(p => p.photoType === 'satellite')
        || photos.find(p => p.photoType === 'uploaded')
        || photos[0]
        || null;
      return { ...r, photoCount: photos.length, thumbnailPhotoId: thumbnail?.id ?? null };
    }));

    return results;
  }

  async getCommunityResidence(id: string): Promise<schema.CommunityResidence | undefined> {
    const [residence] = await db.select()
      .from(schema.communityResidences)
      .where(eq(schema.communityResidences.id, id));
    return residence;
  }

  async getCommunityResidenceByAddress(tenantId: string, normalizedAddress: string): Promise<schema.CommunityResidence | undefined> {
    const [residence] = await db.select()
      .from(schema.communityResidences)
      .where(and(
        eq(schema.communityResidences.tenantId, tenantId),
        eq(schema.communityResidences.normalizedAddress, normalizedAddress)
      ));
    return residence;
  }

  async createCommunityResidence(data: schema.InsertCommunityResidence): Promise<schema.CommunityResidence> {
    const [created] = await db.insert(schema.communityResidences)
      .values(data)
      .returning();
    return created;
  }

  async updateCommunityResidence(id: string, updates: Partial<schema.InsertCommunityResidence>): Promise<schema.CommunityResidence> {
    const [updated] = await db.update(schema.communityResidences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.communityResidences.id, id))
      .returning();
    return updated;
  }

  async deleteCommunityResidence(id: string): Promise<void> {
    await db.delete(schema.communityResidences)
      .where(eq(schema.communityResidences.id, id));
  }

  async getLinkedApplications(tenantId: string, normalizedAddress: string): Promise<schema.Application[]> {
    return db.select()
      .from(schema.applications)
      .where(and(
        eq(schema.applications.tenantId, tenantId),
        sql`lower(trim(${schema.applications.propertyAddress})) = ${normalizedAddress}`
      ))
      .orderBy(desc(schema.applications.submittedAt));
  }

  // Residence Photos
  async listResidencePhotos(residenceId: string): Promise<schema.ResidencePhoto[]> {
    return db.select()
      .from(schema.residencePhotos)
      .where(eq(schema.residencePhotos.residenceId, residenceId))
      .orderBy(asc(schema.residencePhotos.sortOrder), asc(schema.residencePhotos.createdAt));
  }

  async createResidencePhoto(data: schema.InsertResidencePhoto): Promise<schema.ResidencePhoto> {
    const [created] = await db.insert(schema.residencePhotos)
      .values(data)
      .returning();
    return created;
  }

  async deleteResidencePhoto(id: string): Promise<void> {
    await db.delete(schema.residencePhotos)
      .where(eq(schema.residencePhotos.id, id));
  }

  async getResidencePhoto(id: string): Promise<schema.ResidencePhoto | undefined> {
    const [photo] = await db.select()
      .from(schema.residencePhotos)
      .where(eq(schema.residencePhotos.id, id));
    return photo;
  }

  async countResidencePhotosByType(residenceId: string, photoType: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.residencePhotos)
      .where(and(
        eq(schema.residencePhotos.residenceId, residenceId),
        eq(schema.residencePhotos.photoType, photoType)
      ));
    return result?.count ?? 0;
  }

  // Residence Upload Tokens (QR Code Mobile Upload)
  async createResidenceUploadToken(token: schema.InsertResidenceUploadToken): Promise<schema.ResidenceUploadToken> {
    const [created] = await db.insert(schema.residenceUploadTokens)
      .values(token)
      .returning();
    return created;
  }

  async getResidenceUploadToken(token: string): Promise<schema.ResidenceUploadToken | undefined> {
    const [uploadToken] = await db.select()
      .from(schema.residenceUploadTokens)
      .where(eq(schema.residenceUploadTokens.token, token));
    return uploadToken;
  }

  async markResidenceTokenAsUsed(token: string, photosUploaded: number): Promise<schema.ResidenceUploadToken> {
    const [updated] = await db.update(schema.residenceUploadTokens)
      .set({ isUsed: true, usedAt: new Date(), photosUploaded })
      .where(eq(schema.residenceUploadTokens.token, token))
      .returning();
    return updated;
  }

  async createEmailLog(log: schema.InsertEmailLog): Promise<schema.EmailLog> {
    const [created] = await db.insert(schema.emailLogs).values(log).returning();
    return created;
  }

  async getEmailLogById(id: string): Promise<schema.EmailLog | undefined> {
    const [log] = await db.select().from(schema.emailLogs).where(eq(schema.emailLogs.id, id));
    return log;
  }

  async getEmailLogsByApplication(applicationId: string): Promise<schema.EmailLog[]> {
    return db.select().from(schema.emailLogs).where(eq(schema.emailLogs.applicationId, applicationId)).orderBy(desc(schema.emailLogs.sentAt));
  }

  async updateEmailLogByMessageId(messageId: string, updates: { status: string; deliveredAt?: Date; bouncedAt?: Date; openedAt?: Date; bounceType?: string; bounceReason?: string }): Promise<schema.EmailLog | undefined> {
    const [updated] = await db
      .update(schema.emailLogs)
      .set(updates)
      .where(eq(schema.emailLogs.messageId, messageId))
      .returning();
    return updated;
  }

  async getResidenceTimeline(residenceId: string, tenantId: string, normalizedAddress: string): Promise<any> {
    // 1. Get the residence record for the creation event
    const residence = await this.getCommunityResidence(residenceId);
    if (!residence) return { entries: [], summary: { totalEntries: 0, applicationCount: 0, photoCount: 0, commentCount: 0, aiAnalysisCount: 0, meetingCount: 0, emailCount: 0 } };

    // 2. Get linked application IDs via normalized address
    const linkedApps = await this.getLinkedApplications(tenantId, normalizedAddress);
    const appIds = linkedApps.map(a => a.id);
    const appLookup = new Map(linkedApps.map(a => [a.id, a]));

    const entries: any[] = [];

    // 3. Residence creation event
    entries.push({
      id: `res-created-${residenceId}`,
      timestamp: residence.createdAt?.toISOString() || new Date().toISOString(),
      category: 'residence',
      eventType: 'residence_created',
      title: 'Residence record created',
      description: residence.propertyAddress,
      applicationId: null,
      applicationNumber: null,
      applicationTitle: null,
      userId: residence.createdByUserId,
      userName: null,
      details: null,
      thumbnailId: null,
      thumbnailType: null,
    });

    // 4. Residence photos
    const photos = await this.listResidencePhotos(residenceId);
    for (const photo of photos) {
      entries.push({
        id: `photo-${photo.id}`,
        timestamp: photo.createdAt?.toISOString() || new Date().toISOString(),
        category: 'residence',
        eventType: 'photo_uploaded',
        title: `${photo.photoType.charAt(0).toUpperCase() + photo.photoType.slice(1)} photo added`,
        description: photo.caption || photo.fileName,
        applicationId: null,
        applicationNumber: null,
        applicationTitle: null,
        userId: photo.uploadedByUserId,
        userName: null,
        details: { photoType: photo.photoType, fileName: photo.fileName },
        thumbnailId: photo.id,
        thumbnailType: 'residence_photo' as const,
      });
    }

    // 5. Application events (only if there are linked apps)
    if (appIds.length > 0) {
      // Application submitted events
      for (const app of linkedApps) {
        entries.push({
          id: `app-submitted-${app.id}`,
          timestamp: app.submittedAt?.toISOString() || new Date().toISOString(),
          category: 'application',
          eventType: 'application_submitted',
          title: app.title || `Application ${app.applicationNumber}`,
          description: `${app.projectType || 'Application'} submitted`,
          applicationId: app.id,
          applicationNumber: app.applicationNumber,
          applicationTitle: app.title,
          userId: app.submittedByUserId,
          userName: null,
          details: { status: app.status, projectType: app.projectType },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Run parallel queries for all app-related data — each wrapped to isolate failures
      const safeQuery = async <T>(label: string, fn: () => Promise<T>): Promise<T | []> => {
        try { return await fn(); } catch (err: any) { console.error(`[Timeline] ${label} query failed:`, err.message); return [] as any; }
      };

      const [docsResult, commentsResult, aiResult, workflowActionsResult, agendaItemsResult, fieldEditsResult, signaturesResult, collaboratorsResult, emailLogsResult] = await Promise.all([
        safeQuery('documents', () => db.select().from(schema.documents).where(inArray(schema.documents.applicationId, appIds))),
        safeQuery('comments', () => db.select().from(schema.comments).where(inArray(schema.comments.applicationId, appIds))),
        safeQuery('aiAnalyses', () => db.select().from(schema.aiAnalyses).where(and(inArray(schema.aiAnalyses.applicationId, appIds), eq(schema.aiAnalyses.status, 'completed')))),
        safeQuery('workflowActions', () =>
          db.select({
            actionId: schema.workflowStepActions.id,
            actionAction: schema.workflowStepActions.action,
            actionUserId: schema.workflowStepActions.userId,
            actionNotes: schema.workflowStepActions.notes,
            actionStepIndex: schema.workflowStepActions.stepIndex,
            actionCreatedAt: schema.workflowStepActions.createdAt,
            workflowApplicationId: schema.applicationWorkflows.applicationId,
          }).from(schema.workflowStepActions)
            .innerJoin(schema.applicationWorkflows, eq(schema.workflowStepActions.applicationWorkflowId, schema.applicationWorkflows.id))
            .where(inArray(schema.applicationWorkflows.applicationId, appIds))
        ),
        safeQuery('agendaItems', () =>
          db.select({
            itemId: schema.eventAgendaItems.id,
            itemApplicationId: schema.eventAgendaItems.applicationId,
            itemDecision: schema.eventAgendaItems.decision,
            itemDecisionNotes: schema.eventAgendaItems.decisionNotes,
            itemAddedByUserId: schema.eventAgendaItems.addedByUserId,
            itemUpdatedAt: schema.eventAgendaItems.updatedAt,
            itemAddedAt: schema.eventAgendaItems.addedAt,
            eventTitle: schema.events.title,
            eventStartDatetime: schema.events.startDatetime,
          }).from(schema.eventAgendaItems)
            .innerJoin(schema.events, eq(schema.eventAgendaItems.eventId, schema.events.id))
            .where(and(
              inArray(schema.eventAgendaItems.applicationId, appIds),
              isNotNull(schema.eventAgendaItems.decision)
            ))
        ),
        safeQuery('fieldEdits', () => db.select().from(schema.applicationFieldEdits).where(inArray(schema.applicationFieldEdits.applicationId, appIds))),
        safeQuery('signatures', () => db.select().from(schema.signatures).where(inArray(schema.signatures.applicationId, appIds))),
        safeQuery('collaborators', () => db.select().from(schema.applicationCollaborators).where(inArray(schema.applicationCollaborators.applicationId, appIds))),
        safeQuery('emailLogs', () => db.select().from(schema.emailLogs).where(inArray(schema.emailLogs.applicationId, appIds))),
      ]);

      // Map documents
      for (const doc of docsResult) {
        const app = appLookup.get(doc.applicationId);
        entries.push({
          id: `doc-${doc.id}`,
          timestamp: doc.uploadedAt?.toISOString() || new Date().toISOString(),
          category: 'document',
          eventType: 'document_uploaded',
          title: `Document uploaded: ${doc.documentRequirementName}`,
          description: doc.fileName,
          applicationId: doc.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: doc.uploadedByUserId,
          userName: null,
          details: { fileName: doc.fileName, ocrStatus: doc.ocrStatus, mimeType: doc.mimeType },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map comments
      for (const comment of commentsResult) {
        const app = appLookup.get(comment.applicationId);
        entries.push({
          id: `comment-${comment.id}`,
          timestamp: comment.createdAt?.toISOString() || new Date().toISOString(),
          category: 'comment',
          eventType: 'comment_added',
          title: 'Comment added',
          description: comment.text.length > 120 ? comment.text.slice(0, 120) + '...' : comment.text,
          applicationId: comment.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: comment.userId,
          userName: null,
          details: { text: comment.text, isResolved: comment.isResolved },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map AI analyses
      for (const analysis of aiResult) {
        const app = appLookup.get(analysis.applicationId);
        entries.push({
          id: `ai-${analysis.id}`,
          timestamp: analysis.completedAt?.toISOString() || analysis.queuedAt?.toISOString() || new Date().toISOString(),
          category: 'ai_analysis',
          eventType: 'ai_analysis_completed',
          title: 'AI Analysis completed',
          description: analysis.overallSummary ? (analysis.overallSummary.length > 120 ? analysis.overallSummary.slice(0, 120) + '...' : analysis.overallSummary) : null,
          applicationId: analysis.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: analysis.requestedByUserId,
          userName: null,
          details: { complianceScore: analysis.complianceScore, riskLevel: analysis.riskLevel },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map workflow step actions
      for (const row of workflowActionsResult) {
        const app = appLookup.get(row.workflowApplicationId);
        entries.push({
          id: `workflow-${row.actionId}`,
          timestamp: row.actionCreatedAt?.toISOString() || new Date().toISOString(),
          category: 'workflow',
          eventType: `workflow_${row.actionAction}`,
          title: `Workflow: ${row.actionAction.replace(/_/g, ' ')}`,
          description: row.actionNotes || null,
          applicationId: row.workflowApplicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: row.actionUserId,
          userName: null,
          details: { action: row.actionAction, stepIndex: row.actionStepIndex, notes: row.actionNotes },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map meeting agenda items with decisions
      for (const row of agendaItemsResult) {
        const app = row.itemApplicationId ? appLookup.get(row.itemApplicationId) : null;
        entries.push({
          id: `meeting-${row.itemId}`,
          timestamp: row.itemUpdatedAt?.toISOString() || row.itemAddedAt?.toISOString() || new Date().toISOString(),
          category: 'meeting',
          eventType: 'meeting_decision',
          title: `Meeting decision: ${row.itemDecision?.replace(/_/g, ' ') || 'discussed'}`,
          description: `${row.eventTitle} — ${row.itemDecisionNotes || 'No notes'}`,
          applicationId: row.itemApplicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: row.itemAddedByUserId,
          userName: null,
          details: { decision: row.itemDecision, decisionNotes: row.itemDecisionNotes, eventTitle: row.eventTitle, eventDate: row.eventStartDatetime?.toISOString() },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map field edits
      for (const edit of fieldEditsResult) {
        const app = appLookup.get(edit.applicationId);
        entries.push({
          id: `edit-${edit.id}`,
          timestamp: edit.editedAt?.toISOString() || new Date().toISOString(),
          category: 'edit',
          eventType: 'field_edited',
          title: `Field edited: ${edit.fieldLabel || edit.fieldPath}`,
          description: edit.editReason || null,
          applicationId: edit.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: edit.editedByUserId,
          userName: null,
          details: { fieldPath: edit.fieldPath, fieldLabel: edit.fieldLabel, previousValue: edit.previousValue, newValue: edit.newValue, editSource: edit.editSource },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map signatures
      for (const sig of signaturesResult) {
        const app = appLookup.get(sig.applicationId);
        entries.push({
          id: `sig-${sig.id}`,
          timestamp: sig.signedAt?.toISOString() || sig.createdAt?.toISOString() || new Date().toISOString(),
          category: 'signature',
          eventType: 'signature_collected',
          title: `Signature collected from ${sig.signedByName}`,
          description: null,
          applicationId: sig.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: sig.signedBy,
          userName: sig.signedByName,
          details: { type: sig.type, signedByName: sig.signedByName, signedByEmail: sig.signedByEmail },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map collaborators
      for (const collab of collaboratorsResult) {
        const app = appLookup.get(collab.applicationId);
        entries.push({
          id: `collab-${collab.id}`,
          timestamp: collab.invitedAt?.toISOString() || collab.createdAt?.toISOString() || new Date().toISOString(),
          category: 'collaborator',
          eventType: 'collaborator_added',
          title: 'Contractor collaborator added',
          description: null,
          applicationId: collab.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: collab.invitedByUserId,
          userName: null,
          details: { contractorId: collab.contractorId, status: collab.status },
          thumbnailId: null,
          thumbnailType: null,
        });
      }

      // Map email logs
      for (const email of emailLogsResult) {
        const app = email.applicationId ? appLookup.get(email.applicationId) : null;
        const templateLabel = email.templateId
          ? email.templateId.replace(/([A-Z])/g, ' $1').replace(/^./, (s: string) => s.toUpperCase()).trim()
          : 'Custom Email';
        entries.push({
          id: `email-${email.id}`,
          timestamp: email.sentAt?.toISOString() || new Date().toISOString(),
          category: 'email',
          eventType: 'email_sent',
          title: email.subject,
          description: `To: ${email.recipientEmail}`,
          applicationId: email.applicationId,
          applicationNumber: app?.applicationNumber || null,
          applicationTitle: app?.title || null,
          userId: email.triggeredByUserId,
          userName: null,
          details: { emailLogId: email.id, templateId: email.templateId, templateLabel, recipientEmail: email.recipientEmail, status: email.status },
          thumbnailId: null,
          thumbnailType: null,
        });
      }
    }

    // 6. Batch-resolve user names and roles
    const userIds = [...new Set(entries.map((e: any) => e.userId).filter(Boolean))];
    if (userIds.length > 0) {
      const [users, userRoles] = await Promise.all([
        db.select({ id: schema.users.id, firstName: schema.users.firstName, lastName: schema.users.lastName, email: schema.users.email })
          .from(schema.users)
          .where(inArray(schema.users.id, userIds)),
        db.select({ userId: schema.userTenantRoles.userId, role: schema.userTenantRoles.role })
          .from(schema.userTenantRoles)
          .where(and(
            inArray(schema.userTenantRoles.userId, userIds),
            eq(schema.userTenantRoles.tenantId, tenantId),
            eq(schema.userTenantRoles.isActive, true),
          )),
      ]);
      const userMap = new Map(users.map(u => [u.id, u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.email || 'Unknown')]));
      // Build userId → best role map (pick most relevant role per user)
      const rolePriority: Record<string, number> = {
        homeowner: 1, poa_board_contributor: 2, poa_board_member: 3, delegated_rep: 4,
        management_rep: 5, management_manager: 6, management_auxiliary: 7, account_admin: 8, super_admin: 9, contractor: 0,
      };
      const userRoleMap = new Map<string, string>();
      for (const ur of userRoles) {
        const existing = userRoleMap.get(ur.userId);
        if (!existing || (rolePriority[ur.role] || 0) > (rolePriority[existing] || 0)) {
          userRoleMap.set(ur.userId, ur.role);
        }
      }
      for (const entry of entries) {
        if (entry.userId && !entry.userName) {
          entry.userName = userMap.get(entry.userId) || null;
        }
        if (entry.userId) {
          entry.userRole = userRoleMap.get(entry.userId) || null;
        }
      }
    }

    // 7. Sort by timestamp descending
    entries.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return { entries, summary: {
      totalEntries: entries.length,
      applicationCount: linkedApps.length,
      photoCount: photos.length,
      commentCount: entries.filter((e: any) => e.category === 'comment').length,
      aiAnalysisCount: entries.filter((e: any) => e.category === 'ai_analysis').length,
      meetingCount: entries.filter((e: any) => e.category === 'meeting').length,
      emailCount: entries.filter((e: any) => e.category === 'email').length,
    }};
  }

  // ============================================
  // MCP Reviewer Tokens
  // ============================================

  async createMcpToken(data: {
    userId: string;
    tenantId: string;
    token: string;
    label?: string | null;
    expiresAt?: Date | null;
    source?: "plaintext" | "oauth";
    oauthClientId?: string | null;
  }): Promise<schema.McpToken> {
    const [row] = await db
      .insert(schema.mcpTokens)
      .values({
        userId: data.userId,
        tenantId: data.tenantId,
        token: data.token,
        label: data.label ?? null,
        expiresAt: data.expiresAt ?? null,
        source: data.source ?? "plaintext",
        oauthClientId: data.oauthClientId ?? null,
      })
      .returning();
    return row;
  }

  async listMcpTokensForUserInTenant(userId: string, tenantId: string): Promise<schema.McpToken[]> {
    return db
      .select()
      .from(schema.mcpTokens)
      .where(and(eq(schema.mcpTokens.userId, userId), eq(schema.mcpTokens.tenantId, tenantId)))
      .orderBy(desc(schema.mcpTokens.createdAt));
  }

  async getMcpTokenByValue(token: string): Promise<schema.McpToken | undefined> {
    const [row] = await db
      .select()
      .from(schema.mcpTokens)
      .where(eq(schema.mcpTokens.token, token))
      .limit(1);
    return row;
  }

  async revokeMcpToken(id: string, userId: string): Promise<schema.McpToken | undefined> {
    const [row] = await db
      .update(schema.mcpTokens)
      .set({ isActive: false })
      .where(and(eq(schema.mcpTokens.id, id), eq(schema.mcpTokens.userId, userId)))
      .returning();
    return row;
  }

  async touchMcpToken(id: string): Promise<void> {
    await db
      .update(schema.mcpTokens)
      .set({
        lastUsedAt: new Date(),
        accessCount: sql`${schema.mcpTokens.accessCount} + 1`,
      })
      .where(eq(schema.mcpTokens.id, id));
  }

  async logMcpToolCall(entry: schema.InsertMcpToolCall): Promise<void> {
    await db.insert(schema.mcpToolCalls).values(entry);
  }

  // ============================================
  // MCP OAuth (DCR + authorization codes)
  // ============================================

  async createOauthClient(data: {
    clientName: string;
    redirectUris: string[];
    scope?: string | null;
  }): Promise<schema.OauthClient> {
    const [row] = await db
      .insert(schema.oauthClients)
      .values({
        clientName: data.clientName,
        redirectUris: data.redirectUris,
        scope: data.scope ?? null,
      })
      .returning();
    return row;
  }

  async getOauthClient(clientId: string): Promise<schema.OauthClient | undefined> {
    const [row] = await db
      .select()
      .from(schema.oauthClients)
      .where(eq(schema.oauthClients.id, clientId))
      .limit(1);
    return row;
  }

  async touchOauthClient(clientId: string): Promise<void> {
    await db
      .update(schema.oauthClients)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.oauthClients.id, clientId));
  }

  async createAuthorizationCode(data: {
    code: string;
    clientId: string;
    userId: string;
    tenantId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    scope?: string | null;
    resource?: string | null;
    expiresAt: Date;
  }): Promise<schema.OauthAuthorizationCode> {
    const [row] = await db
      .insert(schema.oauthAuthorizationCodes)
      .values({
        code: data.code,
        clientId: data.clientId,
        userId: data.userId,
        tenantId: data.tenantId,
        redirectUri: data.redirectUri,
        codeChallenge: data.codeChallenge,
        codeChallengeMethod: data.codeChallengeMethod,
        scope: data.scope ?? null,
        resource: data.resource ?? null,
        expiresAt: data.expiresAt,
      })
      .returning();
    return row;
  }

  // Atomic one-shot consumption: sets consumedAt only if it was null.
  // Returns the code row iff it was still redeemable.
  async consumeAuthorizationCode(code: string): Promise<schema.OauthAuthorizationCode | undefined> {
    const [row] = await db
      .update(schema.oauthAuthorizationCodes)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(schema.oauthAuthorizationCodes.code, code),
          isNull(schema.oauthAuthorizationCodes.consumedAt),
        ),
      )
      .returning();
    return row;
  }

  async deactivateOauthTokensForClient(
    userId: string,
    tenantId: string,
    oauthClientId: string,
  ): Promise<void> {
    await db
      .update(schema.mcpTokens)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.mcpTokens.userId, userId),
          eq(schema.mcpTokens.tenantId, tenantId),
          eq(schema.mcpTokens.oauthClientId, oauthClientId),
          eq(schema.mcpTokens.isActive, true),
        ),
      );
  }
}

export const storage = new DbStorage();
