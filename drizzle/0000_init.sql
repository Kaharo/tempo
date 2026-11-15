CREATE TYPE "public"."draft_status" AS ENUM('draft', 'in_review', 'approved', 'rejected', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."edition_status" AS ENUM('draft', 'assembling', 'complete', 'incomplete', 'published', 'superseded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."integration_state" AS ENUM('connected', 'disconnected', 'error', 'export_only');--> statement-breakpoint
CREATE TYPE "public"."provider_kind" AS ENUM('anthropic', 'openai', 'gemini', 'openai_compatible', 'manual');--> statement-breakpoint
CREATE TYPE "public"."retrieval_status" AS ENUM('ok', 'error', 'skipped', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('unverified', 'corroborated', 'single_source', 'conflicting', 'rejected');--> statement-breakpoint
CREATE TABLE "agent_configs" (
	"agent_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_hash" text NOT NULL,
	"config" jsonb NOT NULL,
	"system_prompt" text NOT NULL,
	"editorial_policy" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_configs_agent_id_version_pk" PRIMARY KEY("agent_id","version")
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"config_version" integer NOT NULL,
	"edition_date" date NOT NULL,
	"provider_id" text NOT NULL,
	"model" text NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"input_cluster_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_source_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"prompt_hash" text,
	"raw_output" text,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" real,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"active_config_version" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"distribution_job_id" uuid,
	"metric" text NOT NULL,
	"value" real NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"draft_version" integer NOT NULL,
	"channel" text NOT NULL,
	"account" text,
	"language" text NOT NULL,
	"decision" text NOT NULL,
	"window_start" timestamp with time zone,
	"window_end" timestamp with time zone,
	"decided_by" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"edition_date" date NOT NULL,
	"cluster_id" uuid,
	"section" text DEFAULT 'analytics' NOT NULL,
	"headline" text NOT NULL,
	"dek" text,
	"body" jsonb NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interpretation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"uncertainties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_id" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cluster_id" uuid,
	"agent_run_id" uuid,
	"statement" text NOT NULL,
	"kind" text DEFAULT 'fact' NOT NULL,
	"source_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"event_date" date,
	"status" "verification_status" DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distribution_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"approval_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"external_post_id" text,
	"external_url" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "distribution_jobs_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edition_date" date NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "edition_status" DEFAULT 'draft' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"lead_article_id" uuid,
	"layout" jsonb NOT NULL,
	"completeness" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generation_mode" text NOT NULL,
	"assembled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument" text NOT NULL,
	"kind" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"value" real NOT NULL,
	"currency" text,
	"source" text NOT NULL,
	"source_url" text
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"state" "integration_state" DEFAULT 'disconnected' NOT NULL,
	"detail" text,
	"last_sync_at" timestamp with time zone,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" text NOT NULL,
	"edition_date" date NOT NULL,
	"idempotency_key" text NOT NULL,
	"trigger" text NOT NULL,
	"status" "run_status" DEFAULT 'queued' NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "provider_kind" NOT NULL,
	"base_url" text,
	"api_key_env" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perspectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" text NOT NULL,
	"agent_run_id" uuid NOT NULL,
	"edition_date" date NOT NULL,
	"cluster_id" uuid,
	"headline" text NOT NULL,
	"body" text NOT NULL,
	"language" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"preferred_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"muted_topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"muted_sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"geographic_interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"followed_project_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agent_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"editorial_depth" text DEFAULT 'standard' NOT NULL,
	"reading_language" text DEFAULT 'ru' NOT NULL,
	"ranking_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"indicator" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"value" real NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"status" text,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"developments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decisions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blockers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_integration" text,
	"external_ref" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "publication_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"language" text NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "draft_status" DEFAULT 'draft' NOT NULL,
	"origin_article_id" uuid,
	"source_item_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_for" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"url" text NOT NULL,
	"canonical_url" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"author" text,
	"published_at" timestamp with time zone,
	"retrieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retrieval_method" text DEFAULT 'rss' NOT NULL,
	"language" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fingerprint" text NOT NULL,
	"cluster_id" uuid,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "source_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"homepage" text,
	"tier" integer DEFAULT 2 NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_status" "retrieval_status",
	"last_error" text,
	"etag" text,
	"last_modified" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_clusters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"item_count" integer DEFAULT 1 NOT NULL,
	"distinct_providers" integer DEFAULT 1 NOT NULL,
	"best_tier" integer DEFAULT 3 NOT NULL,
	"verification" "verification_status" DEFAULT 'unverified' NOT NULL,
	"verification_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"score" real,
	"score_breakdown" jsonb,
	"routed_agents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"level" text NOT NULL,
	"scope" text NOT NULL,
	"message" text NOT NULL,
	"job_run_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"timezone" text DEFAULT 'Asia/Almaty' NOT NULL,
	"locale" text DEFAULT 'ru' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analytics_observations" ADD CONSTRAINT "analytics_observations_distribution_job_id_distribution_jobs_id_fk" FOREIGN KEY ("distribution_job_id") REFERENCES "public"."distribution_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_draft_id_publication_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."publication_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_jobs" ADD CONSTRAINT "distribution_jobs_draft_id_publication_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."publication_drafts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_jobs" ADD CONSTRAINT "distribution_jobs_approval_id_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editions" ADD CONSTRAINT "editions_lead_article_id_articles_id_fk" FOREIGN KEY ("lead_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perspectives" ADD CONSTRAINT "perspectives_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perspectives" ADD CONSTRAINT "perspectives_agent_run_id_agent_runs_id_fk" FOREIGN KEY ("agent_run_id") REFERENCES "public"."agent_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perspectives" ADD CONSTRAINT "perspectives_cluster_id_story_clusters_id_fk" FOREIGN KEY ("cluster_id") REFERENCES "public"."story_clusters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publication_drafts" ADD CONSTRAINT "publication_drafts_origin_article_id_articles_id_fk" FOREIGN KEY ("origin_article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_items" ADD CONSTRAINT "source_items_provider_id_source_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."source_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_cfg_hash" ON "agent_configs" USING btree ("agent_id","content_hash");--> statement-breakpoint
CREATE INDEX "agent_runs_date" ON "agent_runs" USING btree ("edition_date","agent_id");--> statement-breakpoint
CREATE INDEX "analytics_channel_metric" ON "analytics_observations" USING btree ("channel","metric","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cal_ext" ON "calendar_events" USING btree ("integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "editions_date_version" ON "editions" USING btree ("edition_date","version");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_obs_unique" ON "financial_observations" USING btree ("instrument","observed_at","source");--> statement-breakpoint
CREATE INDEX "job_runs_key" ON "job_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "job_runs_date" ON "job_runs" USING btree ("edition_date","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_unique" ON "progress_snapshots" USING btree ("indicator","period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "source_items_canonical" ON "source_items" USING btree ("canonical_url");--> statement-breakpoint
CREATE INDEX "source_items_published" ON "source_items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "logs_created" ON "system_logs" USING btree ("created_at");