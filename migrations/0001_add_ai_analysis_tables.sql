-- AI Analysis Module Tables
-- This migration adds the ai_analysis_credits and ai_analyses tables

-- AI Analysis Credits - Per-tenant credit tracking
CREATE TABLE IF NOT EXISTS "ai_analysis_credits" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" varchar NOT NULL,
  "monthly_included_credits" integer DEFAULT 0 NOT NULL,
  "overage_cost_per_analysis" text DEFAULT '3.99' NOT NULL,
  "override_monthly_credits" integer,
  "override_overage_cost" text,
  "override_reason" text,
  "override_set_by_user_id" varchar,
  "override_set_at" timestamp,
  "credits_used_this_month" integer DEFAULT 0 NOT NULL,
  "billing_cycle_start" timestamp DEFAULT now() NOT NULL,
  "last_reset_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_analysis_credits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_analysis_credits_override_set_by_user_id_users_id_fk" FOREIGN KEY ("override_set_by_user_id") REFERENCES "users"("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ai_analysis_credits_tenant_unique_idx" ON "ai_analysis_credits" USING btree ("tenant_id");

-- AI Analyses - Analysis results storage
CREATE TABLE IF NOT EXISTS "ai_analyses" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" varchar NOT NULL,
  "tenant_id" varchar NOT NULL,
  "requested_by_user_id" varchar NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "priority" integer DEFAULT 0 NOT NULL,
  "queued_at" timestamp DEFAULT now() NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "processing_duration_ms" integer,
  "compliance_score" integer,
  "risk_level" text,
  "overall_summary" text,
  "bylaw_compliance" jsonb,
  "risk_assessment" jsonb,
  "questions_concerns" jsonb,
  "recommendations" jsonb,
  "property_coordinates" jsonb,
  "satellite_image_url" text,
  "ai_mockup_urls" jsonb,
  "blueprint_urls" jsonb,
  "pdf_report_url" text,
  "anthropic_tokens_used" integer,
  "anthropic_cost_usd" text,
  "google_maps_cost_usd" text,
  "image_gen_cost_usd" text,
  "total_cost_usd" text,
  "error_message" text,
  "retry_count" integer DEFAULT 0,
  "user_rating" integer,
  "user_feedback" text,
  "demo_code_id" varchar,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ai_analyses_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_analyses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "ai_analyses_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id"),
  CONSTRAINT "ai_analyses_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "demo_codes"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ai_analyses_application_idx" ON "ai_analyses" USING btree ("application_id");
CREATE INDEX IF NOT EXISTS "ai_analyses_tenant_idx" ON "ai_analyses" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "ai_analyses_status_idx" ON "ai_analyses" USING btree ("status");
CREATE INDEX IF NOT EXISTS "ai_analyses_queued_at_idx" ON "ai_analyses" USING btree ("queued_at");
