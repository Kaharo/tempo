# Automation

## Stages (default local times, Asia/Almaty; editable in DB setting `pipeline`)
| Time | Stage | Does | Idempotency |
|---|---|---|---|
| 06:00 | collect | fetch all enabled sources (robots.txt, ETag/Last-Modified, per-source min interval, 6 parallel) | items unique by canonical URL |
| 06:15 | process | cluster (title Jaccard + summary containment), verify, score, route | re-clusters window; updates in place |
| 06:30 | agents | runs every enabled agent; daily budget ceiling | one succeeded run per agent/date |
| 07:00 | assemble | lead, supporting, 6 perspectives, world, completeness | new version only with `--force` |
| 07:30 | publish | sets current edition; older version of same date → superseded | no-op if already current |

## Scheduler
`tick()` runs every 15 min (GitHub Actions). It computes the local date/time, then walks the stages in order: skips succeeded ones, runs due ones, respects retry backoff (30s/2m/10m, max 3 attempts), stops the chain at a failed hard stage. `collect` is soft. Concurrency guard: a stage already running <20 min is not started again.

## Observability
`job_runs` (stage, date, trigger, attempt, stats, error, cost) · `agent_runs` (tokens, cost, validation findings, raw output) · `system_logs` · `source_providers.last_status/last_error`. `GET /api/status` and `npm run tempo -- status`.

## Freshness states (UI)
fresh · incomplete (missing perspectives or lead) · delayed (today's publish time passed, showing yesterday) · previous (before publish time) · unavailable.

## Manual regeneration
`POST /api/regenerate {stage, date}` (owner session) or `npm run tempo -- run <date> --force`. History is kept: new edition versions, never overwrites.

## Manual mode (no API key)
`TEMPO_MODE=manual npm run tempo -- stage agents` writes `runs/manual/<date>-<agent>-<hash>.request.md`. Put the JSON answer at the matching `.response.json` and re-run. Recorded as provider `manual`; editions record `generation_mode = manual`.

## Cost
Tokens from provider usage × `config/models.yaml` prices → `agent_runs.cost_usd`. `TEMPO_DAILY_BUDGET_USD` stops further agents once reached. With Sonnet 5.5 at $2/$10 per MTok, a ~6k-in/2k-out run ≈ $0.03; six agents ≈ $0.20/day before repairs (estimate).
