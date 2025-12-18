CREATE TABLE "application_collaborators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"contractor_id" varchar NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"removed_at" timestamp,
	"can_edit_form" boolean DEFAULT true,
	"can_upload_documents" boolean DEFAULT true,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"user_id" varchar,
	"metadata" jsonb,
	"summary" text,
	"related_entity_type" text,
	"related_entity_id" varchar,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" varchar NOT NULL,
	"tier_id" varchar NOT NULL,
	"door_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"custom_price_monthly" text,
	"custom_price_yearly" text,
	"custom_ai_credits" integer,
	"custom_overage_cost" text,
	"pricing_note" text,
	"pricing_set_by_user_id" varchar,
	"pricing_set_at" timestamp,
	"billing_cycle_day" integer DEFAULT 1 NOT NULL,
	"current_period_start" timestamp DEFAULT now() NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"ai_credits_used" integer DEFAULT 0 NOT NULL,
	"applications_this_month" integer DEFAULT 0 NOT NULL,
	"stripe_subscription_id" varchar,
	"stripe_customer_id" varchar,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier_code" varchar(20) NOT NULL,
	"name" varchar(50) NOT NULL,
	"min_doors" integer NOT NULL,
	"max_doors" integer,
	"base_price_monthly" text NOT NULL,
	"base_price_yearly" text NOT NULL,
	"included_ai_credits" integer NOT NULL,
	"default_overage_cost" text DEFAULT '2.00' NOT NULL,
	"max_users" integer,
	"max_storage_gb" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "community_tiers_tier_code_unique" UNIQUE("tier_code")
);
--> statement-breakpoint
CREATE TABLE "contractor_referrals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contractor_id" varchar NOT NULL,
	"tenant_id" varchar NOT NULL,
	"referral_code" text NOT NULL,
	"signed_up_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"qualified_at" timestamp,
	"paid_at" timestamp,
	"payout_amount" text,
	"payout_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contractors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"company_name" text,
	"business_type" text,
	"license_number" text,
	"is_license_verified" boolean DEFAULT false,
	"business_phone" text,
	"business_email" text,
	"website" text,
	"service_area" text,
	"is_publicly_searchable" boolean DEFAULT true,
	"referral_code" text,
	"referral_code_created_at" timestamp,
	"total_applications" integer DEFAULT 0,
	"total_referrals" integer DEFAULT 0,
	"successful_referrals" integer DEFAULT 0,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contractors_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "contractors_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "dev_instructions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_app" text NOT NULL,
	"to_app" text NOT NULL,
	"type" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"context" jsonb,
	"related_action" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"acknowledged_at" timestamp,
	"implemented_at" timestamp,
	"response_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"primary_user_id" varchar NOT NULL,
	"member_user_id" varchar,
	"tenant_id" varchar NOT NULL,
	"relationship" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"accepted_at" timestamp,
	"removed_at" timestamp,
	"removed_by_user_id" varchar,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"type" text NOT NULL,
	"invited_by_user_id" varchar NOT NULL,
	"invitee_email" text NOT NULL,
	"invitee_name" text,
	"tenant_id" varchar,
	"application_id" varchar,
	"household_member_id" varchar,
	"application_collaborator_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"declined_at" timestamp,
	"email_sent_at" timestamp,
	"email_resend_count" integer DEFAULT 0,
	"last_resend_at" timestamp,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"community_id" varchar,
	"line_type" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" text NOT NULL,
	"total_price" text NOT NULL,
	"tier_id" varchar,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"billed_to_tenant_id" varchar NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" text DEFAULT '0' NOT NULL,
	"tax_amount" text DEFAULT '0' NOT NULL,
	"discount_amount" text DEFAULT '0' NOT NULL,
	"total_amount" text DEFAULT '0' NOT NULL,
	"due_date" timestamp,
	"paid_at" timestamp,
	"payment_method" varchar(50),
	"payment_reference" varchar(255),
	"stripe_invoice_id" varchar,
	"stripe_hosted_invoice_url" text,
	"notes" text,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"finalized_at" timestamp,
	"sent_at" timestamp,
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "property_rep_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"designation" text DEFAULT 'primary' NOT NULL,
	"title" text,
	"assigned_by_user_id" varchar,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" text NOT NULL,
	"partner_app" text NOT NULL,
	"action" text NOT NULL,
	"payload" jsonb,
	"response" jsonb,
	"status" text NOT NULL,
	"error_message" text,
	"correlation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" varchar NOT NULL,
	"event_type" text NOT NULL,
	"entity_type" text,
	"entity_id" varchar,
	"credits_used" integer DEFAULT 0,
	"is_overage" boolean DEFAULT false,
	"cost_at_time" text,
	"metadata" jsonb,
	"user_id" varchar,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "job_options" jsonb;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "breakdown_report" jsonb;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "breakdown_pdf_report_url" text;--> statement-breakpoint
ALTER TABLE "ai_analyses" ADD COLUMN "property_research" jsonb;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "property_coordinates" jsonb;--> statement-breakpoint
ALTER TABLE "demo_codes" ADD COLUMN "provisioning_error" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "timezone" text DEFAULT 'America/New_York';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "exception_dates" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "original_occurrence_date" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "hero_image_url" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "door_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" varchar;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "auto_pay_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "payment_terms_days" integer DEFAULT 30;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "billing_status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "allow_public_applications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD COLUMN "deactivated_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD COLUMN "deactivated_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD COLUMN "verified_by_application_id" varchar;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "parent_template_id" varchar;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "created_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "application_collaborators" ADD CONSTRAINT "application_collaborators_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_collaborators" ADD CONSTRAINT "application_collaborators_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_collaborators" ADD CONSTRAINT "application_collaborators_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_collaborators" ADD CONSTRAINT "application_collaborators_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_community_id_tenants_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_tier_id_community_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."community_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_pricing_set_by_user_id_users_id_fk" FOREIGN KEY ("pricing_set_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_subscriptions" ADD CONSTRAINT "community_subscriptions_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_referrals" ADD CONSTRAINT "contractor_referrals_contractor_id_contractors_id_fk" FOREIGN KEY ("contractor_id") REFERENCES "public"."contractors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractor_referrals" ADD CONSTRAINT "contractor_referrals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contractors" ADD CONSTRAINT "contractors_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_primary_user_id_users_id_fk" FOREIGN KEY ("primary_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_member_user_id_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_removed_by_user_id_users_id_fk" FOREIGN KEY ("removed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_household_member_id_household_members_id_fk" FOREIGN KEY ("household_member_id") REFERENCES "public"."household_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_application_collaborator_id_application_collaborators_id_fk" FOREIGN KEY ("application_collaborator_id") REFERENCES "public"."application_collaborators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_community_id_tenants_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_tier_id_community_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."community_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billed_to_tenant_id_tenants_id_fk" FOREIGN KEY ("billed_to_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rep_assignments" ADD CONSTRAINT "property_rep_assignments_property_id_tenants_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rep_assignments" ADD CONSTRAINT "property_rep_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rep_assignments" ADD CONSTRAINT "property_rep_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rep_assignments" ADD CONSTRAINT "property_rep_assignments_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_community_id_tenants_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_collaborators_app_idx" ON "application_collaborators" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_collaborators_contractor_idx" ON "application_collaborators" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "application_collaborators_status_idx" ON "application_collaborators" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "application_collaborators_unique_idx" ON "application_collaborators" USING btree ("application_id","contractor_id");--> statement-breakpoint
CREATE INDEX "application_events_application_idx" ON "application_events" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "application_events_tenant_idx" ON "application_events" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "application_events_type_idx" ON "application_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "application_events_created_at_idx" ON "application_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "community_subscriptions_community_unique_idx" ON "community_subscriptions" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "community_subscriptions_tier_idx" ON "community_subscriptions" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "community_subscriptions_status_idx" ON "community_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractor_referrals_contractor_idx" ON "contractor_referrals" USING btree ("contractor_id");--> statement-breakpoint
CREATE INDEX "contractor_referrals_tenant_idx" ON "contractor_referrals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contractor_referrals_status_idx" ON "contractor_referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contractor_referrals_code_idx" ON "contractor_referrals" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "contractors_user_idx" ON "contractors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contractors_referral_code_idx" ON "contractors" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "contractors_searchable_idx" ON "contractors" USING btree ("is_publicly_searchable");--> statement-breakpoint
CREATE INDEX "contractors_business_type_idx" ON "contractors" USING btree ("business_type");--> statement-breakpoint
CREATE INDEX "dev_instructions_to_app_idx" ON "dev_instructions" USING btree ("to_app");--> statement-breakpoint
CREATE INDEX "dev_instructions_status_idx" ON "dev_instructions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "dev_instructions_priority_idx" ON "dev_instructions" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "dev_instructions_created_at_idx" ON "dev_instructions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "household_members_primary_user_idx" ON "household_members" USING btree ("primary_user_id");--> statement-breakpoint
CREATE INDEX "household_members_member_user_idx" ON "household_members" USING btree ("member_user_id");--> statement-breakpoint
CREATE INDEX "household_members_tenant_idx" ON "household_members" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "household_members_status_idx" ON "household_members" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_token_idx" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("invitee_email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invitations_expires_idx" ON "invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invitations_type_idx" ON "invitations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_line_items_community_idx" ON "invoice_line_items" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("billed_to_tenant_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_period_idx" ON "invoices" USING btree ("billing_period_start","billing_period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "property_rep_assignments_property_user_idx" ON "property_rep_assignments" USING btree ("property_id","user_id");--> statement-breakpoint
CREATE INDEX "property_rep_assignments_property_idx" ON "property_rep_assignments" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_rep_assignments_user_idx" ON "property_rep_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_rep_assignments_active_idx" ON "property_rep_assignments" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sync_events_direction_idx" ON "sync_events" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "sync_events_partner_app_idx" ON "sync_events" USING btree ("partner_app");--> statement-breakpoint
CREATE INDEX "sync_events_action_idx" ON "sync_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "sync_events_status_idx" ON "sync_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_events_created_at_idx" ON "sync_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_events_community_idx" ON "usage_events" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "usage_events_type_idx" ON "usage_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "usage_events_period_idx" ON "usage_events" USING btree ("billing_period_start","billing_period_end");--> statement-breakpoint
ALTER TABLE "user_tenant_roles" ADD CONSTRAINT "user_tenant_roles_deactivated_by_user_id_users_id_fk" FOREIGN KEY ("deactivated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_parent_template_id_workflow_templates_id_fk" FOREIGN KEY ("parent_template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;