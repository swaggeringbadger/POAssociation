CREATE TABLE "agenda_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"allows_applications" boolean DEFAULT false NOT NULL,
	"allows_discussion_items" boolean DEFAULT true NOT NULL,
	"is_system_defined" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agenda_sections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "event_agenda_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"section_id" varchar NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"item_type" text NOT NULL,
	"application_id" varchar,
	"review_stage" text,
	"title" text,
	"description" text,
	"presenter_id" varchar,
	"presenter_notes" text,
	"estimated_minutes" integer,
	"decision" text,
	"decision_notes" text,
	"added_by_user_id" varchar,
	"added_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"demo_code_id" varchar
);
--> statement-breakpoint
CREATE TABLE "meeting_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"event_type_slug" text,
	"sections" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"demo_code_id" varchar
);
--> statement-breakpoint
CREATE TABLE "tour_content_overrides" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_key" text NOT NULL,
	"role" text NOT NULL,
	"page_title" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"steps" jsonb NOT NULL,
	"updated_by_user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_tour_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"page_key" text NOT NULL,
	"role" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	"demo_code_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "areas_of_expertise" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "meeting_template_id" varchar;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "agenda_finalized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "agenda_finalized_at" timestamp;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "agenda_finalized_by_user_id" varchar;--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_section_id_agenda_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."agenda_sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_presenter_id_users_id_fk" FOREIGN KEY ("presenter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_agenda_items" ADD CONSTRAINT "event_agenda_items_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_templates" ADD CONSTRAINT "meeting_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_templates" ADD CONSTRAINT "meeting_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_templates" ADD CONSTRAINT "meeting_templates_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tour_content_overrides" ADD CONSTRAINT "tour_content_overrides_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tour_progress" ADD CONSTRAINT "user_tour_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tour_progress" ADD CONSTRAINT "user_tour_progress_demo_code_id_demo_codes_id_fk" FOREIGN KEY ("demo_code_id") REFERENCES "public"."demo_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_agenda_items_event_idx" ON "event_agenda_items" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_agenda_items_section_idx" ON "event_agenda_items" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "event_agenda_items_application_idx" ON "event_agenda_items" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "event_agenda_items_order_idx" ON "event_agenda_items" USING btree ("event_id","section_id","order_index");--> statement-breakpoint
CREATE INDEX "meeting_templates_tenant_idx" ON "meeting_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "meeting_templates_event_type_idx" ON "meeting_templates" USING btree ("event_type_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tour_content_overrides_page_role_idx" ON "tour_content_overrides" USING btree ("page_key","role");--> statement-breakpoint
CREATE UNIQUE INDEX "user_tour_progress_user_page_role_idx" ON "user_tour_progress" USING btree ("user_id","page_key","role");--> statement-breakpoint
CREATE INDEX "user_tour_progress_user_idx" ON "user_tour_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_tour_progress_page_idx" ON "user_tour_progress" USING btree ("page_key");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_agenda_finalized_by_user_id_users_id_fk" FOREIGN KEY ("agenda_finalized_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_meeting_template_idx" ON "events" USING btree ("meeting_template_id");