# TEMPO

Personal AI information environment. Collects news from authoritative sources, clusters and verifies stories, has six independent editorial agents (N4U[42]) write source-grounded perspectives and analysis, and publishes a daily edition on a schedule.

**Status (2026-11-15):** pipeline, data model, agents, scheduler and auth work end to end; the first real edition (2026-11-15) was produced in manual mode. The interface follows the approved screenshots (desktop, tablet, mobile).

## Quick start (local)
```bash
cp .env.example .env.local            # fill DATABASE_URL, SESSION_SECRET, TEMPO_ADMIN_PASSWORD, CRON_SECRET
npm install --legacy-peer-deps
npm run db:migrate
npm run tempo -- sync                 # registers sources and agents
npm run tempo -- run                  # full chain for today (needs ANTHROPIC_API_KEY, or TEMPO_MODE=manual)
npm run dev                           # http://localhost:3000 → login → today's edition
```

## How it works
`collect → process (dedupe · verify · score · route) → agents → assemble → publish`, each stage idempotent per date, with job history, retries and logs. See docs/AUTOMATION.md.

## Docs
PRODUCT · ARCHITECTURE · DESIGN_SYSTEM · EDITORIAL_SYSTEM · AUTOMATION · INTEGRATIONS · DEPLOYMENT · ROADMAP · BACKLOG — all in `docs/`.
