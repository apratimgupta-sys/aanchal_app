# Field work leaves the daily entry — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The eight field-work services stop being reported on the daily entry; the dashboard stops showing a figure that would now always be zero.

**Architecture:** One predicate — "does the daily entry collect this service" — expressed once per repo and derived from the existing shape tables rather than a new list, so it cannot drift from them. The server enforces it, the entry form renders from it, and the expected-reports denominator counts it instead of hardcoding 25.

**Tech Stack:** React 19 / TS strict / Vitest / Tailwind (`/home/claude/work`); .NET 10 / EF Core / xUnit (`/home/claude/backend`).

**Spec:** `docs/superpowers/specs/2026-11-28-field-work-off-daily-entry-design.md`

## Global Constraints

- **Derive, do not list.** The eight services are already identifiable by their form shape. A new hardcoded id list anywhere is a finding — this project has had three hand-maintained twins and two of them diverged.
- **The services stay in the service master and keep their `fieldwork` shape.** Visits reference them; historical entries need the shape to stay readable.
- **No migration. No change to field visits.**
- **Tailwind utilities only, no hand-written CSS rules.** `src/client/index.css` has zero rules; `theme.css` is token definitions only.
- Every user-visible string is a paired literal `t(en, hi)`; any new Hindi is drafted, not settled.
- No new dependencies. Suites green: frontend 611, backend 496.
- `tests/ui/service-position.ts` hand-pins the entry list's positions. Update it **by hand** from the spec, never by copying what the implementation produces.

## Review Focus

- **A daily entry POSTed directly for a field-work service** — from an old cached page or a replayed request — must be refused by the server, not merely hidden in the UI. *(Task 1)*
- **A correction to a field-work entry filed before the cutover.** Those rows exist on staging. Opening one must not throw, and the correction path must behave predictably — decide and pin whether it is editable or read-only. *(Task 1)*
- **The expected-reports denominator with a service filter pinned.** Today the expression is `filter.ServiceId.HasValue ? 1 : 25`; the pinned branch must stay 1 and the unpinned branch must become the derived count, with a test that fails if someone reinstates a literal. *(Task 1)*
- **The dashboard with a date range that spans the cutover.** Entries for field-work services exist before it and not after; nothing may throw, and no figure may silently mix the two regimes. *(Task 3)*
- **An office whose only unfiled services are field-work ones.** Before this change it showed as incomplete; after, it should read as fully filed. *(Task 3)*

---

### Task 1: The server stops accepting field work on the daily entry

**Files:**
- Modify: `/home/claude/backend/src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs`
- Modify: `/home/claude/backend/src/Anchal.Application/CommissionerMonitoring/Services/MonitoringService.cs` (validation, and the `expected` expression at line 261)
- Test: the backend's entry-rules and dashboard test suites

**Interfaces:**
- Produces: a predicate on `MonitoringRules` answering whether the daily entry collects a given service — derived from the form shape, true for the 17, false for the 8 — plus the count of such services for the denominator.

- [ ] **Step 1: Write the failing tests**

An entry for each of 8, 9, 10, 13, 14, 15, 16, 17 is rejected with a field error on the service. An entry for 1, 2, 11 and 20 is still accepted. The unpinned expected count is the derived 17 per day, and the pinned count is still 1 per day. A test that fails if the denominator is a numeric literal. Then the Review Focus case: reading and correcting a field-work entry filed before the cutover — assert the behaviour you choose, and state the choice in the report.

- [ ] **Step 2: Run them and watch them fail**

Run: `/home/claude/.dotnet/dotnet test` (from `/home/claude/backend`, redirect to a file; it takes ~6 minutes)
Expected: FAIL — entries are accepted and the denominator is 25.

- [ ] **Step 3: Add the predicate and enforce it**

Add the predicate to `MonitoringRules`, derived from the existing shape sets rather than a new id list. Reject a daily entry for a service it excludes, with a message in the style of the existing validation messages. Replace the `25` literal with the derived count.

- [ ] **Step 4: Run the suite, mutation-check, commit**

Mutation: make the predicate accept every service, confirm a test reddens; restore the `25` literal, confirm a test reddens. One at a time, reverted and verified before the next; read `git status` before committing.

```
feat: the daily entry no longer accepts field work
```

---

### Task 2: The entry form offers seventeen services

**Files:**
- Modify: `src/client/pages/DailyEntry.tsx` — `GROUPS`, `groupOf`, the list build at :260 and the group filter at :549
- Modify: `tests/ui/service-position.ts` — by hand
- Test: `tests/ui/daily-entry-groups.test.tsx`, `tests/ui/daily-entry-shapes.test.tsx`

**Interfaces:**
- Consumes: Task 1's rule, mirrored on the frontend by the same derivation from `service-kind.ts`.

- [ ] **Step 1: Write the failing tests**

The entry list holds exactly 17 services and none of the eight; the "Field works" group heading is absent; the numbering runs 01–17 with no gaps; the remaining services keep their relative order. Navigating directly to a field-work service does not render its form.

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/ui/daily-entry-groups.test.tsx`
Expected: FAIL — 25 services and three groups.

- [ ] **Step 3: Filter the list**

Derive the offered set from the same predicate as Task 1 — not a literal id list. Keep `groupOf` intact for the services that remain and for anything still classifying historical data; only the entry form's own list and group set shrink.

- [ ] **Step 4: Update the position fixture by hand**

Write the 17 expected positions from the spec, not from what the code now emits. The point of that file is to disagree with a broken implementation.

- [ ] **Step 5: Run the suite and type check, mutation-check, commit**

Mutation: let one field-work service back into the list; confirm a test reddens.

```
feat: the daily entry offers the seventeen services it collects
```

---

### Task 3: The dashboard drops the work-done figure

**Files:**
- Modify: `src/client/pages/Dashboard.tsx` — the tile at :166-169, the column at :207, `collectsWorkDone` usage, the service filter
- Test: `tests/ui/dashboard.test.tsx`, `tests/ui/dashboard-shapes.test.tsx`

**Interfaces:**
- Consumes: Task 1's denominator; Task 2's offered set for the filter.

- [ ] **Step 1: Write the failing tests**

No "Work done this period" tile and no "Work done" column, in either language. The service filter offers the 17 and not the 8. The remaining tiles and columns are unchanged, pinned and unpinned. Then the two Review Focus cases: a date range spanning the cutover renders without throwing and mixes nothing; and an office whose only unfiled services were field-work ones now reads as fully filed.

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/ui/dashboard.test.tsx tests/ui/dashboard-shapes.test.tsx`
Expected: FAIL — the tile and column are present.

- [ ] **Step 3: Remove them**

Remove the tile, the column and the now-unused plumbing. If `collectsWorkDone` loses its last consumer, say so and remove it rather than leaving a dead export — but check `src/domain/ledger.ts` first, which also used it.

- [ ] **Step 4: Check it at phone width**

The table loses a column; confirm at 390px that nothing overflows and the remaining columns still read, in both languages. Report measurements, not an impression.

- [ ] **Step 5: Run the suite and type check, commit**

```
feat: the dashboard drops a figure the daily entry no longer collects
```

---

### Task 4: The handover records the deploy gate

**Files:**
- Modify: `docs/handover/go-live-operational-checks.md`

- [ ] **Step 1: Write the entry**

One short point in the style of the existing entries: this change moves field-work reporting from clerks to officers entirely, so **it must not be deployed until field officers are provisioned and able to sign in** — otherwise nobody reports field work at all. Note that as of writing, production has never served this work because `ui-rebuild` and `role-manager` have never been merged, so the production build predates the officer role.

- [ ] **Step 2: Commit**

```
docs: field work moves to officers, and what must be true before it ships
```
