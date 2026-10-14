# Shadcn Government UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the UX4G visual system with a responsive Shadcn-style government UI while preserving all existing application behavior, API contracts, business rules, bilingual flows, and navy/grey/white palette.

**Architecture:** Add a Tailwind/Shadcn foundation with locally owned primitives under `src/client/components/ui`, application compositions under `src/client/components`, and CSS variables preserving the current palette. Migrate the shared shell and each route in layers; keep API/session/domain logic outside presentational components and update browser/accessibility tests alongside each layer.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Radix UI primitives, `class-variance-authority`, `clsx`, Lucide React, Playwright, axe-core, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-shadcn-government-ui-design.md`

## Global Constraints

- Preserve the existing deep navy, light blue-grey, neutral grey, white/elevated surfaces, and semantic status colors.
- Do not change backend rules, API contracts, database schema, authentication model, or domain behavior.
- Do not retain UX4G token names or `ux4g-*` classes as the application styling contract.
- Maintain English/Hindi support and test long Hindi labels at narrow widths.
- Use minimum 44px touch targets for primary interactions.
- Every form control must support labels, descriptions, required state, invalid state, error association, disabled state, and stable IDs.
- Prevent duplicate submissions and preserve editable values after request failures.
- Keep dense tables horizontally scrollable within their own regions, never at page level.

## Review Focus

- **Long Hindi labels and error messages:** text wraps without clipping, overlapping, or pushing controls off-screen. Test in the responsive shell and representative forms in Task 2 and Task 3.
- **Slow or repeated form submission:** the active submit action shows busy state and duplicate mutations are prevented. Test in Task 3 and Task 4.
- **Mobile navigation with unsaved data:** opening/closing the drawer and selecting a route respects the unsaved-change guard. Test in Task 2 and Task 4.
- **Network/API failure after form entry:** entered values remain editable and a retryable page/form error is shown. Test in Task 3 and Task 4.
- **Empty and wide report data:** filters remain usable, empty results explain next steps, and tables scroll only inside their container. Test in Task 5.

### Task 1: Add the Shadcn foundation and theme tokens

**Files:**
- Modify: `package.json`, `package-lock.json`, `vite.config.ts`, `src/client/main.tsx`
- Create: `tailwind.config.ts`, `postcss.config.js`, `components.json`, `src/client/lib/utils.ts`, `src/client/styles/theme.css`
- Modify: `src/client/styles.css` or replace it with the new global stylesheet
- Test: `tests/browser/design.spec.ts`

**Interfaces:**
- Produces `cn(...inputs: ClassValue[]): string` from `src/client/lib/utils.ts`.
- Produces CSS variables for background, foreground, primary, primary-foreground, muted, muted-foreground, border, input, ring, destructive, success, warning, and info.

- [ ] **Step 1: Add the foundation dependencies and configuration**

Add Tailwind, PostCSS, Radix packages needed by the planned primitives, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, and the Shadcn configuration. Keep versions compatible with React 19 and the existing Vite toolchain.

- [ ] **Step 2: Create `cn()` and map the existing palette to CSS variables**

Define the light theme as the default and retain an explicit dark-mode token layer only if existing tests or user preference require it; do not introduce a dark-mode UI during this migration. Remove UX4G variable dependencies from the new application contract.

- [ ] **Step 3: Replace UX4G imports from the application entry point**

Remove `ux4g-web-components/styles.css` and `ux4g-web-components/design-system` imports from `src/client/main.tsx`; load the new Tailwind/global stylesheet instead.

- [ ] **Step 4: Update design tests to assert the new contract**

Replace UX4G selectors with stable role/label/test selectors. Assert the palette, visible focus state, minimum control usability, and no page-level horizontal overflow at desktop and mobile widths.

- [ ] **Step 5: Run foundation verification**

Run `npm run typecheck`, `npm run build`, and `npx playwright test tests/browser/design.spec.ts`. Expected: all pass without UX4G stylesheet/runtime imports.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts tailwind.config.ts postcss.config.js components.json src/client/main.tsx src/client/lib/utils.ts src/client/styles.css src/client/styles/theme.css tests/browser/design.spec.ts
git commit -m "feat: add shadcn government ui foundation"
```

### Task 2: Build the shared Shadcn primitives and responsive application shell

**Files:**
- Create: `src/client/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `label.tsx`, `card.tsx`, `alert.tsx`, `badge.tsx`, `skeleton.tsx`, `progress.tsx`, `separator.tsx`, `sheet.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `table.tsx`
- Create: `src/client/components/Field.tsx`, `PageHeader.tsx`, `StatusNotice.tsx`, `EmptyState.tsx`, `LoadingState.tsx`, `AppShell.tsx`, `Sidebar.tsx`, `MobileNav.tsx`
- Modify: `src/client/App.tsx`, `src/client/ui.tsx`, `src/client/styles.css`
- Test: `tests/browser/design.spec.ts`, new component tests under `tests/client/`

**Interfaces:**
- `Field` accepts `label`, `description`, `error`, `required`, `children`, and stable `id`/association props.
- `StatusNotice` accepts `kind: "success" | "error" | "warning" | "info"`, message content, and optional retry action.
- `AppShell` accepts role-aware navigation items, active pathname, `onNavigate`, `onLanguageToggle`, and `onSignOut`.

- [ ] **Step 1: Write failing component tests**

Cover `Field` error association and `aria-invalid`, button loading/disabled behavior, sheet keyboard close, active navigation, and long Hindi text wrapping.

- [ ] **Step 2: Implement primitives with Radix where interaction requires it**

Use forwarded refs, native form behavior, `data-*` state attributes, and `cn()`. Keep primitive APIs small and consistent with the specification.

- [ ] **Step 3: Implement the desktop sidebar and mobile Sheet drawer**

Use role-aware office/commissioner routes, active text/icon state, language switcher, account identity, sign-out, and a labeled mobile menu button. Route selection closes the drawer only after navigation is accepted.

- [ ] **Step 4: Migrate `App.tsx` to `AppShell`**

Preserve existing route guards, setup redirect behavior, language persistence, session refresh, unsaved-change behavior, and footer content. Replace browser-only confirmation with `AlertDialog` where compatible with the current navigation flow.

- [ ] **Step 5: Run shell tests at 1440px, 1024px, 768px, and 390px**

Expected: no page-level horizontal overflow, reachable navigation by keyboard, drawer closes on route selection, and long bilingual labels remain readable.

- [ ] **Step 6: Commit**

```bash
git add src/client/components src/client/App.tsx src/client/ui.tsx src/client/styles.css tests/client tests/browser/design.spec.ts
git commit -m "feat: add responsive government application shell"
```

### Task 3: Migrate login, setup, and shared form handling

**Files:**
- Modify: `src/client/pages/Login.tsx`, `src/client/pages/InitialBalances.tsx`, `src/client/ui.tsx`
- Create: `src/client/components/FormErrorSummary.tsx`, `src/client/lib/form-errors.ts`
- Test: new tests under `tests/client/forms/`, `tests/browser/portal.spec.ts`

**Interfaces:**
- `normalizeApiErrors(error: unknown): { form?: string; fields: Record<string, string> }` maps known API validation responses to field names and falls back to a safe form message.
- `FormErrorSummary` accepts `errors`, exposes an accessible heading, and focuses only after an actionable submit failure.

- [ ] **Step 1: Write failing tests for field and form errors**

Assert required-field errors, numeric constraints, associated error IDs, preserved values after failures, safe generic network errors, loading submit state, and duplicate-click protection.

- [ ] **Step 2: Implement API error normalization and error summary**

Keep API/domain logic unchanged; normalize at the presentation boundary and avoid exposing raw server errors to users.

- [ ] **Step 3: Migrate login and setup forms**

Use the new `Field`, `Input`, `Button`, `Card`, `Alert`, and `Progress` components. Preserve bilingual copy, setup progress for 25 services, explicit zero confirmation, and current API calls.

- [ ] **Step 4: Add loading, retry, and success states**

Disable only the active submit action, keep values after failure, and show success feedback before required navigation/reset behavior.

- [ ] **Step 5: Run targeted verification**

Run `npm run typecheck`, `npx playwright test tests/browser/portal.spec.ts`, and the new client form tests. Expected: login/setup workflows pass at desktop and mobile widths.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/Login.tsx src/client/pages/InitialBalances.tsx src/client/ui.tsx src/client/components/FormErrorSummary.tsx src/client/lib/form-errors.ts tests/client/forms tests/browser/portal.spec.ts
git commit -m "feat: migrate login and setup forms"
```

### Task 4: Migrate daily and backdated entry workflows

**Files:**
- Modify: `src/client/pages/DailyEntry.tsx`, `src/client/App.tsx`
- Create: `src/client/components/EntryServiceList.tsx`, `EntryForm.tsx`, `BalanceSummary.tsx`, `UnsavedChangesDialog.tsx`
- Test: `tests/client/forms/entry-form.test.tsx`, `tests/browser/portal.spec.ts`, `tests/browser/history.spec.ts`

**Interfaces:**
- `EntryForm` receives the selected service, date mode, initial values, server errors, `onSubmit`, `onReset`, and `isSubmitting`.
- `EntryServiceList` receives services, selected ID, completion state, and `onSelect`.

- [ ] **Step 1: Write failing tests for entry validation and mutation edge cases**

Cover negative/non-integer values, completion exceeding received, within-SLA exceeding completed, required ward fields, delayed-reporting reason, correction reason, stale versions, repeated clicks, and failure with draft preservation.

- [ ] **Step 2: Extract presentational entry components without changing domain calculations**

Keep balance derivation, date rules, API calls, and mutation payloads in existing logic; make the new components controlled and explicit about submission state.

- [ ] **Step 3: Implement the responsive service list and entry form**

On desktop use the planned two-pane layout; on mobile stack the service list and form, keep the selected service/date context visible, and contain any overflow inside local regions.

- [ ] **Step 4: Implement accessible unsaved-change confirmation**

Preserve current route/day draft behavior and use `AlertDialog` for route changes, reset, and sign-out where a dirty office entry exists.

- [ ] **Step 5: Run targeted and mutation verification**

Run `npm run typecheck`, relevant domain mutation tests, `npx playwright test tests/browser/portal.spec.ts tests/browser/history.spec.ts`, and the new entry component tests.

- [ ] **Step 6: Commit**

```bash
git add src/client/pages/DailyEntry.tsx src/client/App.tsx src/client/components/EntryServiceList.tsx src/client/components/EntryForm.tsx src/client/components/BalanceSummary.tsx src/client/components/UnsavedChangesDialog.tsx tests/client/forms/entry-form.test.tsx tests/browser/portal.spec.ts tests/browser/history.spec.ts
git commit -m "feat: migrate office entry workflows"
```

### Task 5: Migrate commissioner dashboard, history, filters, and data states

**Files:**
- Modify: `src/client/pages/Dashboard.tsx`, `src/client/pages/ChangeHistory.tsx`
- Create: `src/client/components/MetricCard.tsx`, `FilterBar.tsx`, `DataTableFrame.tsx`, `ReportDetails.tsx`
- Test: `tests/client/reports/`, `tests/browser/design.spec.ts`, `tests/browser/history.spec.ts`

**Interfaces:**
- `DataTableFrame` accepts loading, empty, error, retry, and table content slots.
- `FilterBar` exposes controlled filter values and `onChange`/`onReset` without removing controls during loading.

- [ ] **Step 1: Write failing tests for report states and responsive tables**

Assert skeleton/loading state, empty results with guidance, retryable errors, filter persistence, contained table scrolling, and readable priority columns at mobile widths.

- [ ] **Step 2: Implement report compositions and metric cards**

Preserve existing API queries, totals, date semantics, office/service filters, detail expansion, and currency formatting.

- [ ] **Step 3: Migrate dashboard and history pages**

Use clear headings, restrained badges, table containers, mobile summaries where needed, and explicit stale-data/request-error status.

- [ ] **Step 4: Run report verification**

Run targeted browser/client tests at 1440px, 1024px, 768px, and 390px. Expected: filters remain usable and the document itself never becomes wider than the viewport.

- [ ] **Step 5: Commit**

```bash
git add src/client/pages/Dashboard.tsx src/client/pages/ChangeHistory.tsx src/client/components/MetricCard.tsx src/client/components/FilterBar.tsx src/client/components/DataTableFrame.tsx src/client/components/ReportDetails.tsx tests/client/reports tests/browser/design.spec.ts tests/browser/history.spec.ts
git commit -m "feat: migrate commissioner reports"
```

### Task 6: Remove UX4G coupling and complete accessibility/responsive coverage

**Files:**
- Modify: all remaining `src/client/**/*.tsx`, `src/client/styles.css`, `package.json`, `package-lock.json`, `tests/browser/*.spec.ts`
- Delete: UX4G-only adapters/assets after the final search confirms no consumers
- Test: all existing unit, worker, browser, accessibility, and mutation tests

- [ ] **Step 1: Search for remaining UX4G coupling**

Run `rg -n "ux4g|ux4g-web-components" src package.json package-lock.json tests`. Expected: no production imports, token names, or selectors remain; test-only migration notes are acceptable only if they do not assert UX4G behavior.

- [ ] **Step 2: Add keyboard and axe coverage**

Check sidebar/drawer, dialogs, forms, error summary focus, tables, and language controls using keyboard navigation and axe-core.

- [ ] **Step 3: Run the complete verification suite**

Run `npm run typecheck`, `npm run test`, `npm run test:worker`, `npm run build`, and `npm run test:browser`. Expected: all commands pass.

- [ ] **Step 4: Run mutation/audit regression coverage**

Exercise invalid inputs, missing reasons, out-of-range dates, stale edits, rapid repeated submits, failed requests, session expiry, office/commissioner isolation, empty reports, and mobile navigation with dirty forms.

- [ ] **Step 5: Commit cleanup and verification**

```bash
git add src package.json package-lock.json tests
git commit -m "test: complete shadcn ui accessibility and regression coverage"
```

### Task 7: Final review and release evidence

**Files:**
- Create: `docs/shadcn-ui-migration-verification.md`
- Test artifacts: Playwright screenshots/traces and accessibility output in ignored test-result directories

- [ ] **Step 1: Capture responsive evidence**

Record screenshots or traces for login, setup, daily entry, dashboard, and history at desktop and narrow mobile widths.

- [ ] **Step 2: Review all acceptance criteria against the implementation**

Verify no UX4G runtime/style dependency, all required states, preserved palette, no page overflow, accessible controls, and full test-suite success.

- [ ] **Step 3: Document migration status and known limitations in `docs/shadcn-ui-migration-verification.md`**

Record commands run, supported widths, any intentional table-region scrolling, and any follow-up items that are outside this migration.

- [ ] **Step 4: Commit release evidence**

```bash
git add docs
git commit -m "docs: record shadcn ui migration verification"
```
