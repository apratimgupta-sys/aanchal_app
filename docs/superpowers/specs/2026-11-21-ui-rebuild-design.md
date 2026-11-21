# UI rebuild — design

**Date:** 21 November 2026
**Source:** the approved mockups ("Anchal Portal Redesign" canvas — commissioner dashboard,
daily entry, field visit). This document is the authority; the canvas is the picture of it.

## Intent

Replace the current look. The markup references UX4G by class name throughout and nothing
loads it, so the visible design is one 689-line stylesheet filling the gaps. The direction is
modern and functional rather than government-standard styling, and UX4G is deliberately left
behind.

## Goals

- One look across all nine screens, from one set of components.
- Hindi and English are the same product, not a translation layer.
- Fast to fill. A clerk works through 25 entries every morning; keyboard flow beats decoration.
- Every screen works from phone width to desktop, built once.

## Non-goals

- No behaviour change. Business rules, API contracts, validation and bilingual logic are untouched.
- No new dependencies. The toolkit is already installed.
- No redesign of the entry *flow* in this work. Layout and styling only; the flow rethink waits
  for observed usage.

## Anti-goals

- A fourth styling system. Today there are three half-present at once — UX4G class names, a
  configured-but-unused Tailwind setup, and the hand-written stylesheet. This ends with one.
- A separate mobile build.
- A big-bang switchover. Every step leaves a shippable app.

## The design

### Colour

| Token | Value | Used for |
|---|---|---|
| `bg` | `#F7F7F5` | page ground |
| `surface` | `#FFFFFF` | cards, table bodies, inputs |
| `sunken` | `#FAFAF8` | table headers |
| `fg` | `#15181C` | primary text |
| `muted` | `#5A6270` | labels, secondary text, Hindi sub-labels |
| `line` | `#E4E6EA` | card and table borders |
| `control-line` | `#D7DAE0` | input and select borders |
| `row-line` | `#F0F1F3` | row dividers inside a card |
| `accent` | `#0B6257` | primary buttons, active state, links |
| `accent-hover` | `#073F38` | link hover |

Two status pairs, each differing in lightness as well as hue so they are distinguishable
without colour vision:

- **Settled** — fill `#F2F8F6`, border `#C8E2DB`, ink `#0B6257`
- **Attention** — fill `#FDF3DF`, border `#F0D79B`, ink `#7A4A00`

Status colours are reserved for state. They are never reused as decoration.

### Type

- **IBM Plex Sans** with **IBM Plex Sans Devanagari** — one family across both scripts, so
  Hindi and English share a voice. Loaded from Google Fonts with a real fallback stack.
- **IBM Plex Mono** for every figure, with `font-variant-numeric: tabular-nums` so columns of
  numbers align.
- Scale: page title 23px/600; section heading 15px/600; body 13.5px; field label 11px/500 in
  `muted`; Hindi sub-label 12px in `muted`; table header 11px uppercase, `0.05em` tracking.
- Devanagari needs more line-height than Latin. Line heights are set explicitly; the default
  scale clips matras.

### Controls

- Inputs and selects: **42px minimum height**, `10px 12px` padding, 7px radius, 1px
  `control-line` border.
- Label sits above its control with a **6px** gap. Never a placeholder in place of a label.
- Number inputs are **sized to their content** — 84px for a count, 118px for money — not
  stretched to the container. A two-digit count in a full-width box reads as a mistake.
- A readout that sits beside inputs (the pending figure) is a 42px-high box aligned on the same
  baseline, never padding tuned to look aligned.
- Buttons: 7px radius, `accent` fill for the primary action, 40–44px high.
- Touch targets are at least 44px on anything a field officer taps.

### Layout

- Cards: `surface` on `bg`, 1px `line`, 10px radius.
- Page: header `14px 32px`; main `26px 32px 40px`; 24px between sections.
- Rows inside a card: `16px 20px` padding, 20px gutters, divided by `row-line`.
- Group siblings with flex or grid and `gap`. No per-element margins.
- Wide tables scroll inside their own container; the page body never scrolls sideways.

### Responsive

- One build per screen, adapting. No separate mobile version, no device detection.
- Phone width is 390px. Every screen must work there.
- The two places this bites, both solved when that screen is built rather than retrofitted:
  the dashboard's wide tables, and the daily entry's 25 rows.
- Field officers are on phones; the field visit screen is designed phone-first and widens.

### Bilingual

- Every label is a paired literal. Hindi runs 30–40% longer than English, so nothing is sized
  to the English string.
- Service rows show English with the Hindi name beneath it in `muted`.
- Nine of the 25 services currently hold English text in their Hindi name, and 24 server
  messages have no Hindi at all. Both are content gaps, filled during this work, not after.

## Screens

Three are designed in the mockups:

- **Commissioner dashboard** — who has filed today as the first thing on the page; four
  figures; the per-Anchal table; the register below it.
- **Daily entry** — all 25 services in one pass, grouped as counter work, collections and
  field work, each row showing only the fields its shape collects.
- **Field visit** — phone-first, ward picker, coordinates with a map link, photographs shown
  as deliberately switched off.

Six are not designed and are built by extension once the component set exists: login, change
password, opening balances, my visits, visit register, officer administration. They are
ordinary forms and tables; inventing mockups for them would decide nothing a builder cannot.

## Constraints

- Every dependency needed is already in `package.json` — Tailwind configured, nine Radix
  primitives, the styling helpers, the icon set, the toast library, a table library. **Nothing
  new is installed.** `components.json` already points at the right paths.
- `src/domain`, `src/shared`, `api.ts`, `mutation.ts`, `portal-path.ts` and `lib/geolocation.ts`
  are not touched. The backend is not touched.
- Accessibility holds as the markup is rewritten: real `<button>`, `<a href>`, `<label>`;
  visible focus; `aria-label` on icon-only controls; 4.5:1 text contrast in both scripts.
- The suite stays green throughout: 230 frontend tests, `tsc` clean, the live Playwright gate.

## Left to the builder

- Which Radix primitives each component wraps, and how the generated components are composed.
- How the dashboard's wide tables behave at phone width — the requirement is "readable without
  horizontal dragging", the method is open.
- The six undesigned screens' layouts, within the system above.
