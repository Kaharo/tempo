# Product

**Question TEMPO answers:** what matters to me, what has changed, and why?

**User:** one owner (technology/AI strategy professional, Astana). Russian reading language; English and Russian sources.

## Sections
| Section | Content | Data source | v0.1 state |
|---|---|---|---|
| Обзор дня | Lead article, supporting analysis, six N4U[42] perspectives, finance/projects/progress/AIMos summaries | editions | content ready; UI pending design |
| Аналитика | Long-form agent articles | articles | ready |
| Мир | Verified story clusters by topic | story_clusters + source_items | ready |
| Проекты | Status, decisions, blockers, next steps | projects, project_snapshots | schema ready; no data source connected |
| Прогресс | Comparisons over periods, computed from stored observations | progress_snapshots | schema ready; no observations yet |
| Идеи | Notes, emerging concepts, publication candidates | articles(section=ideas) | schema ready |
| Публикации | AIMos drafts, approvals, publications, performance | publication_drafts, approvals, distribution_jobs, analytics_observations | schema ready |
| Secondary (progressive disclosure) | Calendar, finance, archive, agent configuration, settings | — | API/schema ready |

## Principles
- Source-grounded or absent. No mock data in production views.
- Explicit preferences over behavioural profiling.
- Human approval before anything leaves TEMPO.
