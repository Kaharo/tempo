# Design system

**Status: blocked — approved screenshots not yet provided.** The project brief requires the screenshots to be the visual source of truth and forbids inventing a replacement design.

## Known requirements (from the brief, to be confirmed against screenshots)
- Black-and-white identity, generous whitespace, Swiss-inspired typography and grid.
- Centred TEMPO wordmark.
- Collapsible left navigation: Обзор дня · Аналитика · Мир · Проекты · Прогресс · Идеи · Публикации. Calendar, finance, archive, agent config and settings by progressive disclosure.
- Large central reading column; right column for N4U[42] and AIMos.
- Compact finance, project and progress visualisations. Minimal imagery. No duplicated headings or navigation.

## To extract once screenshots arrive
Grid (columns, gutters, max widths per breakpoint) · type scale (families, sizes, weights, line heights) · spacing scale · rules/dividers · navigation states (collapsed/expanded) · chart styles · freshness/unavailable states · responsive behaviour.

## Implementation plan
Tokens as CSS variables + Tailwind theme → layout shell → homepage → section pages. Data is already available from `getEdition()` (`src/lib/edition/read.ts`).
