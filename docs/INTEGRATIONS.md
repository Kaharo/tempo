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
