# Deployment (Vercel + Neon Postgres + GitHub Actions)

1. **Repository:** push to GitHub (private).
2. **Database:** create a Neon project (free tier) → copy the pooled connection string as `DATABASE_URL`.
3. **Vercel:** import the repo. Env vars: `DATABASE_URL`, `SESSION_SECRET` (32+ random chars), `TEMPO_ADMIN_EMAIL`, `TEMPO_ADMIN_PASSWORD`, `CRON_SECRET`, `TEMPO_TIMEZONE=Asia/Almaty`, and model keys. Install command: `npm install --legacy-peer-deps`.
4. **Migrate:** `DATABASE_URL=… npm run db:migrate` (also runs on every scheduler tick).
5. **Scheduler:** GitHub repo → Settings → Secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `TEMPO_ADMIN_EMAIL`. The `tempo-tick` workflow starts automatically. Run it once manually with command `run` to verify.
6. **Backup clock:** `vercel.json` cron calls `/api/cron/tick` daily at 07:45 Almaty with `CRON_SECRET`.
7. **Verify:** `/api/status` shows a `collect` job with sources `ok`; next morning the homepage is `fresh`.

Data persists in Neon across redeploys. Agent prompts/config ship with the build (`outputFileTracingIncludes`).
