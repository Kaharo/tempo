# Editorial system — N4U[42]

Six independent editors. Each lives in `agents/<id>/` with `agent.yaml` (validated by `AgentConfig` in `src/lib/agents/config.ts`) and `system.md`; all share `agents/shared/editorial.md`, `writing.md` and the output contract `output.md`.

| Agent | Domain | Personality |
|---|---|---|
| ORBIX | Technology, AI, software, infrastructure | rigorous, curious, precise, independent |
| APEX | Geopolitics, power, regulation | strategic, measured, attentive to interests |
| MERIDIAN | Economics, markets, monetary policy | evidence-driven, sceptical of narratives |
| LEXICON | Science and methods | precise, careful about uncertainty |
| ARCHIVE | History, culture, philosophy | reflective, pattern-seeking |
| GAYA | Climate, energy, ecology | systems-oriented, long-horizon |

Each config sets: topics/keywords (routing), source preferences, provider/model/temperature/max tokens, output language and lengths, article threshold, research workflow, banned phrases, citation minimums, schedule.

## Run flow
1. **Pack:** top routed stories ranked by score + domain fit; up to 5 sources each, numbered `[n]` with publisher, tier, publication date, URL, excerpt, verification status and notes.
2. **Generate** via the configured provider (or manual mode).
3. **QA gate** (`validateOutput`): schema; every citation number exists in the pack; story IDs exist in the pack; citation minimums; length bounds; banned phrases. Errors → one repair round with the findings → else run fails. Warnings are stored.
4. **Persist:** perspective, optional article (paragraphs keep citation refs, renumbered densely), facts as `claims` with source IDs and corroboration status.

## Standards (enforced by prompt + gate)
Facts only from the pack · cite every factual sentence · ≤15-word quotes · event date ≠ publication date · facts vs interpretation separated · conflicts and single-sourcing disclosed · no hype vocabulary · Pyramid Principle / «Пиши, сокращай».

## Changing an agent
Edit its YAML or prompt → next run records a new config version. Switch model or provider per agent in `model:`; providers are defined in `config/models.yaml`.

## First edition (2026-11-15)
Produced in manual mode: sources retrieved with web tools (recorded as `retrieval_method = manual_webfetch`), each editor's output written against its exact generated prompt and passed through the same QA gate. Three articles came in slightly under the 450-word target (stored warnings).
