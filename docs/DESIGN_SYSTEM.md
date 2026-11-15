# Design system

Source of truth: three approved screenshots (desktop 1600, tablet/fold 768, mobile 390), received 2026-11-15. Tokens and components live in `src/app/globals.css`; the shell in `src/components/Shell.tsx`.

## Tokens
| Token | Value | Use |
|---|---|---|
| `--ink` | #0a0a0a | text, strong rules, active nav, solid tags |
| `--ink-2` / `--ink-3` | #5c5c5c / #8a8a8a | secondary text / captions |
| `--rule` / `--rule-2` | #0a0a0a / #dcdcdc | section rules / row dividers |
| `--bar` | #c9c9c9 | inactive chart bars (last bar is ink) |
| Font | Onest Variable (self-hosted via `@fontsource-variable/onest`) | matched visually against the screenshots |
| `--nav-w` / `--rail-w` | 232px / 64px | expanded nav / icon rail |
| `--side-w` | 420px | right column (N4U[42], AIMos) |

## Type scale (desktop → tablet → mobile)
Wordmark 58/44/27 · weight 800 · tracking −0.045em. Lead headline 58/46/35 · 650 · line-height 1.04. Dek 20/20/18 · ink-2. Body 16 · line-height 1.72. Kicker 11.5 · uppercase · tracking 0.16em. Section title 18 (data) / 23 (right column). Stat 27 · 600.

## Layout
- **≥1200:** nav 232 (collapsible to rail, choice remembered) · content · right column 420 with a vertical rule that meets the masthead rule. Lead + three side stories; below them Finance · Projects · Progress in three ruled columns.
- **640–1199:** icon rail (expands as an overlay) · date line under the masthead · lead full width · side stories in a three-column row · then data (left) and N4U[42] + AIMos (right).
- **<640:** single column · menu button in the masthead opens a drawer · "Читать · N минут" row · side stories as arrow rows.

## Components
Nav item (active = solid ink) · kicker · lead · story · stat pair · sparkline · bars · project row with tag (`.tag.solid` = Блокер) · N4U view row (name | rule | sentence) · trio counters · line link · empty state (`.empty`) · inner page (`.page`, `.list`, `.tbl`).

## Deliberate differences from the mockups
- Mockup texts, numbers and weather were illustrative. The app shows real data or an explicit empty state; temperature is omitted because no weather source is connected.
- The footer line states edition date, version and generation mode instead of the mockup disclaimer.
- Lead paragraphs come from the real article and are longer than the mockup's.
- Icons: lucide (closest match to the mockup set).
