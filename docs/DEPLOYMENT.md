# Deployment (Vercel + Postgres)

Production runs on Vercel from the private GitHub repository `Kaharo/tempo`; every push to `main` deploys.

## What happens on each build
`npm run build:vercel` → `scripts/bootstrap.ts` → `next build`. Bootstrap applies migrations, loads `data/seed/*.sql` into an empty database (first edition), then syncs sources and agents. Without `DATABASE_URL` it skips and the app shows a "data unavailable" state.

## Environment variables (Vercel → Project → Settings → Environment Variables)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` (or `POSTGRES_URL`) | Postgres. Added automatically by the Neon integration (Vercel → Storage). |
| `SESSION_SECRET`, `TEMPO_ADMIN_EMAIL`, `TEMPO_ADMIN_PASSWORD` | Owner login |
| `CRON_SECRET` | Vercel Cron sends it as a bearer token to `/api/cron/tick` |
| `INGEST_TOKEN` | Write-only token for external agents (`/api/ingest/briefing`) |
| `ANTHROPIC_API_KEY` (optional: `OPENAI_API_KEY`, `GEMINI_API_KEY`) | Editors. Without a key the edition is assembled from verified stories only. |
| `TEMPO_TIMEZONE`, `TEMPO_DAILY_BUDGET_USD` | Defaults: Asia/Almaty, 3 |

## Clock
`vercel.json` defines seven daily cron calls of `/api/cron/tick` between 06:05 and 10:00 Almaty. The Hobby plan runs each within its hour, not to the minute; the tick is idempotent and runs every stage that is due, so the edition is normally out between 07:30 and 08:30. For a to-the-minute clock, enable the schedule in `.github/workflows/tempo-tick.yml` and add repository secrets.

## Changing the password or a secret
Edit the variable in Vercel and redeploy.
