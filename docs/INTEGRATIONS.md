# Integrations

All integrations are rows in `integrations` with an explicit state: `connected`, `disconnected`, `error`, `export_only`. The UI shows the state; nothing is synthesised when disconnected.

| Integration | Category | Needs | State now | Notes |
|---|---|---|---|---|
| News sources (33 feeds) | sources | — | configured; live fetch untested from dev sandbox | Health per source recorded each run |
| Anthropic | model | `ANTHROPIC_API_KEY` | not set → manual mode | Default for all agents: `claude-sonnet-5-5` |
| OpenAI / Gemini / compatible | model | keys / base URL | not set | Switch per agent in `agent.yaml` |
| Google Calendar | calendar | `GOOGLE_CALENDAR_ICS_URL` (read-only) | disconnected | OAuth sync on roadmap |
| GitHub | projects | `GITHUB_TOKEN` | disconnected | Repo activity → `project_snapshots` |
| Manual projects | projects | — | connected | Owner-entered snapshots only |
| Market data | finance | provider decision | disconnected | Candidates: National Bank of Kazakhstan rates, a market data API |
| Telegram | publishing | bot token + channel | disconnected | Bot API posting to a channel where the bot is admin |
| LinkedIn | publishing | approved app + token | export_only | Personal-profile post analytics not available via API → manual entry |
| X | publishing | paid API tier | disconnected | Write access requires a paid tier |

**Before connecting any publishing channel:** approvals must exist (`approvals` row bound to draft version/channel/language/window). `distribution_jobs.idempotency_key` prevents double posting.

## External agents → TEMPO (summaries)
Agents that run outside TEMPO push short summaries through `GET|POST /api/ingest/briefing` with `INGEST_TOKEN`. Allowed sources and where they surface are in `config/briefings.yaml`.

| Source id | Agent | Shown on the overview |
|---|---|---|
| `aimos-digest` | Scheduled Claude task "AIMos — ежедневный обзор AI-новостей" | AIMos block, line "Подборка" |
| `morning-brief` | Scheduled Claude task "Morning brief" | line under the masthead |
| `investment` | Scheduled Claude task "Investment Research Assistant" | Finance block (until market data is connected) |

Parameters: `source`, optional `date` (YYYY-MM-DD, default today in Asia/Almaty), `headline`, and per item `n` (1–12), `title`, `text` (≤2000 chars), `url` (http/https only). Calls are idempotent per (source, date, n). All summaries: `/briefings`.

GET exists because scheduled Claude sessions can reach the app only through the Vercel connector's fetch tool. The token can only write summaries; it is stored in the prompts of those scheduled tasks. Rotate it by changing `INGEST_TOKEN` and the prompts.
