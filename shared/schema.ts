import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, uniqueIndex, index, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Referenced from Replit Auth integration: blueprint:javascript_log_in_with_replit
// Session storage table - required for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Demo Codes table - must be defined before users table
export const demoCodes = pgTable("demo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  label: text("label").notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validUntil: timestamp("valid_until").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  maxUses: integer("max_uses"), // null = unlimited
  currentUses: integer("current_uses").notNull().default(0),
  isProvisioned: boolean("is_provisioned").notNull().default(false),
  provisioningError: text("provisioning_error"), // Error message if provisioning failed
  provisionedAt: timestamp("provisioned_at"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDemoCodeSchema = createInsertSchema(demoCodes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentUses: true,
  isProvisioned: true,
  provisionedAt: true,
}).extend({
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

export type InsertDemoCode = z.infer<typeof insertDemoCodeSchema>;
export type DemoCode = typeof demoCodes.$inferSelect;

// User storage table - updated for Replit Auth compatibility
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phoneNumber: varchar("phone_number"),
  profileImageUrl: varchar("profile_image_url"),
  notificationPreferences: jsonb("notification_preferences").default(sql`'{"applicationSubmitted":true,"applicationApproved":true,"applicationRejected":true,"commentsAdded":true,"stepAssigned":true}'`),
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Legal entity type - distinguishes between POA and HOA communities
export const legalEntityTypeSchema = z.enum(['poa', 'hoa']);
export type LegalEntityType = z.infer<typeof legalEntityTypeSchema>;

// Address schema (reusable)
export const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});

// Management company settings type
export const managementCompanySettingsSchema = z.object({
  description: z.string().optional(),
  address: addressSchema.optional(),
  mailingAddress: addressSchema.optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  paymentInstructions: z.string().optional(),
  logoUrl: z.string().optional(),
  // Default fallback rep for properties with no explicit assignment
  defaultRepUserId: z.string().optional(),
  defaultRepTitle: z.string().optional(), // e.g., "Community Manager", "Property Liaison"
});

export type ManagementCompanySettings = z.infer<typeof managementCompanySettingsSchema>;

// Community settings type (for community-specific settings like legal entity, contact info, etc.)
export const communitySettingsSchema = z.object({
  // Legal Entity
  legalEntityType: legalEntityTypeSchema.optional(), // 'poa' or 'hoa' - defaults to 'poa' if not set
  legalEntityName: z.string().optional(), // Official legal name (e.g., "Markland Property Owners Association, Inc.")
  stateOfIncorporation: z.string().optional(),
  taxId: z.string().optional(), // EIN/Tax ID (stored securely, displayed masked)

  // Contact Information
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  officeHours: z.string().optional(),
  emergencyPhone: z.string().optional(),

  // Addresses
  physicalAddress: addressSchema.optional(),
  mailingAddress: addressSchema.optional(),

  // General
  description: z.string().optional(),
  website: z.string().optional(),
  yearEstablished: z.number().optional(),
  numberOfLots: z.number().optional(),
});

export type CommunitySettings = z.infer<typeof communitySettingsSchema>;

// Tenants table (Communities and Management Companies)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'management_company' | 'community'
  subdomain: text("subdomain").notNull().unique(),
  managementCompanyId: varchar("management_company_id").references((): any => tenants.id),
  workflowTemplateId: varchar("workflow_template_id").references(() => workflowTemplates.id, { onDelete: "set null" }),
  designGuidelinesUrl: text("design_guidelines_url"), // URL to property's design guidelines/covenants
  heroImageUrl: text("hero_image_url"), // Custom hero image for community landing page
  doorCount: integer("door_count").default(0), // Number of doors/units in the community
  settings: jsonb("settings").$type<ManagementCompanySettings>(), // Management company settings (address, payment instructions, etc.)
  communitySettings: jsonb("community_settings").$type<CommunitySettings>(), // Community-specific settings (legal entity, contact info, etc.)
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // Billing fields
  contactEmail: text("contact_email"), // Billing contact email
  stripeCustomerId: varchar("stripe_customer_id"), // Stripe customer ID for billing
  autoPayEnabled: boolean("auto_pay_enabled").default(false), // Whether to auto-charge saved payment method
  paymentTermsDays: integer("payment_terms_days").default(30), // Net 30, Net 60, etc.
  billingStatus: text("billing_status").default('active'), // 'active' | 'delinquent' | 'suspended'
  // Self-service registration
  allowPublicApplications: boolean("allow_public_applications").default(true).notNull(), // Allow homeowners to self-register via public search
});

export const insertTenantSchema = createInsertSchema(tenants).omit({
  id: true,
  createdAt: true,
});

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

// User-Tenant-Roles junction table (many-to-many with roles)
export const userTenantRoles = pgTable("user_tenant_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'super_admin', 'account_admin', etc.
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(), // Soft delete support
  deactivatedAt: timestamp("deactivated_at"), // When user was removed from tenant
  deactivatedByUserId: varchar("deactivated_by_user_id").references(() => users.id), // Who removed them
  // Homeowner verification
  isVerified: boolean("is_verified").default(false).notNull(), // True when homeowner's identity is verified
  verifiedAt: timestamp("verified_at"), // When the user was verified
  verifiedByApplicationId: varchar("verified_by_application_id"), // Which application triggered auto-verification
}, (table) => ({
  userTenantIdx: uniqueIndex("user_tenant_idx").on(table.userId, table.tenantId, table.role),
}));

export const insertUserTenantRoleSchema = createInsertSchema(userTenantRoles).omit({
  id: true,
  createdAt: true,
  isActive: true,
  deactivatedAt: true,
  deactivatedByUserId: true,
  isVerified: true,
  verifiedAt: true,
  verifiedByApplicationId: true,
});

export type InsertUserTenantRole = z.infer<typeof insertUserTenantRoleSchema>;
export type UserTenantRole = typeof userTenantRoles.$inferSelect;

// Property Rep Assignments - junction table linking users to properties as assigned reps
export const propertyRepAssignments = pgTable("property_rep_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  designation: text("designation").notNull().default('primary'), // 'primary', 'backup', or custom string
  title: text("title"), // Optional custom title like "Property Manager", "Community Liaison"
  assignedByUserId: varchar("assigned_by_user_id").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"), // Optional internal notes about the assignment
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  propertyUserIdx: uniqueIndex("property_rep_assignments_property_user_idx").on(table.propertyId, table.userId),
  propertyIdx: index("property_rep_assignments_property_idx").on(table.propertyId),
  userIdx: index("property_rep_assignments_user_idx").on(table.userId),
  activeIdx: index("property_rep_assignments_active_idx").on(table.isActive),
}));

export const insertPropertyRepAssignmentSchema = createInsertSchema(propertyRepAssignments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  assignedAt: true,
});

export type InsertPropertyRepAssignment = z.infer<typeof insertPropertyRepAssignmentSchema>;
export type PropertyRepAssignment = typeof propertyRepAssignments.$inferSelect;

// Form Templates table
export const formTemplates = pgTable("form_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  projectType: text("project_type").notNull(), // 'exterior-modifications', 'structural-changes', etc.
  version: integer("version").notNull().default(1),
  name: text("name").notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull(), // The full JSON form schema
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  activatedAt: timestamp("activated_at"),
  activatedByUserId: varchar("activated_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Ensure only one active version per tenant + project type
  tenantProjectTypeActiveIdx: uniqueIndex("tenant_project_type_active_idx")
    .on(table.tenantId, table.projectType, table.isActive)
    .where(sql`${table.isActive} = true`),
}));

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;

// Applications table
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationNumber: text("application_number").notNull().unique(), // Format: {tenant-last-4}-{year}-{random-4} e.g. A1B2-2025-XY9Z
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  projectType: text("project_type").notNull(), // 'exterior-modifications', etc.
  formTemplateId: varchar("form_template_id").notNull().references(() => formTemplates.id),
  formTemplateVersion: integer("form_template_version").notNull(), // Snapshot of version
  submittedByUserId: varchar("submitted_by_user_id").notNull().references(() => users.id),

  // Project Details (Step 1 - Generic)
  title: text("title").notNull(),
  description: text("description").notNull(),
  propertyAddress: text("property_address").notNull(),
  propertyCoordinates: jsonb("property_coordinates"), // {lat: number, lng: number} - from Radar validation

  // Additional Information (Step 2 - Project-Type-Specific)
  formData: jsonb("form_data").notNull(), // The actual submitted data from dynamic form
  completenessScore: integer("completeness_score").default(0).notNull(),

  // Signature
  signatureId: varchar("signature_id"), // Reference to signatures table (added after signature created)

  // Status and Review
  status: text("status").default("pending").notNull(), // 'pending', 'under_review', 'approved', 'rejected'
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewNotes: text("review_notes"),
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  submittedAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applications.$inferSelect;

// Documents table - tracks uploaded files in Azure Blob Storage
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  documentRequirementName: text("document_requirement_name").notNull(), // Matches DocumentRequirement.name
  fileName: text("file_name").notNull(), // Original filename
  blobPath: text("blob_path").notNull(), // Full path: {tenantId}/{applicationId}/{documentId}.{ext}
  containerName: text("container_name").notNull().default("application-documents"), // Azure container
  fileSize: integer("file_size").notNull(), // Bytes
  mimeType: text("mime_type").notNull(), // e.g., 'application/pdf', 'image/jpeg'
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// Document Upload Tokens table - for QR code mobile uploads
export const documentUploadTokens = pgTable("document_upload_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  token: text("token").notNull().unique(), // Crypto-random token (64 chars hex)
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  documentRequirementName: text("document_requirement_name").notNull(), // Which document this is for
  expiresAt: timestamp("expires_at").notNull(), // 10 minutes from creation
  isUsed: boolean("is_used").notNull().default(false),
  uploadedDocumentId: varchar("uploaded_document_id").references(() => documents.id),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  usedAt: timestamp("used_at"),
}, (table) => ({
  tokenIdx: index("token_idx").on(table.token),
}));

export const insertDocumentUploadTokenSchema = createInsertSchema(documentUploadTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type InsertDocumentUploadToken = z.infer<typeof insertDocumentUploadTokenSchema>;
export type DocumentUploadToken = typeof documentUploadTokens.$inferSelect;

// Demo Sessions table (for analytics and tracking)
export const demoSessions = pgTable("demo_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  demoCodeId: varchar("demo_code_id").notNull().references(() => demoCodes.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

export const insertDemoSessionSchema = createInsertSchema(demoSessions).omit({
  id: true,
  startedAt: true,
  lastActivityAt: true,
});

export type InsertDemoSession = z.infer<typeof insertDemoSessionSchema>;
export type DemoSession = typeof demoSessions.$inferSelect;

// Workflow Templates table - predefined workflow configurations
export const workflowTemplates = pgTable("workflow_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g., "Standard 3-Step Review", "Management + Board"
  description: text("description"),
  steps: jsonb("steps").notNull(), // [{title, role, allowEdit, actions}]
  isBlueprint: boolean("is_blueprint").default(false).notNull(),
  version: integer("version").default(1).notNull(),
  parentTemplateId: varchar("parent_template_id").references((): any => workflowTemplates.id),
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;

// Application Workflows table - tracks which workflow an application is using and current step
export const applicationWorkflows = pgTable("application_workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  workflowTemplateId: varchar("workflow_template_id").notNull().references(() => workflowTemplates.id),
  currentStepIndex: integer("current_step_index").notNull().default(0),
  status: text("status").notNull().default("in_progress"), // 'in_progress', 'completed', 'halted'
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertApplicationWorkflowSchema = createInsertSchema(applicationWorkflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicationWorkflow = z.infer<typeof insertApplicationWorkflowSchema>;
export type ApplicationWorkflow = typeof applicationWorkflows.$inferSelect;

// Comments table - threaded comments for applications
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  parentCommentId: varchar("parent_comment_id").references((): any => comments.id, { onDelete: "cascade" }),
  isResolved: boolean("is_resolved").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Workflow Step Actions table - logs transitions through workflow
export const workflowStepActions = pgTable("workflow_step_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationWorkflowId: varchar("application_workflow_id").notNull().references(() => applicationWorkflows.id, { onDelete: "cascade" }),
  stepIndex: integer("step_index").notNull(),
  action: text("action").notNull(), // 'approved', 'rejected', 'conditionally_approved', 'sent_back', 'progressed'
  userId: varchar("user_id").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkflowStepActionSchema = createInsertSchema(workflowStepActions).omit({
  id: true,
  createdAt: true,
});

export type InsertWorkflowStepAction = z.infer<typeof insertWorkflowStepActionSchema>;
export type WorkflowStepAction = typeof workflowStepActions.$inferSelect;

// AI Form Generations table - tracks all AI-generated forms for monitoring and auditing
export const aiFormGenerations = pgTable("ai_form_generations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  applicationType: text("application_type").notNull(), // 'exterior-modifications', 'structural-changes', etc.
  designGuidelinesUrl: text("design_guidelines_url").notNull(), // Snapshot of URL used for generation
  generatedSchema: jsonb("generated_schema").notNull(), // The generated form JSON
  status: text("status").notNull().default("draft"), // 'draft', 'approved', 'rejected', 'active'
  tokensUsed: integer("tokens_used"), // Total tokens consumed
  estimatedCost: text("estimated_cost"), // Cost in USD (stored as string for precision)
  generationTimeMs: integer("generation_time_ms"), // Time taken to generate in milliseconds
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  approvedByUserId: varchar("approved_by_user_id").references(() => users.id),
  formTemplateId: varchar("form_template_id").references(() => formTemplates.id), // Links to active form if approved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  errorMessage: text("error_message"), // Stores error if generation failed
});

export const insertAiFormGenerationSchema = createInsertSchema(aiFormGenerations).omit({
  id: true,
  createdAt: true,
});

export type InsertAiFormGeneration = z.infer<typeof insertAiFormGenerationSchema>;
export type AiFormGeneration = typeof aiFormGenerations.$inferSelect;

// Signatures table - electronic signatures and initials for applications
export const signatures = pgTable("signatures", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // What was signed
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  applicationEditId: varchar("application_edit_id"), // For future use with application edits

  // Who signed
  signedBy: varchar("signed_by").notNull().references(() => users.id),
  signedByName: varchar("signed_by_name", { length: 255 }).notNull(),
  signedByEmail: varchar("signed_by_email", { length: 255 }).notNull(),

  // Type of signature
  type: varchar("type", { length: 20 }).notNull(), // 'signature' | 'initial'

  // Signature data
  signatureImageUrl: text("signature_image_url").notNull(), // Azure Blob Storage URL
  signatureDataUrl: text("signature_data_url"), // Base64 data URL (backup)

  // Audit trail
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv4 or IPv6
  userAgent: text("user_agent"),
  documentHash: varchar("document_hash", { length: 64 }), // SHA-256

  // Consent
  consentText: text("consent_text").notNull(),
  consentGiven: boolean("consent_given").notNull().default(true),

  // Demo support
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  applicationIdIdx: index("signatures_application_id_idx").on(table.applicationId),
  signedByIdx: index("signatures_signed_by_idx").on(table.signedBy),
  typeIdx: index("signatures_type_idx").on(table.type),
  signedAtIdx: index("signatures_signed_at_idx").on(table.signedAt),
}));

export const insertSignatureSchema = createInsertSchema(signatures).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSignature = z.infer<typeof insertSignatureSchema>;
export type Signature = typeof signatures.$inferSelect;

// Add workflowTemplateId to tenants - track which workflow is active for a community
export const updateTenantWorkflowTemplateId = () => {
  // This is a marker - actual migration handled by npm run db:push
};

// ============================================
// COMPLIANCE MODULE TABLES
// ============================================

// Compliance status enum
export const complianceStatusSchema = z.enum([
  'pending',      // Not yet due
  'upcoming',     // Due within reminder period
  'overdue',      // Past due date
  'completed',    // Completed for current period
  'na'            // Not applicable
]);
export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;

// Recurrence pattern enum
export const recurrencePatternSchema = z.enum([
  'none',         // One-time item
  'annual',       // Yearly
  'semi_annual',  // Twice a year
  'quarterly',    // Four times a year
  'monthly',      // Monthly
]);
export type RecurrencePattern = z.infer<typeof recurrencePatternSchema>;

// Scope enum - determines if item is per-property or company-wide
export const complianceScopeSchema = z.enum([
  'property',           // Per-property (community) item
  'management_company'  // Management company level item
]);
export type ComplianceScope = z.infer<typeof complianceScopeSchema>;

// Priority enum
export const compliancePrioritySchema = z.enum([
  'low',
  'normal',
  'high',
  'critical'
]);
export type CompliancePriority = z.infer<typeof compliancePrioritySchema>;

// Compliance Categories - predefined types of compliance items
export const complianceCategories = pgTable("compliance_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  // null tenantId = system-wide default categories
  name: text("name").notNull(), // e.g., "State Filings", "Meeting Requirements", "Insurance & Bonds"
  slug: text("slug").notNull(), // e.g., "state-filings", "meetings", "insurance"
  description: text("description"),
  icon: text("icon"), // Icon identifier for UI (lucide icon name)
  color: text("color"), // Color code for UI badges
  isSystem: boolean("is_system").default(false).notNull(), // True for default categories
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("compliance_categories_tenant_idx").on(table.tenantId),
  slugIdx: index("compliance_categories_slug_idx").on(table.slug),
}));

export const insertComplianceCategorySchema = createInsertSchema(complianceCategories).omit({
  id: true,
  createdAt: true,
});
export type InsertComplianceCategory = z.infer<typeof insertComplianceCategorySchema>;
export type ComplianceCategory = typeof complianceCategories.$inferSelect;

// Compliance Items - individual tracked items with deadlines
export const complianceItems = pgTable("compliance_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Scope - either propertyId OR managementCompanyId, but not both
  scope: text("scope").notNull(), // 'property' or 'management_company'
  propertyId: varchar("property_id").references(() => tenants.id, { onDelete: "cascade" }),
  managementCompanyId: varchar("management_company_id").references(() => tenants.id, { onDelete: "cascade" }),

  // Category reference
  categoryId: varchar("category_id").notNull().references(() => complianceCategories.id),

  // Item details
  title: text("title").notNull(),
  description: text("description"),

  // Dates
  dueDate: timestamp("due_date").notNull(),
  completedDate: timestamp("completed_date"),

  // Recurrence
  recurrencePattern: text("recurrence_pattern").notNull().default('none'),
  recurrenceDay: integer("recurrence_day"), // Day of month for recurring items
  recurrenceMonth: integer("recurrence_month"), // Month for annual items (1-12)
  nextDueDate: timestamp("next_due_date"), // Pre-calculated next due date for recurring items

  // Status and tracking
  status: text("status").notNull().default('pending'),
  priority: text("priority").default('normal'), // 'low', 'normal', 'high', 'critical'

  // Reminders - days before due date to remind
  reminderDays: jsonb("reminder_days").$type<number[]>().default(sql`'[30, 14, 7, 1]'`),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),

  // Metadata
  notes: text("notes"),
  externalReference: text("external_reference"), // Filing number, policy number, etc.

  // Audit
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  completedByUserId: varchar("completed_by_user_id").references(() => users.id),
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  propertyIdx: index("compliance_items_property_idx").on(table.propertyId),
  managementCompanyIdx: index("compliance_items_mgmt_company_idx").on(table.managementCompanyId),
  categoryIdx: index("compliance_items_category_idx").on(table.categoryId),
  dueDateIdx: index("compliance_items_due_date_idx").on(table.dueDate),
  statusIdx: index("compliance_items_status_idx").on(table.status),
}));

export const insertComplianceItemSchema = createInsertSchema(complianceItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertComplianceItem = z.infer<typeof insertComplianceItemSchema>;
export type ComplianceItem = typeof complianceItems.$inferSelect;

// Compliance Documents - attachments linked to compliance items
export const complianceDocuments = pgTable("compliance_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  complianceItemId: varchar("compliance_item_id").notNull().references(() => complianceItems.id, { onDelete: "cascade" }),

  // Document details
  documentType: text("document_type").notNull(), // 'filing_receipt', 'certificate', 'policy', 'minutes', etc.
  fileName: text("file_name").notNull(),
  blobPath: text("blob_path").notNull(),
  containerName: text("container_name").notNull().default("compliance-documents"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),

  // Validity period for documents like insurance policies
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),

  // Audit
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
}, (table) => ({
  complianceItemIdx: index("compliance_docs_item_idx").on(table.complianceItemId),
}));

export const insertComplianceDocumentSchema = createInsertSchema(complianceDocuments).omit({
  id: true,
  uploadedAt: true,
});
export type InsertComplianceDocument = z.infer<typeof insertComplianceDocumentSchema>;
export type ComplianceDocument = typeof complianceDocuments.$inferSelect;

// ============================================
// EVENTS & MEETINGS MODULE
// ============================================

// Event status enum
export const eventStatusSchema = z.enum([
  'draft',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
]);
export type EventStatus = z.infer<typeof eventStatusSchema>;

// Event attendee role enum
export const eventAttendeeRoleSchema = z.enum([
  'organizer',
  'required',
  'optional',
  'presenter'
]);
export type EventAttendeeRole = z.infer<typeof eventAttendeeRoleSchema>;

// Event attendee response status enum
export const eventResponseStatusSchema = z.enum([
  'pending',
  'accepted',
  'declined',
  'tentative'
]);
export type EventResponseStatus = z.infer<typeof eventResponseStatusSchema>;

// Event document type enum
export const eventDocumentTypeSchema = z.enum([
  'agenda',
  'minutes',
  'recording',
  'presentation',
  'attendance_sheet',
  'packet',
  'other'
]);
export type EventDocumentType = z.infer<typeof eventDocumentTypeSchema>;

// Event Types - predefined categories of events
export const eventTypes = pgTable("event_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(), // e.g., "board_meeting", "arc_meeting"
  name: text("name").notNull(), // e.g., "Board Meeting", "ARC Review Meeting"
  description: text("description"),
  icon: text("icon"), // lucide icon name
  color: text("color"), // Color for UI display
  defaultDuration: integer("default_duration").default(60), // Default duration in minutes
  requiresAttendance: boolean("requires_attendance").default(true).notNull(),
  isSystem: boolean("is_system").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  slugIdx: index("event_types_slug_idx").on(table.slug),
}));

export const insertEventTypeSchema = createInsertSchema(eventTypes).omit({
  id: true,
  createdAt: true,
});
export type InsertEventType = z.infer<typeof insertEventTypeSchema>;
export type EventType = typeof eventTypes.$inferSelect;

// Events - core event/meeting records
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Required tenant reference (property or management company)
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Event type
  eventTypeId: varchar("event_type_id").notNull().references(() => eventTypes.id),

  // Event details
  title: text("title").notNull(),
  description: text("description"),

  // Timing
  startDatetime: timestamp("start_datetime").notNull(),
  endDatetime: timestamp("end_datetime").notNull(),
  allDay: boolean("all_day").default(false).notNull(),
  timezone: text("timezone").default('America/New_York'), // IANA timezone for recurring events (DST-aware)

  // Location
  location: text("location"), // Physical address or "Virtual"
  meetingUrl: text("meeting_url"), // Zoom/Teams link

  // Status
  status: text("status").notNull().default('scheduled'),

  // Visibility - controls who can see this event
  // 'public' = visible to all community members (homeowners, board, etc.)
  // 'board' = visible only to board members, managers, and staff
  isPublic: boolean("is_public").default(true).notNull(),

  // Recurrence (iCal RRULE format for flexibility)
  recurrenceRule: text("recurrence_rule"), // e.g., "FREQ=MONTHLY;BYDAY=3TH" for 3rd Thursday
  recurrenceEndDate: timestamp("recurrence_end_date"),
  parentEventId: varchar("parent_event_id").references((): AnyPgColumn => events.id, { onDelete: "cascade" }),
  exceptionDates: text("exception_dates"), // Comma-separated ISO dates of deleted occurrences
  originalOccurrenceDate: text("original_occurrence_date"), // For exception events: the date this exception replaces

  // Reminders & Notices
  reminderDays: jsonb("reminder_days").$type<number[]>().default(sql`'[7, 1]'`),
  noticeRequiredDays: integer("notice_required_days"), // For compliance tracking (e.g., 14 days notice)
  noticeSentAt: timestamp("notice_sent_at"),

  // Audit
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantIdx: index("events_tenant_idx").on(table.tenantId),
  eventTypeIdx: index("events_type_idx").on(table.eventTypeId),
  startDatetimeIdx: index("events_start_datetime_idx").on(table.startDatetime),
  statusIdx: index("events_status_idx").on(table.status),
  parentEventIdx: index("events_parent_idx").on(table.parentEventId),
}));

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Event Attendees - track who should attend and their responses
export const eventAttendees = pgTable("event_attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),

  // User reference (nullable for external attendees)
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),

  // For display or external attendees
  email: text("email"),
  name: text("name"),

  // Attendance details
  role: text("role").notNull().default('required'), // 'organizer', 'required', 'optional', 'presenter'
  responseStatus: text("response_status").notNull().default('pending'), // 'pending', 'accepted', 'declined', 'tentative'
  respondedAt: timestamp("responded_at"),

  // Actual attendance (filled after meeting)
  attended: boolean("attended"),

  // Notes
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("event_attendees_event_idx").on(table.eventId),
  userIdx: index("event_attendees_user_idx").on(table.userId),
}));

export const insertEventAttendeeSchema = createInsertSchema(eventAttendees).omit({
  id: true,
  createdAt: true,
});
export type InsertEventAttendee = z.infer<typeof insertEventAttendeeSchema>;
export type EventAttendee = typeof eventAttendees.$inferSelect;

// Event Documents - agendas, minutes, recordings, etc.
export const eventDocuments = pgTable("event_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),

  // Document details
  documentType: text("document_type").notNull(), // 'agenda', 'minutes', 'recording', etc.
  fileName: text("file_name").notNull(),
  blobPath: text("blob_path").notNull(),
  containerName: text("container_name").notNull().default("event-documents"),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),

  // Audit
  uploadedByUserId: varchar("uploaded_by_user_id").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
}, (table) => ({
  eventIdx: index("event_docs_event_idx").on(table.eventId),
  typeIdx: index("event_docs_type_idx").on(table.documentType),
}));

export const insertEventDocumentSchema = createInsertSchema(eventDocuments).omit({
  id: true,
  uploadedAt: true,
});
export type InsertEventDocument = z.infer<typeof insertEventDocumentSchema>;
export type EventDocument = typeof eventDocuments.$inferSelect;

// Event Applications - links applications to review meetings (for review packets)
export const eventApplications = pgTable("event_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),

  // Ordering for agenda
  orderIndex: integer("order_index").default(0).notNull(),

  // Pre-meeting notes about this application
  notes: text("notes"),

  // Post-meeting decision (filled during/after meeting)
  decision: text("decision"), // 'approved', 'rejected', 'tabled', 'conditional', etc.
  decisionNotes: text("decision_notes"),

  // Audit
  addedByUserId: varchar("added_by_user_id").references(() => users.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("event_applications_event_idx").on(table.eventId),
  applicationIdx: index("event_applications_app_idx").on(table.applicationId),
  // Unique constraint to prevent duplicate links
  uniqueEventApp: index("event_applications_unique_idx").on(table.eventId, table.applicationId),
}));

export const insertEventApplicationSchema = createInsertSchema(eventApplications).omit({
  id: true,
  addedAt: true,
});
export type InsertEventApplication = z.infer<typeof insertEventApplicationSchema>;
export type EventApplication = typeof eventApplications.$inferSelect;

// Calendar Feed Tokens - for iCal subscription URLs
export const calendarFeedTokens = pgTable("calendar_feed_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Unique token for the feed URL (long random string for security)
  token: text("token").notNull().unique(),

  // Optional: restrict to specific tenant
  tenantId: varchar("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),

  // Optional: filter by event types (null = all types)
  eventTypeFilter: jsonb("event_type_filter").$type<string[]>(),

  // Token management
  isActive: boolean("is_active").default(true).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
  accessCount: integer("access_count").default(0).notNull(),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // null = never expires
}, (table) => ({
  userIdx: index("calendar_feed_tokens_user_idx").on(table.userId),
  tokenIdx: index("calendar_feed_tokens_token_idx").on(table.token),
}));

export const insertCalendarFeedTokenSchema = createInsertSchema(calendarFeedTokens).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
  accessCount: true,
});
export type InsertCalendarFeedToken = z.infer<typeof insertCalendarFeedTokenSchema>;
export type CalendarFeedToken = typeof calendarFeedTokens.$inferSelect;

// ============================================
// SUBSCRIPTION & BILLING MODULE TABLES
// ============================================

// Community Tiers - Simplified 4-tier system based on door count
export const communityTiers = pgTable("community_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tierCode: varchar("tier_code", { length: 20 }).notNull().unique(), // 'small', 'medium', 'large', 'xl'
  name: varchar("name", { length: 50 }).notNull(),
  minDoors: integer("min_doors").notNull(),
  maxDoors: integer("max_doors"), // NULL for XL (unlimited)
  basePriceMonthly: text("base_price_monthly").notNull(), // Stored as string for precision
  basePriceYearly: text("base_price_yearly").notNull(),
  includedCredits: integer("included_ai_credits").notNull(),
  defaultOverageCost: text("default_overage_cost").notNull().default("2.00"),
  maxUsers: integer("max_users"),
  maxStorageGb: integer("max_storage_gb"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommunityTierSchema = createInsertSchema(communityTiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCommunityTier = z.infer<typeof insertCommunityTierSchema>;
export type CommunityTier = typeof communityTiers.$inferSelect;

// Community Subscription Status enum
export const communitySubscriptionStatusSchema = z.enum([
  'active',
  'trial',
  'canceled',
  'paused'
]);
export type CommunitySubscriptionStatus = z.infer<typeof communitySubscriptionStatusSchema>;

// Community Subscriptions - Per-community subscription with custom pricing
export const communitySubscriptions = pgTable("community_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  tierId: varchar("tier_id").notNull().references(() => communityTiers.id),
  doorCount: integer("door_count").notNull().default(0),
  status: text("status").notNull().default("active"), // active, trial, canceled, paused

  // Custom pricing overrides (NULL = use tier default)
  customPriceMonthly: text("custom_price_monthly"),
  customPriceYearly: text("custom_price_yearly"),
  customAiCredits: integer("custom_ai_credits"),
  customOverageCost: text("custom_overage_cost"),
  pricingNote: text("pricing_note"),
  pricingSetByUserId: varchar("pricing_set_by_user_id").references(() => users.id),
  pricingSetAt: timestamp("pricing_set_at"),

  // Billing cycle
  billingCycleDay: integer("billing_cycle_day").notNull().default(1),
  currentPeriodStart: timestamp("current_period_start").notNull().defaultNow(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),

  // Current period usage
  aiCreditsUsed: integer("ai_credits_used").notNull().default(0),
  applicationsThisMonth: integer("applications_this_month").notNull().default(0),

  // External billing (Stripe - future)
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeCustomerId: varchar("stripe_customer_id"),

  // Demo support
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  communityUniqueIdx: uniqueIndex("community_subscriptions_community_unique_idx").on(table.communityId),
  tierIdx: index("community_subscriptions_tier_idx").on(table.tierId),
  statusIdx: index("community_subscriptions_status_idx").on(table.status),
}));

export const insertCommunitySubscriptionSchema = createInsertSchema(communitySubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCommunitySubscription = z.infer<typeof insertCommunitySubscriptionSchema>;
export type CommunitySubscription = typeof communitySubscriptions.$inferSelect;

// Usage Event Type enum
export const usageEventTypeSchema = z.enum([
  'ai_analysis',
  'application_submitted',
  'document_uploaded',
  'user_added',
  'storage_increased',
  'form_created'
]);
export type UsageEventType = z.infer<typeof usageEventTypeSchema>;

// Usage Events - Audit log for all billable actions
export const usageEvents = pgTable("usage_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'ai_analysis', 'application_submitted', etc.
  entityType: text("entity_type"), // 'ai_analysis', 'application', etc.
  entityId: varchar("entity_id"),
  creditsUsed: integer("credits_used").default(0),
  isOverage: boolean("is_overage").default(false),
  costAtTime: text("cost_at_time"), // Snapshot of overage cost
  metadata: jsonb("metadata"),
  userId: varchar("user_id").references(() => users.id),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  communityIdx: index("usage_events_community_idx").on(table.communityId),
  eventTypeIdx: index("usage_events_type_idx").on(table.eventType),
  periodIdx: index("usage_events_period_idx").on(table.billingPeriodStart, table.billingPeriodEnd),
}));

export const insertUsageEventSchema = createInsertSchema(usageEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertUsageEvent = z.infer<typeof insertUsageEventSchema>;
export type UsageEvent = typeof usageEvents.$inferSelect;

// Invoice Status enum
export const invoiceStatusSchema = z.enum([
  'draft',
  'finalized',
  'sent',
  'paid',
  'void'
]);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

// Invoices - Monthly invoice records
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(),
  billedToTenantId: varchar("billed_to_tenant_id").notNull().references(() => tenants.id),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  status: text("status").notNull().default("draft"),

  // Amounts
  subtotal: text("subtotal").notNull().default("0"),
  taxAmount: text("tax_amount").notNull().default("0"),
  discountAmount: text("discount_amount").notNull().default("0"),
  totalAmount: text("total_amount").notNull().default("0"),

  // Payment tracking
  dueDate: timestamp("due_date"),
  paidAt: timestamp("paid_at"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  paymentReference: varchar("payment_reference", { length: 255 }),

  // External billing (Stripe)
  stripeInvoiceId: varchar("stripe_invoice_id"),
  stripeHostedInvoiceUrl: text("stripe_hosted_invoice_url"),

  // Notes
  notes: text("notes"),

  // Demo support
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at").defaultNow(),
  finalizedAt: timestamp("finalized_at"),
  sentAt: timestamp("sent_at"),
}, (table) => ({
  tenantIdx: index("invoices_tenant_idx").on(table.billedToTenantId),
  statusIdx: index("invoices_status_idx").on(table.status),
  periodIdx: index("invoices_period_idx").on(table.billingPeriodStart, table.billingPeriodEnd),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Invoice Line Item Type enum
export const invoiceLineTypeSchema = z.enum([
  'subscription',
  'ai_overage',
  'storage_overage',
  'other'
]);
export type InvoiceLineType = z.infer<typeof invoiceLineTypeSchema>;

// Invoice Line Items - Itemized charges on invoices
export const invoiceLineItems = pgTable("invoice_line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  communityId: varchar("community_id").references(() => tenants.id),
  lineType: text("line_type").notNull(), // 'subscription', 'ai_overage', etc.
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: text("unit_price").notNull(),
  totalPrice: text("total_price").notNull(),
  tierId: varchar("tier_id").references(() => communityTiers.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  invoiceIdx: index("invoice_line_items_invoice_idx").on(table.invoiceId),
  communityIdx: index("invoice_line_items_community_idx").on(table.communityId),
}));

export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems).omit({
  id: true,
  createdAt: true,
});
export type InsertInvoiceLineItem = z.infer<typeof insertInvoiceLineItemSchema>;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;

// ============================================
// AI ANALYSIS MODULE TABLES
// ============================================

// AI Analysis Credits - Per-tenant credit tracking for AI analysis feature
export const aiAnalysisCredits = pgTable("ai_analysis_credits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Default from subscription tier (set based on plan)
  monthlyIncludedCredits: integer("monthly_included_credits").notNull().default(0),
  overageCostPerAnalysis: text("overage_cost_per_analysis").notNull().default("3.99"), // Stored as string for precision

  // Super admin overrides (NULL = use tier default)
  overrideMonthlyCredits: integer("override_monthly_credits"),
  overrideOverageCost: text("override_overage_cost"),
  overrideReason: text("override_reason"),
  overrideSetByUserId: varchar("override_set_by_user_id").references(() => users.id),
  overrideSetAt: timestamp("override_set_at"),

  // Usage tracking
  creditsUsedThisMonth: integer("credits_used_this_month").notNull().default(0),
  billingCycleStart: timestamp("billing_cycle_start").notNull().defaultNow(),
  lastResetAt: timestamp("last_reset_at"),

  // Audit
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  tenantUniqueIdx: uniqueIndex("ai_analysis_credits_tenant_unique_idx").on(table.tenantId),
}));

export const insertAiAnalysisCreditsSchema = createInsertSchema(aiAnalysisCredits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAiAnalysisCredits = z.infer<typeof insertAiAnalysisCreditsSchema>;
export type AiAnalysisCredits = typeof aiAnalysisCredits.$inferSelect;

// AI Analysis Status enum
export const aiAnalysisStatusSchema = z.enum([
  'queued',      // Job is in queue waiting to be processed
  'processing',  // Worker is actively processing
  'completed',   // Analysis finished successfully
  'failed'       // Analysis failed (see errorMessage)
]);
export type AiAnalysisStatus = z.infer<typeof aiAnalysisStatusSchema>;

// AI Analysis Risk Level enum
export const aiAnalysisRiskLevelSchema = z.enum([
  'low',
  'medium',
  'high',
  'critical'
]);
export type AiAnalysisRiskLevel = z.infer<typeof aiAnalysisRiskLevelSchema>;

// AI Analyses - Analysis results storage
export const aiAnalyses = pgTable("ai_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  requestedByUserId: varchar("requested_by_user_id").notNull().references(() => users.id),

  // Status tracking
  status: text("status").notNull().default("queued"), // queued, processing, completed, failed
  priority: integer("priority").notNull().default(0), // Higher = more priority

  // Timing
  queuedAt: timestamp("queued_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  processingDurationMs: integer("processing_duration_ms"),

  // Analysis Results
  complianceScore: integer("compliance_score"), // 0-100
  riskLevel: text("risk_level"), // low, medium, high, critical
  overallSummary: text("overall_summary"),

  // Detailed Analysis (JSONB)
  bylawCompliance: jsonb("bylaw_compliance"), // Array of bylaw assessments
  riskAssessment: jsonb("risk_assessment"), // Array of identified risks
  questionsConcerns: jsonb("questions_concerns"), // Questions for board
  recommendations: jsonb("recommendations"), // Action recommendations

  // Geospatial
  propertyCoordinates: jsonb("property_coordinates"), // {lat: number, lng: number}
  satelliteImageUrl: text("satellite_image_url"),

  // AI Generated Images
  aiMockupUrls: jsonb("ai_mockup_urls"), // Array of URLs
  blueprintUrls: jsonb("blueprint_urls"), // Array of URLs

  // PDF Report
  pdfReportUrl: text("pdf_report_url"),

  // Cost tracking
  anthropicTokensUsed: integer("anthropic_tokens_used"),
  anthropicCostUsd: text("anthropic_cost_usd"), // Stored as string for precision
  googleMapsCostUsd: text("google_maps_cost_usd"),
  imageGenCostUsd: text("image_gen_cost_usd"),
  totalCostUsd: text("total_cost_usd"),

  // Error handling
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),

  // Job options (stored for worker to use)
  jobOptions: jsonb("job_options"), // {includeSatellite, includeMockups, includeBreakdownReport, mockupQuality}

  // Breakdown report (comprehensive analysis)
  breakdownReport: jsonb("breakdown_report"), // Full BreakdownReportResult object
  breakdownPdfReportUrl: text("breakdown_pdf_report_url"),

  // Property research (tax, liens, permits, deeds, legal issues, etc.)
  propertyResearch: jsonb("property_research"), // Full PropertyResearchResult object

  // Quality feedback
  userRating: integer("user_rating"), // 1-5 stars
  userFeedback: text("user_feedback"),

  // Audit
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  applicationIdx: index("ai_analyses_application_idx").on(table.applicationId),
  tenantIdx: index("ai_analyses_tenant_idx").on(table.tenantId),
  statusIdx: index("ai_analyses_status_idx").on(table.status),
  queuedAtIdx: index("ai_analyses_queued_at_idx").on(table.queuedAt),
}));

export const insertAiAnalysisSchema = createInsertSchema(aiAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  queuedAt: true,
});
export type InsertAiAnalysis = z.infer<typeof insertAiAnalysisSchema>;
export type AiAnalysis = typeof aiAnalyses.$inferSelect;

// Application Events - unified audit log for application lifecycle events
export const applicationEvents = pgTable("application_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  applicationId: varchar("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),

  // Event type (ai_analysis_queued, ai_analysis_completed, workflow_approved, etc.)
  eventType: text("event_type").notNull(),

  // Actor (who triggered the event)
  userId: varchar("user_id").references(() => users.id),

  // Event-specific data (structured JSON)
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  // Human-readable summary
  summary: text("summary"),

  // Related entity references (for linking to AI analyses, documents, etc.)
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: varchar("related_entity_id"),

  // Demo support
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),

  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  applicationIdx: index("application_events_application_idx").on(table.applicationId),
  tenantIdx: index("application_events_tenant_idx").on(table.tenantId),
  eventTypeIdx: index("application_events_type_idx").on(table.eventType),
  createdAtIdx: index("application_events_created_at_idx").on(table.createdAt),
}));

export const insertApplicationEventSchema = createInsertSchema(applicationEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertApplicationEvent = z.infer<typeof insertApplicationEventSchema>;
export type ApplicationEvent = typeof applicationEvents.$inferSelect;

// ============================================
// Inter-App Sync Events
// ============================================

// Track sync events for debugging and audit
export const syncEvents = pgTable("sync_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  direction: text("direction").notNull(), // "inbound" | "outbound"
  partnerApp: text("partner_app").notNull(), // e.g., "homehub"
  action: text("action").notNull(), // e.g., "project.seed", "project.statusChanged"
  payload: jsonb("payload"), // The sync payload data
  response: jsonb("response"), // Response received/sent
  status: text("status").notNull(), // "success" | "failed" | "pending"
  errorMessage: text("error_message"),
  correlationId: text("correlation_id"), // nonce for tracking/deduplication
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  directionIdx: index("sync_events_direction_idx").on(table.direction),
  partnerAppIdx: index("sync_events_partner_app_idx").on(table.partnerApp),
  actionIdx: index("sync_events_action_idx").on(table.action),
  statusIdx: index("sync_events_status_idx").on(table.status),
  createdAtIdx: index("sync_events_created_at_idx").on(table.createdAt),
}));

export const insertSyncEventSchema = createInsertSchema(syncEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertSyncEvent = z.infer<typeof insertSyncEventSchema>;
export type SyncEvent = typeof syncEvents.$inferSelect;
