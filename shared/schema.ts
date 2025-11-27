import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
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

// Management company settings type
export const managementCompanySettingsSchema = z.object({
  description: z.string().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  mailingAddress: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
  }).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  paymentInstructions: z.string().optional(),
  logoUrl: z.string().optional(),
});

export type ManagementCompanySettings = z.infer<typeof managementCompanySettingsSchema>;

// Tenants table (Communities and Management Companies)
export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'management_company' | 'community'
  subdomain: text("subdomain").notNull().unique(),
  managementCompanyId: varchar("management_company_id").references((): any => tenants.id),
  workflowTemplateId: varchar("workflow_template_id").references(() => workflowTemplates.id, { onDelete: "set null" }),
  designGuidelinesUrl: text("design_guidelines_url"), // URL to property's design guidelines/covenants
  settings: jsonb("settings").$type<ManagementCompanySettings>(), // Management company settings (address, payment instructions, etc.)
  demoCodeId: varchar("demo_code_id").references(() => demoCodes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
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
}, (table) => ({
  userTenantIdx: uniqueIndex("user_tenant_idx").on(table.userId, table.tenantId, table.role),
}));

export const insertUserTenantRoleSchema = createInsertSchema(userTenantRoles).omit({
  id: true,
  createdAt: true,
});

export type InsertUserTenantRole = z.infer<typeof insertUserTenantRoleSchema>;
export type UserTenantRole = typeof userTenantRoles.$inferSelect;

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
  applicationNumber: text("application_number").notNull().unique(), // APP-2024-001
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  projectType: text("project_type").notNull(), // 'exterior-modifications', etc.
  formTemplateId: varchar("form_template_id").notNull().references(() => formTemplates.id),
  formTemplateVersion: integer("form_template_version").notNull(), // Snapshot of version
  submittedByUserId: varchar("submitted_by_user_id").notNull().references(() => users.id),

  // Project Details (Step 1 - Generic)
  title: text("title").notNull(),
  description: text("description").notNull(),
  propertyAddress: text("property_address").notNull(),

  // Additional Information (Step 2 - Project-Type-Specific)
  formData: jsonb("form_data").notNull(), // The actual submitted data from dynamic form
  completenessScore: integer("completeness_score").default(0).notNull(),

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

// Add workflowTemplateId to tenants - track which workflow is active for a community
export const updateTenantWorkflowTemplateId = () => {
  // This is a marker - actual migration handled by npm run db:push
};
