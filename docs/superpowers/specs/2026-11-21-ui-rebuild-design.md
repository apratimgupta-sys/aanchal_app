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

## Styling: Tailwind utilities only

Stated by the user on 21 November, and binding on every task from here:

**No hand-written CSS rules.** All styling is Tailwind utility classes in the markup. When this
plan is done, `src/client/styles.css`'s 689 lines and all 217 `ux4g-` class names are gone, along
with every `app-`, `ui-` and `visit-` class name the stylesheet defines.

Three things stay as CSS, because they cannot be utilities:

1. `src/client/styles/theme.css` — the token variable definitions. Tailwind's own theme resolves
   `hsl(var(--background))`, so the variables must exist as CSS custom properties. This is the
   contract Tailwind consumes, not component styling.
2. The `@tailwind base; @tailwind components; @tailwind utilities;` directives, which need a CSS
   entry file.
3. The Google Fonts `@import`.

That is about thirty lines of declarations and zero component rules. Anything beyond it — a
selector, a pseudo-class, a keyframe, a media query — is a finding, with one exception: a rule that
genuinely has no utility equivalent may live in `@layer base`, and only after the task's report
states what was tried and why it could not be expressed as a utility. Arbitrary values
(`w-[84px]`), arbitrary variants (`[&>tr]:border-b`) and group/peer variants are utilities and are
the right tool; reaching for a stylesheet because a utility is awkward is not.

**This changes when the stylesheet dies.** The original plan deleted it in a final task while every
earlier task left it serving the screens not yet migrated. It still shrinks screen by screen — each
screen's rebuild removes the rules only it used — but the file is now deleted the moment the last
screen stops importing anything from it, and no task may add a rule to it. A screen is not finished
while it still depends on a class name from that file.

## Anti-goals

- A fourth styling system. Today there are three half-present at once — UX4G class names, a
  configured-but-unused Tailwind setup, and the hand-written stylesheet. This ends with one.
- A separate mobile build.
- A big-bang switchover. Every step leaves a shippable app.

## The design

### Colour

**Correction to the first draft of this spec, made before implementation.** The portal already has
a working token layer and this spec originally proposed a second one. `src/client/styles/theme.css`
is imported at `main.tsx:8` and defines the full shadcn variable contract as HSL triplets;
`tailwind.config.ts` maps its entire theme onto those variables; and `styles.css` consumes them in
fourteen places plus six `bg-primary` utilities. So the work is to **re-value the existing
variables**, not to introduce `--bg`/`--surface`/`--line` beside them. Inventing a second set of
names would be the "fourth styling system" this spec's anti-goals forbid.

The practical consequence is that the palette change is one file, and it propagates to every screen
at once without touching any markup.

The design values below are authoritative as hex, taken from the approved mockups. They are stored
as space-separated HSL triplets, because that is the form `hsl(var(--token))` and Tailwind's theme
both require.

| Existing variable | Design value | Role |
|---|---|---|
| `--background` | `#F7F7F5` | page ground |
| `--card`, `--card-foreground` | `#FFFFFF`, `#15181C` | cards, table bodies, inputs |
| `--foreground` | `#15181C` | primary text |
| `--muted` | `#FAFAF8` | table headers, hover grounds |
| `--muted-foreground` | `#5A6270` | labels, secondary text, Hindi sub-labels |
| `--border` | `#E4E6EA` | card and table borders |
| `--input` | `#D7DAE0` | input and select borders |
| `--primary`, `--primary-foreground` | `#0B6257`, `#FFFFFF` | primary buttons, active state, links |
| `--ring` | `#0B6257` | focus ring |
| `--accent`, `--accent-foreground` | `#F2F8F6`, `#0B6257` | the settled pair |
| `--warning`, `--warning-foreground` | `#7A4A00`, `#FDF3DF` | the attention pair |
| `--destructive` | unchanged | errors |
| `--radius` | see below | cards 10px, controls 7px |

Row dividers inside a card (`#F0F1F3` in the mockups) and the accent hover (`#073F38`) have no
variable in the existing contract. Add them as new variables only if a component needs them;
otherwise derive them.

`--radius` is a single value from which Tailwind derives `md` and `sm`. Pick the value that gives
10px cards and lands controls nearest 7px, and record the arithmetic in the file.

Two status pairs, each differing in lightness as well as hue so they are distinguishable without
colour vision:

- **Settled** — fill `#F2F8F6`, border `#C8E2DB`, ink `#0B6257`
- **Attention** — fill `#FDF3DF`, border `#F0D79B`, ink `#7A4A00`

Status colours are reserved for state. They are never reused as decoration.

**Dark mode is out of scope and stays dead.** `theme.css` carries a `.dark` block and
`tailwind.config.ts` sets `darkMode: ["class"]`, but nothing in the product ever adds that class.
Leave the block as it is rather than re-valuing it: a half-designed dark theme that nobody can
reach is worse than an undesigned one, and an office monitoring portal is used in daylight.

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

- Inputs and selects: **44px minimum height**. The mockups drew 42px, but the accessibility gate requires a 44px touch target and the two must not disagree; 44 satisfies both., `10px 12px` padding, 7px radius, 1px
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
