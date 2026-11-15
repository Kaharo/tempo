# Architecture

```
            ┌─────────── clock: GitHub Actions (*/15) · Vercel Cron (backup) · CLI ───────────┐
            ▼                                                                                  │
 config/sources.yaml ─► collect ─► source_items ─► process ─► story_clusters ─► agents ─► perspectives/articles/claims
 (adapters: RSS/Atom/RDF;          (canonical URL    (cluster · verify ·      (6 × N4U[42], provider-agnostic,
  robots.txt, ETag, rate limit)     unique)           score · route)            QA gate, versioned prompts)
                                                                                        │
                                                       editions ◄── assemble ◄──────────┘ ──► publish (is_current)
                                                          │
                                         Next.js app: /, /preview, /api/edition/*, /api/status, /api/regenerate
```

## Components
| Path | Role |
|---|---|
| `src/db/schema.ts` | 26 tables, typed (Drizzle). Migrations in `drizzle/`. |
| `src/lib/sources/` | Registry sync, adapters, robots check, collector, manual ingest |
| `src/lib/pipeline/` | Normalisation, clustering, verification, scoring, routing |
| `src/lib/ai/` | Provider interface + Anthropic, OpenAI, Gemini, OpenAI-compatible, manual |
| `src/lib/agents/` | Config schema, versioned sync, pack builder, runner, output QA |
| `src/lib/edition/` | Assembly, publication, read model |
| `src/lib/jobs/runner.ts` | Idempotent stages, retries, tick scheduler, freshness |
| `scripts/tempo.ts` | CLI used by humans and by the scheduler |
| `agents/` | Version-controlled agent identities and shared policy |

## Traceability
article/perspective → `agent_run_id` (provider, model, config version, prompt hash, raw output, tokens, cost) → `input_source_item_ids` → `source_items` (URL, publisher, published/retrieved timestamps, retrieval method). Claims keep `source_item_ids`.

## Decisions (ADR log)
1. **Next.js + Postgres + Drizzle, single repo.** Simplest stack that covers UI, API, typed schema and migrations. *2026-11-15*
2. **Pipeline runs from a CLI, not inside web requests.** Agent runs take minutes; serverless timeouts would truncate them. The web app only reads and triggers single stages.
3. **Primary clock = GitHub Actions every 15 min calling an idempotent `tick`.** Free, independent of any browser or chat; schedule lives in the DB so it is editable without redeploys. Vercel Cron is a daily backup (Hobby plan limits crons to daily).
4. **Deterministic, model-free dedupe/verify/score.** Cheap, testable, reproducible. Models only write.
5. **Grounding enforced in code.** Agents get a numbered source pack; outputs citing numbers outside the pack, or stories outside it, are rejected. One automatic repair round.
6. **Prompt versioning by content hash.** Any change to YAML or prompt files creates a new immutable `agent_configs` version; runs record the version used.
7. **Manual execution mode** (`TEMPO_MODE=manual`) writes exact prompts to files and reads responses back; recorded as provider `manual`. Used for the first edition because no API key was configured.
8. **Collection is a soft stage.** A collection failure does not block the edition; later stages use what was gathered and collection retries with backoff.
9. **Single-owner auth** with HMAC-signed cookie; cron endpoints use a bearer secret. Upgrade path: Auth.js if more users appear.
10. **UI blocked on approved design.** No invented design; an unstyled preview verifies content.
