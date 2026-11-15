# Backlog

Legend: ✅ done · 🔄 in progress · ⏸ blocked · ⏳ next

| # | Task | Status | Depends on |
|---|---|---|---|
| 1 | Audit project and design references | ✅ (no screenshots found) | — |
| 2 | Architecture + ADRs | ✅ | — |
| 3 | Next.js app, Drizzle schema (26 tables), migrations | ✅ | — |
| 4 | Source registry (33 feeds), RSS/Atom/RDF adapter, robots, ETag | ✅ | — |
| 5 | Clustering (title + containment), verification, scoring, routing | ✅ | 4 |
| 6 | Provider abstraction: Anthropic, OpenAI, Gemini, compatible, manual | ✅ | — |
| 7 | Six agents, versioned configs, QA gate with repair round | ✅ | 6 |
| 8 | Assembly, publication, history, freshness | ✅ | 7 |
| 9 | Job runner, tick scheduler, retries, budget, logs | ✅ | 8 |
| 10 | Auth, API routes, cron endpoint, preview | ✅ | — |
| 11 | First real edition (2026-11-15, manual mode) | ✅ | 4–8 |
| 12 | Unit tests (15) + typecheck + production build | ✅ | — |
| 13 | **Implement approved design** (tokens, shell, homepage, sections) | ⏸ screenshots | design refs |
| 14 | First live API edition | ⏸ `ANTHROPIC_API_KEY` | 6, 7 |
| 15 | Live feed health check from production | ⏳ | deploy |
| 16 | Deploy: GitHub repo, Neon, Vercel, Actions secrets | ⏳ accounts | — |
| 17 | Settings UI: schedule, ranking weights, preferences, agent configs | ⏳ | 13 |
| 18 | Calendar (ICS) adapter | ⏳ | URL |
| 19 | Finance: choose market-data source; FX/index observations | ⏳ decision | — |
| 20 | Projects: manual snapshot entry + GitHub adapter | ⏳ | — |
| 21 | AIMos: draft generation from articles, approval flow, Telegram adapter | ⏳ | 13 |
| 22 | Integration tests against a test DB (tick across days, regeneration) | ⏳ | — |
