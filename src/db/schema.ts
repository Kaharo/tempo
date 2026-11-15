/**
 * TEMPO data model.
 * Traceability chain: source_items → story_clusters → claims → agent_runs →
 * perspectives / articles → editions. Every published text keeps the IDs of
 * the source items and the agent run that produced it.
 */
import {
  pgTable, pgEnum, text, uuid, timestamp, integer, real, boolean, jsonb,
  date, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ---------- enums ----------
export const providerKind = pgEnum("provider_kind", ["anthropic", "openai", "gemini", "openai_compatible", "manual"]);
export const retrievalStatus = pgEnum("retrieval_status", ["ok", "error", "skipped", "blocked"]);
export const verificationStatus = pgEnum("verification_status", ["unverified", "corroborated", "single_source", "conflicting", "rejected"]);
export const runStatus = pgEnum("run_status", ["queued", "running", "succeeded", "failed", "skipped", "cancelled"]);
export const editionStatus = pgEnum("edition_status", ["draft", "assembling", "complete", "incomplete", "published", "superseded", "failed"]);
export const draftStatus = pgEnum("draft_status", ["draft", "in_review", "approved", "rejected", "scheduled", "published", "archived"]);
export const integrationState = pgEnum("integration_state", ["connected", "disconnected", "error", "export_only"]);

// ---------- users & preferences ----------
export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  timezone: text("timezone").notNull().default("Asia/Almaty"),
  locale: text("locale").notNull().default("ru"),
  createdAt: created(),
});

/** Explicit, reviewable preferences. No behavioural inference. */
export const preferences = pgTable("preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  preferredTopics: jsonb("preferred_topics").$type<string[]>().notNull().default([]),
  mutedTopics: jsonb("muted_topics").$type<string[]>().notNull().default([]),
  preferredSources: jsonb("preferred_sources").$type<string[]>().notNull().default([]),
  mutedSources: jsonb("muted_sources").$type<string[]>().notNull().default([]),
  geographicInterests: jsonb("geographic_interests").$type<string[]>().notNull().default([]),
  followedProjectIds: jsonb("followed_project_ids").$type<string[]>().notNull().default([]),
  agentWeights: jsonb("agent_weights").$type<Record<string, number>>().notNull().default({}),
  editorialDepth: text("editorial_depth").notNull().default("standard"), // brief | standard | deep
  readingLanguage: text("reading_language").notNull().default("ru"),
  rankingWeights: jsonb("ranking_weights").$type<Record<string, number>>().notNull().default({}),
  updatedAt: updated(),
});

/** Key/value settings, incl. editable pipeline schedule. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updated(),
});

// ---------- models & agents ----------
export const modelProviders = pgTable("model_providers", {
  id: text("id").primaryKey(), // e.g. "anthropic", "openai", "local-vllm"
  kind: providerKind("kind").notNull(),
  baseUrl: text("base_url"),
  apiKeyEnv: text("api_key_env"), // name of env var, never the key itself
  enabled: boolean("enabled").notNull().default(true),
  createdAt: created(),
});

export const agents = pgTable("agents", {
  id: text("id").primaryKey(), // orbix, apex, ...
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  activeConfigVersion: integer("active_config_version"),
  createdAt: created(),
});

/** Immutable, versioned snapshot of an agent's full configuration + prompts. */
export const agentConfigs = pgTable("agent_configs", {
  agentId: text("agent_id").notNull().references(() => agents.id),
  version: integer("version").notNull(),
  contentHash: text("content_hash").notNull(),
  config: jsonb("config").notNull(), // validated AgentConfig
  systemPrompt: text("system_prompt").notNull(),
  editorialPolicy: text("editorial_policy").notNull(),
  createdAt: created(),
}, (t) => [primaryKey({ columns: [t.agentId, t.version] }), uniqueIndex("agent_cfg_hash").on(t.agentId, t.contentHash)]);

// ---------- sources ----------
export const sourceProviders = pgTable("source_providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // rss | atom | api | manual
  url: text("url").notNull(),
  homepage: text("homepage"),
  tier: integer("tier").notNull().default(2), // 1 = original/authoritative, 2 = reputable press, 3 = aggregator
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  language: text("language").notNull().default("en"),
  enabled: boolean("enabled").notNull().default(true),
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastStatus: retrievalStatus("last_status"),
  lastError: text("last_error"),
  etag: text("etag"),
  lastModified: text("last_modified"),
  createdAt: created(),
});

export const sourceItems = pgTable("source_items", {
  id: id(),
  providerId: text("provider_id").notNull().references(() => sourceProviders.id),
  url: text("url").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  author: text("author"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull().defaultNow(),
  retrievalMethod: text("retrieval_method").notNull().default("rss"), // rss | api | manual_webfetch
  language: text("language"),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  fingerprint: text("fingerprint").notNull(), // normalized title tokens hash
  clusterId: uuid("cluster_id"),
  raw: jsonb("raw"),
}, (t) => [uniqueIndex("source_items_canonical").on(t.canonicalUrl), index("source_items_published").on(t.publishedAt)]);

export const storyClusters = pgTable("story_clusters", {
  id: id(),
  label: text("label").notNull(),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  itemCount: integer("item_count").notNull().default(1),
  distinctProviders: integer("distinct_providers").notNull().default(1),
  bestTier: integer("best_tier").notNull().default(3),
  verification: verificationStatus("verification").notNull().default("unverified"),
  verificationNotes: jsonb("verification_notes").$type<string[]>().notNull().default([]),
  score: real("score"),
  scoreBreakdown: jsonb("score_breakdown").$type<Record<string, number>>(),
  routedAgents: jsonb("routed_agents").$type<string[]>().notNull().default([]),
  createdAt: created(),
  updatedAt: updated(),
});

/** Factual claims extracted by agents, each tied to supporting source items. */
export const claims = pgTable("claims", {
  id: id(),
  clusterId: uuid("cluster_id").references(() => storyClusters.id),
  agentRunId: uuid("agent_run_id"),
  statement: text("statement").notNull(),
  kind: text("kind").notNull().default("fact"), // fact | interpretation
  sourceItemIds: jsonb("source_item_ids").$type<string[]>().notNull().default([]),
  eventDate: date("event_date"),
  status: verificationStatus("status").notNull().default("unverified"),
  createdAt: created(),
});

// ---------- agent execution & editorial output ----------
export const agentRuns = pgTable("agent_runs", {
  id: id(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  configVersion: integer("config_version").notNull(),
  editionDate: date("edition_date").notNull(),
  providerId: text("provider_id").notNull(),
  model: text("model").notNull(),
  status: runStatus("status").notNull().default("queued"),
  inputClusterIds: jsonb("input_cluster_ids").$type<string[]>().notNull().default([]),
  inputSourceItemIds: jsonb("input_source_item_ids").$type<string[]>().notNull().default([]),
  promptHash: text("prompt_hash"),
  rawOutput: text("raw_output"),
  validationErrors: jsonb("validation_errors").$type<string[]>().notNull().default([]),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: real("cost_usd"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  error: text("error"),
  createdAt: created(),
}, (t) => [index("agent_runs_date").on(t.editionDate, t.agentId)]);

export const perspectives = pgTable("perspectives", {
  id: id(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  agentRunId: uuid("agent_run_id").notNull().references(() => agentRuns.id),
  editionDate: date("edition_date").notNull(),
  clusterId: uuid("cluster_id").references(() => storyClusters.id),
  headline: text("headline").notNull(),
  body: text("body").notNull(),
  language: text("language").notNull(),
  citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
  createdAt: created(),
});

export const articles = pgTable("articles", {
  id: id(),
  agentId: text("agent_id").notNull().references(() => agents.id),
  agentRunId: uuid("agent_run_id").notNull().references(() => agentRuns.id),
  editionDate: date("edition_date").notNull(),
  clusterId: uuid("cluster_id").references(() => storyClusters.id),
  section: text("section").notNull().default("analytics"), // analytics | world | ideas
  headline: text("headline").notNull(),
  dek: text("dek"),
  body: jsonb("body").$type<ArticleBlock[]>().notNull(), // paragraphs with citation refs
  facts: jsonb("facts").$type<string[]>().notNull().default([]),
  interpretation: jsonb("interpretation").$type<string[]>().notNull().default([]),
  uncertainties: jsonb("uncertainties").$type<string[]>().notNull().default([]),
  citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
  language: text("language").notNull(),
  saved: boolean("saved").notNull().default(false),
  createdAt: created(),
});

export const editions = pgTable("editions", {
  id: id(),
  editionDate: date("edition_date").notNull(),
  version: integer("version").notNull().default(1),
  status: editionStatus("status").notNull().default("draft"),
  isCurrent: boolean("is_current").notNull().default(false),
  leadArticleId: uuid("lead_article_id").references(() => articles.id),
  layout: jsonb("layout").$type<EditionLayout>().notNull(),
  completeness: jsonb("completeness").$type<Record<string, string>>().notNull().default({}),
  generationMode: text("generation_mode").notNull(), // api | manual
  assembledAt: timestamp("assembled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex("editions_date_version").on(t.editionDate, t.version)]);

// ---------- personal data ----------
export const integrations = pgTable("integrations", {
  id: text("id").primaryKey(), // google_calendar, github, finance_*, linkedin, x, telegram
  category: text("category").notNull(), // calendar | projects | finance | documents | publishing
  state: integrationState("state").notNull().default("disconnected"),
  detail: text("detail"),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  config: jsonb("config").notNull().default({}),
  updatedAt: updated(),
});

export const projects = pgTable("projects", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sourceIntegration: text("source_integration"), // null = manual entry
  externalRef: text("external_ref"),
  active: boolean("active").notNull().default(true),
  createdAt: created(),
});

/** Observed state at a point in time. Progress is computed from these, never invented. */
export const projectSnapshots = pgTable("project_snapshots", {
  id: id(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  status: text("status"),
  metrics: jsonb("metrics").$type<Record<string, number>>().notNull().default({}),
  developments: jsonb("developments").$type<string[]>().notNull().default([]),
  decisions: jsonb("decisions").$type<string[]>().notNull().default([]),
  blockers: jsonb("blockers").$type<string[]>().notNull().default([]),
  nextSteps: jsonb("next_steps").$type<string[]>().notNull().default([]),
  source: text("source").notNull(), // manual | github | ...
});

export const financialObservations = pgTable("financial_observations", {
  id: id(),
  instrument: text("instrument").notNull(), // e.g. USD/KZT, SPY, BRENT
  kind: text("kind").notNull(), // fx | index | commodity | holding
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  value: real("value").notNull(),
  currency: text("currency"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
}, (t) => [uniqueIndex("fin_obs_unique").on(t.instrument, t.observedAt, t.source)]);

export const progressSnapshots = pgTable("progress_snapshots", {
  id: id(),
  indicator: text("indicator").notNull(), // e.g. "aimos.published_count"
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  value: real("value").notNull(),
  source: text("source").notNull(),
  createdAt: created(),
}, (t) => [uniqueIndex("progress_unique").on(t.indicator, t.periodStart, t.periodEnd)]);

export const calendarEvents = pgTable("calendar_events", {
  id: id(),
  integrationId: text("integration_id").notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  location: text("location"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("cal_ext").on(t.integrationId, t.externalId)]);

// ---------- AIMos ----------
export const publicationDrafts = pgTable("publication_drafts", {
  id: id(),
  channel: text("channel").notNull(), // linkedin | x | telegram
  language: text("language").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  version: integer("version").notNull().default(1),
  status: draftStatus("status").notNull().default("draft"),
  originArticleId: uuid("origin_article_id").references(() => articles.id),
  sourceItemIds: jsonb("source_item_ids").$type<string[]>().notNull().default([]),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
});

/** Approval is bound to a specific draft version, channel, language and window. */
export const approvals = pgTable("approvals", {
  id: id(),
  draftId: uuid("draft_id").notNull().references(() => publicationDrafts.id),
  draftVersion: integer("draft_version").notNull(),
  channel: text("channel").notNull(),
  account: text("account"),
  language: text("language").notNull(),
  decision: text("decision").notNull(), // approved | rejected
  windowStart: timestamp("window_start", { withTimezone: true }),
  windowEnd: timestamp("window_end", { withTimezone: true }),
  decidedBy: text("decided_by").notNull(),
  note: text("note"),
  createdAt: created(),
});

export const distributionJobs = pgTable("distribution_jobs", {
  id: id(),
  draftId: uuid("draft_id").notNull().references(() => publicationDrafts.id),
  approvalId: uuid("approval_id").notNull().references(() => approvals.id),
  channel: text("channel").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: runStatus("status").notNull().default("queued"),
  externalPostId: text("external_post_id"),
  externalUrl: text("external_url"),
  attempts: integer("attempts").notNull().default(0),
  error: text("error"),
  createdAt: created(),
  updatedAt: updated(),
});

export const analyticsObservations = pgTable("analytics_observations", {
  id: id(),
  channel: text("channel").notNull(),
  distributionJobId: uuid("distribution_job_id").references(() => distributionJobs.id),
  metric: text("metric").notNull(), // impressions | reactions | comments | shares | followers
  value: real("value").notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
  source: text("source").notNull(), // api | manual_entry
}, (t) => [index("analytics_channel_metric").on(t.channel, t.metric, t.observedAt)]);

// ---------- automation & observability ----------
export const jobRuns = pgTable("job_runs", {
  id: id(),
  stage: text("stage").notNull(), // collect | process | agents | assemble | publish
  editionDate: date("edition_date").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  trigger: text("trigger").notNull(), // schedule | manual | retry
  status: runStatus("status").notNull().default("queued"),
  attempt: integer("attempt").notNull().default(1),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  stats: jsonb("stats").$type<Record<string, unknown>>().notNull().default({}),
  error: text("error"),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: created(),
}, (t) => [index("job_runs_key").on(t.idempotencyKey), index("job_runs_date").on(t.editionDate, t.stage)]);

export const systemLogs = pgTable("system_logs", {
  id: id(),
  level: text("level").notNull(), // debug | info | warn | error
  scope: text("scope").notNull(),
  message: text("message").notNull(),
  jobRunId: uuid("job_run_id"),
  data: jsonb("data"),
  createdAt: created(),
}, (t) => [index("logs_created").on(t.createdAt)]);

// ---------- shared JSON types ----------
export type Citation = { ref: number; sourceItemId: string; url: string; title: string; publisher: string; publishedAt: string | null };
export type ArticleBlock = { type: "p" | "h2" | "quote"; text: string; refs?: number[] };
export type EditionLayout = {
  leadArticleId: string | null;
  supportingArticleIds: string[];
  perspectiveIds: string[]; // N4U[42], one per agent
  worldClusterIds: string[];
  ideaArticleIds: string[];
  notes: string[];
};

// ---------- external agent briefings ----------
/** Summaries pushed by agents that run outside TEMPO (scheduled Claude tasks etc.). */
export const briefings = pgTable("briefings", {
  id: id(),
  source: text("source").notNull(), // id from config/briefings.yaml
  editionDate: date("edition_date").notNull(),
  headline: text("headline"),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [uniqueIndex("briefings_source_date").on(t.source, t.editionDate)]);

export const briefingItems = pgTable("briefing_items", {
  id: id(),
  briefingId: uuid("briefing_id").notNull().references(() => briefings.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  url: text("url"),
  createdAt: created(),
}, (t) => [uniqueIndex("briefing_items_pos").on(t.briefingId, t.position)]);
