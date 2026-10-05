# Anchal Entry Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Anchal offices three route-based work areas and enforce one-time opening-balance setup, date boundaries, and reasoned audit history in both the UI and Worker API.

**Architecture:** Keep React/Vite and the existing Worker/D1 design. Add a small client-side History API router with role-aware route guards; retain the existing entry, setup, dashboard and audit domains. Enforce setup immutability, route date rules, and mandatory backdate/correction reasons in the office coordinator so browser navigation cannot bypass them.

**Tech Stack:** React 19, TypeScript, Vite, Cloudflare Workers, Durable Objects, D1, Vitest, Playwright, UX4G web components.

**Spec:** `docs/superpowers/specs/2026-10-05-anchal-entry-workflow-design.md`

## Global Constraints

- Preserve all 25 Service Master records and existing operational entries, opening balances and audit events.
- All dates shown to office users and used for route validation follow `Asia/Kolkata`; registration timestamps remain server assigned and immutable.
- Office identity is derived from the authenticated session; office APIs must not accept a client-selected office identity.
- Opening setup is required once, includes one date and 25 service/complaint/field balance triplets, and is insert-only.
- Today’s Entry accepts only today's IST service date; Backdate Entry accepts the setup start date through yesterday.
- A new backdated entry requires `Reason for delayed reporting`; every saved-entry correction requires `Reason for correction`.
- Office Change History is scoped to the logged-in office; commissioner history and balance reporting remain organisation-wide.
- Use existing `ux4g-web-components@3.0.0`, approved root theme overrides and verified UX4G classes. Add no custom CSS unless an actual component/layout gap is found and documented.
- Do not deploy or change remote Cloudflare resources as part of implementation without a separate explicit request.

## Review Focus

- Direct URL access before setup: every office route and entry API must enforce the setup gate (Task 2).
- Repeat or concurrent setup submissions: the first baseline remains unchanged and later requests conflict (Task 2).
- IST midnight and date tampering: server route validation rejects dates outside the selected Today/Backdate route (Task 2).
- Missing/whitespace delayed-reporting or correction reason: reject without changing entry, audit or office revision (Task 2).
- Office history and commissioner history: office cannot fetch another office's events; commissioner retains all offices (Task 2).

---

### Task 1: Add role-aware Anchal routes and the one-time setup screen

**Files:**
- Modify: `src/client/App.tsx`
- Modify: `src/client/pages/DailyEntry.tsx`
- Modify: `src/client/pages/InitialBalances.tsx`
- Test: `tests/browser/portal.spec.ts`
- Test: `tests/browser/design.spec.ts`

**Interfaces:**
- `App` owns `pathname`, listens to `popstate`, and navigates through one helper that calls `history.pushState` then updates React state.
- Office paths are `/office/today`, `/office/backdate`, `/office/history`; commissioner paths retain dashboard and organization history behavior.
- `/office/setup` is the dedicated, non-navigable first-login setup path. If setup is absent, requests to any other office path redirect here; once setup exists, requests to `/office/setup` redirect to `/office/today`.
- `DailyEntry` receives `{ officeId, mode: "today" | "backdate", startDate }`; it no longer owns setup mutation or an arbitrary service-date picker.

- [ ] **Step 1: Add browser tests for office route behavior**

Cover login landing on `/office/today`, route-specific tab selection, `Back`/`Forward`, Today without a date picker, Backdate date selection, and office-only navigation. Mock an unset setup and assert all requested office paths redirect to `/office/setup` and render setup without entry controls; with setup present, assert `/office/setup` redirects to `/office/today`.

- [ ] **Step 2: Run the focused browser tests and confirm expected failures**

Run: `npx playwright test tests/browser/portal.spec.ts tests/browser/design.spec.ts`
Expected: FAIL because app navigation is state-only and the setup/entry screen is mixed.

- [ ] **Step 3: Implement role-aware History API navigation in `src/client/App.tsx`**

Add exact route constants and a `navigate(path)` helper. Initialize from `window.location.pathname`, handle `popstate`, redirect authenticated office sessions from `/` to `/office/today`, preserve commissioner dashboard/history, and render three large UX4G office tab buttons with `aria-current="page"`.

- [ ] **Step 4: Make setup a dedicated first-login gate**

Load setup state for an office after session resolution. If absent, redirect every office route to `/office/setup`, render `InitialBalances` as the only office content, and omit office tabs. If present, redirect `/office/setup` to `/office/today`, hide setup from office navigation, and remove the opening-balance edit control from `DailyEntry`. Saving setup refreshes workflow state and navigates to `/office/today`.

- [ ] **Step 5: Split Today and Backdate date controls**

Pass the route mode and setup `startDate` to `DailyEntry`. Today fixes its date to `todayIST()` and has no date input. Backdate uses a date input with `min={startDate}` and `max={todayIST() - 1 day}` in `Asia/Kolkata`; a selected record stays on the Backdate route. Preserve read-only-until-Edit behavior and existing commissioner dashboard UI.

- [ ] **Step 6: Run focused browser tests and commit**

Run: `npx playwright test tests/browser/portal.spec.ts tests/browser/design.spec.ts`
Expected: all focused route, setup-gate, keyboard, mobile and theme checks pass.

Commit: `feat: add routed Anchal entry tabs`

### Task 2: Enforce setup, date, reason and history rules in the Worker

**Files:**
- Modify: `src/worker/index.ts`
- Modify: `src/worker/office-coordinator.ts`
- Modify: `src/worker/repository.ts` only if a read query needs to be shared or adjusted
- Modify: `src/shared/types.ts` only if a request type needs a named route intent
- Test: `tests/worker/api.test.ts`

**Interfaces:**
- `POST /api/office/entries` receives `{ requestId, expectedVersion: null, mode: "today" | "backdate", input, reason }`; `reason` is required for a new entry whose service date precedes today and forbidden/ignored for today's new entry.
- `PUT /api/office/entries/:id` receives `{ requestId, expectedVersion, mode: "today" | "backdate", input, reason }`; `reason` is required for every correction.
- `PUT /api/office/setup` remains the one-time initial setup endpoint; existing setup causes HTTP 409 and cannot alter office_setup or initial_balances.
- Entry GET query accepts `{ date, mode: "today" | "backdate" }`; entry POST/PUT bodies include the same route mode. The Worker validates each requested service date against current IST and stored `office_setup.start_date`.

- [ ] **Step 1: Write Worker integration tests for immutable setup and server date/reason validation**

Add tests for: saving a complete initial setup once; second setup and concurrent setup conflict with original D1 rows unchanged; unset setup blocks reads and entry writes; Today accepts only today; Backdate accepts start-date and yesterday but rejects before-start/today/future; blank/whitespace late reason and correction reason reject without entry/audit/revision writes. Include a UTC instant near IST midnight for date-boundary validation.

- [ ] **Step 2: Run the new Worker tests and confirm expected failures**

Run: `npm run test:worker`
Expected: failures expose mutable setup, missing reason enforcement, or unvalidated route dates.

- [ ] **Step 3: Make setup insert-only in `OfficeCoordinator.safeMutate`**

In the setup branch of `src/worker/office-coordinator.ts`, reject when `repo.getSetup(office)` returns an existing setup before constructing any D1 mutations. Keep validation and first-save atomic batching. Return a clear conflict message; preserve retry receipt handling so a retry of the same successful request returns its original result without a duplicate setup audit event.

- [ ] **Step 4: Add route-mode date validation and reason requirements to the entry mutation**

Pass validated `mode` from `src/worker/index.ts` into the office coordinator request path. Recompute today using the existing `todayIST()` function in the Worker. For mode `today`, require `serviceDate === today`; for `backdate`, require `startDate <= serviceDate < today`. Include `mode` in entry POST/PUT bodies and validate that the service date satisfies the route rule; never trust the browser's mode without checking the date. Require a trimmed non-empty reason on all updates and only on new backdated creates. Remove the old behavior that extends setup start date during back-entry; the start date is immutable.

- [ ] **Step 5: Confirm office history is session scoped and keep commissioner history global**

Verify `/api/history` returns only current office audit events for office sessions and all events for commissioner sessions. If it currently uses another route or role filter, make the smallest change in `src/worker/index.ts` and pin both cases with Worker tests. Preserve setup audit events for that office.

- [ ] **Step 6: Run Worker integration tests and commit**

Run: `npm run test:worker`
Expected: all API authorization, D1 atomicity, idempotent retry, registration timestamp and balance-history tests pass.

Commit: `feat: enforce Anchal reporting workflow rules`

### Task 3: Make delayed-reporting reasons distinct in the office form and audit history

**Files:**
- Modify: `src/client/pages/DailyEntry.tsx`
- Modify: `src/client/i18n.tsx`
- Modify: `src/client/pages/ChangeHistory.tsx` only if existing runtime audit labels need the new action text
- Test: `tests/browser/portal.spec.ts`

**Interfaces:**
- `DailyEntry` displays the reason field as `Reason for delayed reporting` for a new Backdate Entry and `Reason for correction` when editing any saved entry.
- The existing audit `reason` field stores the submitted text unchanged after trimming validation.

- [ ] **Step 1: Add browser assertions for reason labels and required behavior**

Test a new Backdate Entry cannot submit without the delayed-reporting reason, Today’s Entry has no delayed-reporting field, and saved-record editing requires a correction reason on both routes.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npx playwright test tests/browser/portal.spec.ts -g "backdate reason"`
Expected: FAIL until the form selects the correct label and browser required state.

- [ ] **Step 3: Update form reason state and bilingual labels**

Use route mode and `saved` state to label/render the existing reason textarea; keep the correction reason visible only during explicit edit. Ensure `name=reason`, required semantics, preserved input after API validation failures, and EN/HI strings for both reasons. Send the reason on POST/PUT as today.

- [ ] **Step 4: Run the focused browser test and commit**

Run: `npx playwright test tests/browser/portal.spec.ts -g "backdate reason"`
Expected: PASS for delayed-entry and correction reason flows.

Commit: `feat: require a reason for delayed entries`

### Task 4: Update documentation and run the complete verification suite

**Files:**
- Modify: `README.md`
- Modify: `docs/ux4g-integration.md`
- Modify: `docs/superpowers/implementation-status.md`
- Modify: `tests/browser/portal.spec.ts` for final acceptance coverage if Tasks 1/3 did not place it there

**Interfaces:**
- Documentation matches the actual routes, one-time setup behavior, date boundaries and reason labels.
- No remote Cloudflare deployment is performed by this plan.

- [ ] **Step 1: Update local demo and workflow documentation**

Replace claims that opening balances are editable or that earlier dates extend reporting start. Document login setup gate, `/office/today`, `/office/backdate`, `/office/history`, report-start boundary, required reasons, and the retained commissioner pending-balance calculations.

- [ ] **Step 2: Run full verification**

Run: `npm run typecheck`, `npm run test:domain`, `npm run test:worker`, `npm run build`, then `npm run test:browser` against the local Worker with provisioned test accounts.
Expected: all commands pass; browser acceptance verifies direct route navigation and the setup gate. Record any pre-existing/non-blocking UX4G bundle warning separately.

- [ ] **Step 3: Commit documentation and acceptance updates**

Commit: `docs: describe routed Anchal reporting workflow`

## Spec coverage self-review

- Route paths, tabs, login landing and commissioner routes: Task 1.
- First-login setup gate, setup fields, permanent lock and existing-office compatibility: Tasks 1–2.
- Today/Backdate date ranges and backdate reason: Tasks 1–3.
- Explicit edit and correction reason: Tasks 1 and 3.
- Office-scoped and commissioner-wide history: Task 2.
- Immutable registration timestamp and derived balances, including negative later-balance rejection: Task 2 regression tests.
- Existing entries, setup rows and audit snapshots remain preserved: Task 2 makes no destructive migration; regression tests check originals.
- UX4G routes, keyboard, mobile and theme validation: Tasks 1 and 4.

## Type/interface review

The client route mode is the union `"today" | "backdate"`. It is sent as the `mode` query value on office entry reads and included explicitly in create/update request bodies so the Worker can enforce which route's date rule applies. Regardless of client value, the Worker revalidates mode and service date from authenticated session, current IST date and persisted setup. Existing Dashboard `EntryView` fields and D1 schema remain unchanged.

## Review-focus test ownership

All five review-focus cases are pinned in Task 2 Worker tests; direct navigation and focus behavior are covered in Task 1 browser tests. No plan step relies only on client-side validation for an authorization or date rule.
