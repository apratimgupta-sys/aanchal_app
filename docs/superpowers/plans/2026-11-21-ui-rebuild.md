# UI rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current look with the approved design, one screen at a time, each step shippable, ending with a single styling system and no UX4G reference anywhere in the product.

**Architecture:** A token layer and a component set are built first, then screens move onto them one by one. Each screen's rewrite is self-contained: the old stylesheet keeps serving every screen not yet moved, so the app is releasable after every task. The old stylesheet is deleted last, when nothing references it.

**Tech Stack:** React 19 / Vite 8 / TypeScript strict / Tailwind 3.4 / Radix primitives / Vitest / Playwright. Frontend repo `CommissionerDashboard` only — the backend is not touched.

**Spec:** `docs/superpowers/specs/2026-11-21-ui-rebuild-design.md`

## Global Constraints

- **Nothing new is installed.** Every dependency is already in `package.json`: `tailwindcss ^3.4.17`, nine `@radix-ui/*` primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`, `@tanstack/react-table`. A task that needs a package not on that list is a plan defect — rule on it and record the ruling; do not add a dependency.
- **No behaviour change.** Props, state, queries, mutations, validation and error handling stay as they are. A rewritten screen must still satisfy every test that screen already has, unchanged. If an existing test fails after a rewrite, the rewrite is wrong — not the test.
- **Paired literals stay paired.** Every label is `t("English", "हिन्दी")`. No label is sized to the English string; Hindi runs 30–40% longer.
- **Tokens, never literals.** After Task 1, no component file contains a hex colour, a hardcoded font family, or a pixel radius. Spacing comes from the scale.
- **Vite base is `/anchal/`.** Any asset path added must respect it; use the existing `portal-path.ts` helper rather than writing a path.
- **Untouched files:** `src/domain/*`, `src/shared/*`, `src/client/api.ts`, `src/client/mutation.ts`, `src/client/portal-path.ts`, `src/client/lib/geolocation.ts`, and everything under `src/Anchal.*`.
- Suites that must stay green at every commit: `npx vitest run` (230 at start), `npx tsc --noEmit`, and `npx playwright test tests/browser/daily-form-live.spec.ts` after a reset (10).
- Each task ends with the app runnable and every screen styled — half-migrated screens do not ship.

## Review Focus

- **A screen at 390px.** Every rewritten screen is checked at phone width for horizontal page scroll. The page body must never scroll sideways; only a table, inside its own container, may.
- **Hindi at the narrowest width.** Switch to Hindi and check the same screen at 390px. The longer strings are where a fixed-width control breaks.
- **A number input with four digits.** The content-sized inputs must not clip or jump when a figure is longer than the sample values in the mockups.
- **Keyboard order through the daily entry.** Tab must still walk the 25 rows in order after the markup is rebuilt. A `div` where a `label` was silently breaks this.
- **Focus visibility on `accent` backgrounds.** A focus ring the same colour as the button it sits on is invisible.
- **A screen not yet migrated, on the same build as one that is.** Both must look finished. The old stylesheet is global; a token added to `:root` must not restyle a screen that has not been touched.
- **The guard test's blind spot.** It greps for `ux4g-`. A class name reached by string concatenation or a template literal passes the grep and still references the dead system.

---

### Task 1: The token layer

**Files:**
- Create: `src/client/styles/tokens.css`
- Modify: `tailwind.config.js` (map the tokens into the theme), `src/client/main.tsx` (import `tokens.css` before `styles.css`), `index.html` (the font link)
- Test: `tests/ui/tokens.test.ts` (create)

**Interfaces:**
- Produces: the CSS custom properties and the Tailwind theme keys every later task uses. Nothing else may define a colour.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";

const css = readFileSync("src/client/styles/tokens.css", "utf8");

test("every colour the design names is defined once, on :root", () => {
  for (const token of ["--bg", "--surface", "--sunken", "--fg", "--muted", "--line",
    "--control-line", "--row-line", "--accent", "--accent-hover",
    "--settled-fill", "--settled-line", "--settled-ink",
    "--attention-fill", "--attention-line", "--attention-ink"]) {
    expect(css).toContain(`${token}:`);
  }
});

test("the spacing and radius scale is defined", () => {
  expect(css).toMatch(/--radius-control:\s*7px/);
  expect(css).toMatch(/--radius-card:\s*10px/);
  expect(css).toMatch(/--control-height:\s*42px/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/tokens.test.ts`
Expected: FAIL — `tokens.css` does not exist.

- [ ] **Step 3: Write `tokens.css`**

Every value from the spec's colour table, verbatim. Both status pairs. The type scale as custom properties. `--control-height: 42px`, `--radius-control: 7px`, `--radius-card: 10px`. Define each token once, on `:root`.

- [ ] **Step 4: Map the tokens into Tailwind**

In `tailwind.config.js`, point `theme.extend.colors`, `borderRadius`, `fontFamily` and `fontSize` at the custom properties, so `bg-surface` and `text-muted` work and no component needs a literal. Confirm `content` covers `src/**/*.{ts,tsx}` — if it does not, the utilities will be purged and every later task will appear to produce unstyled markup.

- [ ] **Step 5: Load the fonts**

Add the Google Fonts link for IBM Plex Sans, IBM Plex Sans Devanagari and IBM Plex Mono to `index.html`, with a real fallback stack in the `fontFamily` config. Set explicit line heights; the Devanagari default clips matras.

- [ ] **Step 6: Import it first**

Import `tokens.css` in `src/client/main.tsx` **before** `styles.css`, so the existing stylesheet still wins wherever it sets a property. Nothing may look different after this task.

- [ ] **Step 7: Run the test and the suite**

Run: `npx vitest run tests/ui/tokens.test.ts && npx vitest run && npx tsc --noEmit`
Expected: PASS, 233 tests, `tsc` clean. No visual change on any screen.

- [ ] **Step 8: Commit**

`style: add design tokens and font loading`

---

### Task 2: The component set

**Files:**
- Create: `src/client/components/ui/button.tsx`, `input.tsx`, `label.tsx`, `field.tsx`, `select.tsx`, `card.tsx`, `table.tsx`, `badge.tsx`, `dialog.tsx`, `lib/cn.ts`
- Test: `tests/ui/components.test.tsx` (create)

**Interfaces:**
- Produces: the component API every screen task consumes. `Field` is the label-above-control pair with the 6px gap; `Input` takes a `width` of `"count" | "money" | "full"` so a figure is sized to its content rather than stretched.
- Consumes: the Tailwind theme keys from Task 1, and the already-installed Radix primitives. `components.json` already aliases `@/client/components/ui` — generate into that path, do not invent another.

- [ ] **Step 1: Write the failing test**

```tsx
test("a field renders a real label bound to its control", () => {
  render(<Field label="Received" htmlFor="recv"><Input id="recv" width="count" /></Field>);
  expect(screen.getByLabelText("Received")).toBeInTheDocument();
});

test("a count input is sized to its content, not stretched", () => {
  render(<Input id="x" width="count" />);
  expect(screen.getByRole("spinbutton")).toHaveClass("w-[84px]");
});

test("a button is a real button and keeps its accessible name", () => {
  render(<Button>Save entry</Button>);
  expect(screen.getByRole("button", { name: "Save entry" })).toBeInTheDocument();
});

test("a badge carries text, not colour alone", () => {
  render(<Badge tone="settled">Filed</Badge>);
  expect(screen.getByText("Filed")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/components.test.tsx`
Expected: FAIL — the modules do not exist.

- [ ] **Step 3: Build the components**

Use `class-variance-authority` for variants and `tailwind-merge` + `clsx` in `cn.ts`. Wrap Radix where Radix is already installed (select, dialog, label, tooltip); plain elements elsewhere. `Input` at `--control-height` with `10px 12px` padding. Every interactive element gets a visible focus ring that is not `accent` on `accent`. Minimum 44px touch target on anything tappable.

- [ ] **Step 4: Run the test and the suite**

Run: `npx vitest run tests/ui/components.test.tsx && npx vitest run && npx tsc --noEmit`
Expected: PASS, 237 tests, `tsc` clean. No screen imports these yet, so nothing changes visually.

- [ ] **Step 5: Commit**

`feat: add the UI component set`

---

### Task 3: The app shell

**Files:**
- Modify: `src/client/components/AppShell.tsx`
- Test: `tests/ui/app-shell.test.tsx` (extend if present, else create)

**Interfaces:**
- Consumes: `Button`, `Badge` from Task 2.
- Produces: the header, nav and page frame every screen renders inside. Screen tasks assume the shell supplies the page padding and the 390px behaviour of the header, and do not re-implement either.

- [ ] **Step 1: Write the failing test**

```tsx
test("the header names the role the session actually has", () => {
  renderShell({ role: "officer" });
  expect(screen.getByText(/Field Officer|क्षेत्र अधिकारी/)).toBeInTheDocument();
});

test("the header title is a paired literal, not hardcoded English", () => {
  const src = readFileSync("src/client/components/AppShell.tsx", "utf8");
  expect(src).not.toMatch(/"Commissioner Dashboard"/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/app-shell.test.tsx`
Expected: FAIL — line 105 picks between two hardcoded English labels and has no officer case, so an officer is shown "Commissioner Dashboard".

- [ ] **Step 3: Rebuild the shell**

Three roles, each a paired literal. Page frame supplies the spec's padding and the side gutter. Nav collapses at phone width without a separate mobile component.

- [ ] **Step 4: Run the test and the suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, 239 tests, `tsc` clean.

- [ ] **Step 5: Check it at both widths**

Run the dev server, open the shell at 390px and at 1440px, in English and in Hindi.
Expected: no horizontal page scroll at either width in either language.

- [ ] **Step 6: Commit**

`feat: rebuild the app shell on the new components`

---

### Task 4: Field visit, phone-first

**Files:**
- Modify: `src/client/pages/FieldVisit.tsx`
- Test: `tests/ui/field-visit.test.tsx` (extend)

**Interfaces:**
- Consumes: the component set and the shell. The ward picker is the same 53-option select the go-live plan introduces — if that plan has landed, reuse its component rather than building a second one; if it has not, build the picker here and note it so the other plan reuses this one.
- Produces: nothing other tasks depend on.

This screen goes first among the screens because field officers are on phones, the screen is the smallest of the three designed, and it is the one whose current layout serves its users worst.

- [ ] **Step 1: Write the failing test**

```tsx
test("the ward picker offers 53 wards and no free text", () => {
  renderFieldVisit();
  expect(screen.getByRole("combobox", { name: /Ward/ })).toBeInTheDocument();
  expect(screen.queryByRole("textbox", { name: /Ward/ })).not.toBeInTheDocument();
});

test("coordinates render a map link", () => {
  renderFieldVisit({ latitude: 23.3441, longitude: 85.3096 });
  const link = screen.getByRole("link", { name: /map/i });
  expect(link).toHaveAttribute("href", "https://maps.google.com/?q=23.3441,85.3096");
  expect(link).toHaveAttribute("target", "_blank");
});

test("the photograph control states that it is switched off", () => {
  renderFieldVisit();
  expect(screen.getByText(/not being collected|संग्रहित नहीं/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/field-visit.test.tsx`
Expected: FAIL on the assertions whose markup does not exist yet. Record which ones already pass — those are behaviour this task must not break.

- [ ] **Step 3: Rebuild the screen**

Phone-first, widening at desktop. Every tap target at least 44px. Submit reachable without scrolling past the fields on a 390×844 screen.

- [ ] **Step 4: Run the test and the suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, 242 tests, `tsc` clean.

- [ ] **Step 5: Check it on a phone viewport and a desktop one**

Playwright at 390×844 and at 1440×900, English and Hindi.
Expected: no horizontal page scroll, nothing clipped, the submit button reachable at phone width.

- [ ] **Step 6: Commit**

`feat: rebuild the field visit screen`

---

### Task 5: The commissioner dashboard

**Files:**
- Modify: `src/client/pages/Dashboard.tsx`
- Test: `tests/ui/dashboard.test.tsx` (extend)

**Interfaces:**
- Consumes: the component set, the shell. `@tanstack/react-table` is installed and unused — use it for the two tables rather than hand-rolling sort and layout.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing test**

```tsx
test("who has filed today is the first thing on the page", () => {
  renderDashboard(fixture);
  const headings = screen.getAllByRole("heading", { level: 2 });
  expect(headings[0]).toHaveTextContent(/Filed today|आज दर्ज/);
});

test("a figure with no reading time does not render an invalid date", () => {
  renderDashboard({ ...fixture, updatedAt: null });
  expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
});

test("each wide table scrolls inside its own container", () => {
  renderDashboard(fixture);
  for (const table of screen.getAllByRole("table")) {
    expect(table.closest("[data-scroll-x]")).not.toBeNull();
  }
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/dashboard.test.tsx`
Expected: FAIL — filing status is not first, and the tables are not in scroll containers.

- [ ] **Step 3: Rebuild the screen**

Filing status first, then the four figures, then the per-Anchal table, then the register. Figures in IBM Plex Mono with `tabular-nums`. Render `updatedAt` as "figures as of…", guarding the null.

- [ ] **Step 4: Decide the phone behaviour for the wide tables and implement it**

The requirement is readable without horizontal dragging; the method is open. Whatever is chosen, every column still reachable, and the choice recorded in the commit message.

- [ ] **Step 5: Run the test and the suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, 245 tests, `tsc` clean.

- [ ] **Step 6: Check it at 390px and 1440px, both languages**

- [ ] **Step 7: Commit**

`feat: rebuild the commissioner dashboard`

---

### Task 6: The daily entry screen

**Files:**
- Modify: `src/client/pages/DailyEntry.tsx`
- Test: `tests/ui/daily-entry*.test.tsx` (all existing files must pass unchanged)

**Interfaces:**
- Consumes: the component set, the shell, `collects`/`shownKeys` and the shape predicates in `src/domain/service-kind.ts` — unchanged.
- Produces: nothing other tasks depend on.

This is the highest-risk task in the plan and it is deliberately last among the three designed screens. The file is 851 lines and holds the product's only multi-step state machine: dirty tracking, the correction path, per-shape field visibility, the discard prompt. **Layout and markup only.** Every one of its existing tests must pass without being edited; a test that needs editing means behaviour moved, which this task forbids.

- [ ] **Step 1: Record the behaviour before touching it**

Run: `npx vitest run tests/ui/ --reporter=verbose > /tmp/daily-entry-before.txt`
Expected: the current pass list, saved. This file is the contract for Step 5.

- [ ] **Step 2: Write the failing test**

```tsx
test("each row shows only the fields its shape collects", () => {
  renderDailyEntry();
  const revenue = row(2);   // revenue shape
  expect(within(revenue).getByRole("textbox", { name: /Amount|राशि/ })).toBeInTheDocument();
  expect(within(revenue).queryByRole("spinbutton", { name: /Received|प्राप्त/ })).not.toBeInTheDocument();
});

test("tab order walks the rows in order", async () => {
  renderDailyEntry();
  const first = within(row(1)).getAllByRole("spinbutton")[0];
  first.focus();
  await user.tab();
  expect(within(row(1)).getAllByRole("spinbutton")[1]).toHaveFocus();
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run tests/ui/daily-entry-shapes.test.tsx`
Expected: FAIL on the queries whose markup is not yet in place.

- [ ] **Step 4: Rebuild the layout**

Three groups: counter work, collections, field work. Each row shows only its shape's fields. Counts at 84px, money at 118px. The pending readout aligned on the control baseline, not by tuned padding. At phone width a row becomes a stacked block; the 25 rows stay one pass, not a wizard.

- [ ] **Step 5: Prove nothing moved**

Run: `npx vitest run tests/ui/ --reporter=verbose > /tmp/daily-entry-after.txt && diff /tmp/daily-entry-before.txt /tmp/daily-entry-after.txt`
Expected: additions only. A test that passed before and fails now is a regression in this task, not a stale test.

- [ ] **Step 6: Run the whole suite and the live gate**

Run: `npx vitest run && npx tsc --noEmit && npx playwright test tests/browser/daily-form-live.spec.ts`
Expected: PASS, 247 tests, `tsc` clean, live gate 10/10.

- [ ] **Step 7: Check it at 390px and 1440px, both languages, with a four-digit figure in a count field**

- [ ] **Step 8: Commit**

`feat: rebuild the daily entry screen`

---

### Task 7: The six undesigned screens

**Files:**
- Modify: `src/client/pages/Login.tsx`, `ChangePassword.tsx`, `InitialBalances.tsx`, `MyVisits.tsx`, `VisitRegister.tsx`, `Officers.tsx`
- Test: the existing test file for each; extend where a screen has none

**Interfaces:**
- Consumes: the component set, the shell, and the table treatment settled in Task 5.
- Produces: nothing.

No mockups exist for these and none are needed: they are forms and tables, and the system now answers every question they raise. One commit per screen so a regression is bisectable.

- [ ] **Step 1: For each screen, in this order — login, change password, opening balances, my visits, visit register, officer administration**

- [ ] **Step 2: Rewrite it on the component set, keeping its existing tests passing unedited**

- [ ] **Step 3: After each screen, run `npx vitest run && npx tsc --noEmit`**

Expected: PASS, `tsc` clean.

- [ ] **Step 4: Check each at 390px and 1440px, both languages**

- [ ] **Step 5: Commit each separately**

`feat: rebuild <screen> on the new components`

---

### Task 8: Delete the old system

**Files:**
- Delete: `src/client/styles.css`
- Modify: `src/client/main.tsx` (drop the import)
- Test: `tests/ui/no-dead-styling.test.ts` (create)

**Interfaces:**
- Consumes: the completed state of Tasks 3–7.
- Produces: the guard that keeps the dead system from coming back.

- [ ] **Step 1: Write the failing test**

```ts
import { execSync } from "node:child_process";

test("no source file references the abandoned styling system", () => {
  const hits = execSync('grep -rn "ux4g" src/ || true', { encoding: "utf8" }).trim();
  expect(hits).toBe("");
});

test("the old stylesheet is gone", () => {
  expect(existsSync("src/client/styles.css")).toBe(false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/no-dead-styling.test.ts`
Expected: FAIL, listing whatever `ux4g-` references remain — 217 at the start of this plan.

- [ ] **Step 3: Remove every remaining reference, then delete the stylesheet**

The grep is the checklist. A class name built by concatenation or in a template literal will not appear in it — read each file the grep names and check its neighbours for a constructed name.

- [ ] **Step 4: Run everything**

Run: `npx vitest run && npx tsc --noEmit && npx playwright test tests/browser/daily-form-live.spec.ts`
Expected: PASS, 249 tests, `tsc` clean, live gate 10/10.

- [ ] **Step 5: Walk all nine screens at 390px and 1440px, English and Hindi**

Expected: every screen styled, no horizontal page scroll, nothing unstyled. This is the last chance to catch a rule the deleted stylesheet was silently supplying.

- [ ] **Step 6: Commit**

`chore: remove the abandoned styling system`
