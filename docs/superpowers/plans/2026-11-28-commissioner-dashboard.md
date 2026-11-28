# Commissioner dashboard — implementation plan

> **For the executor:** work through the tasks in order, one at a time, using the subagent-driven-development workflow (a fresh implementer per task, then a reviewer). Steps use checkbox (`- [ ]`) syntax. This plan is written to be followed with no knowledge of earlier conversations: everything needed is in this file, the design it implements, and the companion files beside it. Where it gives exact text, use it exactly. Where reality does not match what a step says (a patch does not apply, a search string is missing, a number comes out different), **stop and report — do not improvise, and never change an expected value to make a test pass.**

**Goal:** Rebuild the Commissioner's dashboard as six sections, each with its own filters — Anchal-wise performance, Field visits, Where the visits were, Service-wise progress, Collection (bar chart), Received and disposed (line chart) — fed by three new read-only server calls.

**Architecture:** The server does all the adding up. Two new calls roll the daily entries up per service and per day; a third rolls field visits up per service and per ward. Each section of the page is its own component with its own filters and its own data call, so one can fail or reload without touching the others. Charts are two small hand-built SVG pieces; no chart library is added.

**Tech stack:** Backend: .NET 10, EF Core, xUnit. Frontend: React 19, TypeScript strict, TanStack Query, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-28-commissioner-dashboard-design.md` (in the frontend repo). Read it before starting; it says what every figure means. The approved layout is the mockup linked at the top of that file.

**Companion files:** `docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/` holds six patches. The four backend patches and the two frontend foundation patches were written and run before this plan was finished: with all four backend patches applied the backend suite passed, and with both frontend patches applied the frontend suite and the type check passed. They are applied with `git apply`, not retyped.

## Who does which task

| Task | What | Repo | Model for the implementer | Reviewer |
|---|---|---|---|---|
| 0 | Pre-flight | both | the controller itself | — |
| 1 | By-service and by-day calls | backend | **Haiku** (applies verified patches) | the controller checks the suite |
| 2 | Visit summary call | backend | **Haiku** (applies verified patches) | the controller checks the suite |
| 3 | Shared foundation | frontend | **Haiku** (applies verified patches) | the controller checks the suite |
| 4 | Page shell, period picker, Anchal section | frontend | **Sonnet** | Sonnet |
| 5 | Service-wise progress | frontend | **Sonnet** | Sonnet |
| 6 | The chart component | frontend | **Sonnet** | Sonnet |
| 7 | Collection and Received-and-disposed | frontend | **Sonnet** | Sonnet |
| 8 | Field visits and the ward grid | frontend | **Sonnet** | Sonnet |
| 9 | Page order, isolation, live specs, handover | frontend | **Sonnet** | Sonnet |
| 10 | Final verification, whole-branch review, delivery | both | the controller itself | **Opus** (whole-branch review) |

Why this split: Tasks 1–3 are transcription of code that has already been run, so the cheapest model is right; if a patch fails to apply or a suite goes red, stop and hand the task to Sonnet rather than letting Haiku repair it. Tasks 4–9 each build a component from a contract and its tests, which is Sonnet's level; none needs design decisions, because the design makes them. The one place the most capable model earns its cost is the final review, which is the only step that sees both repos at once. If a Sonnet implementer is still failing its own tests after three fix rounds, re-dispatch that task to Opus with the report so far.

---

## Read this first: the ground you are standing on

### The two repositories

| | Frontend | Backend |
|---|---|---|
| Path | `/home/claude/work` | `/home/claude/backend` |
| Branch | `ui-rebuild` | `role-manager` |
| Starting tests | 680 passing | 575 passing |
| Run tests | `npx vitest run` (about 1 minute) | see below (about 7 minutes) |
| Type check | `npx tsc --noEmit` (silent = pass) | part of the build |

Start from whatever commit each branch is on when Task 0 runs; Task 0 records them. Commit ids differ between machines, so compare commits by message, never by id.

**Running the backend suite.** `dotnet` is not on PATH. The run takes about 7 minutes and prints nothing until the end. Run it in the background and wait on the log; never a foreground call with a short timeout, never a `sleep` loop in the foreground:

```bash
cd /home/claude/backend && /home/claude/.dotnet/dotnet test > /tmp/backend-N.log 2>&1
# then, as a separate background wait:
until grep -qE "^(Passed!|Failed!)" /tmp/backend-N.log; do sleep 15; done; grep -E "^(Passed!|Failed!)" /tmp/backend-N.log
```

Use a new `N` for each run. To iterate on one class: `/home/claude/.dotnet/dotnet test --filter "FullyQualifiedName~DashboardBreakdownTests"`. **Never run the backend suite and the frontend suite at the same time** — the container has been killed for it.

### What exists today

- **The dashboard page** is `src/client/pages/Dashboard.tsx` (436 lines): a page-wide filter panel, a filing-status panel, three tiles, and one table by Anchal. It makes one call, `GET /dashboard?from&to[&officeId][&serviceId]`, which returns one row per Anchal plus `updatedAt`. It refreshes every 15 seconds while the tab is visible and when the window regains focus.
- **Services.** `src/shared/services.json` lists 25 services. The clerk's daily entry collects ten of them; eight are field work, reported by officers as visits; seven are withdrawn. Never write these ids as numbers in code under `src/` (see the guards below). Use the helpers:

  | Helper | Module | Meaning |
  |---|---|---|
  | `dailyEntryCollects(id)` | `src/domain/service-kind.ts` | on the daily entry (the ten) |
  | `reportedAsVisit(id)` | same | field work (the eight) |
  | `movesPendingBalance(id)` | same | keeps a queue: Received, Disposed, Pending, Disposal % mean something |
  | `collects(id, "amountPaise")` | same | takes money: Collected means something |
  | `formShape(id)` | same | `"counter"`, `"counterRevenue"`, `"revenue"` or `"fieldwork"` |
  | `DAILY_SERVICES`, `displayNumber(id)` | `src/domain/daily-entry-order.ts` (Task 3 adds it) | the ten in the entry form's order, and each one's printed number, `"01"` to `"10"` |

  Of the ten: seven keep a queue (four of those also take a fee) and three are collections that take payments and have no queue. So seven services feed Received/Disposed/Pending and seven feed Collected.
- **Blank is not zero.** A figure a service does not record is shown as an empty cell, never `0` and never `—`. Zero means nothing happened. This rule is already in the Anchal table and applies to every table in this plan.
- **Bilingual.** Every visible string is an English/Hindi pair written `t("English", "हिंदी")`, where `const t = useText()` from `src/client/i18n`. A service's name is `s.en` in English and `s.name` in Hindi. A message that comes from the server is translated by exact string match in the table inside `src/client/i18n.tsx` (`runtimeText(message, lang)`), and every key in that table is also listed by hand in `tests/ui/password-reset-midsession.test.tsx` under `describe("the Hindi for server messages")`. **All Hindi in this plan is a draft for the client's reviewer:** use the exact strings given, and list every Hindi string you add in your report.
- **UI pieces** come from `src/client/ui.tsx`: `Panel` (a card, renders a `<section>`), `Field` (label + control), `Button` (variants `primary`, the default, and `outline`), `Notice` (an alert), `Table`, `Th`, `Td` (takes a `label` used on narrow screens), `cardTable`, `cardTableWrap`, `cardTitle`, `useScrollRegion`, and the line-height classes `leadingBody`, `leadingHelp`, `leadingHeading`. Read how `Dashboard.tsx` uses them before writing a section; match it.

### Guards that will fail if you take a shortcut

- `tests/domain/derive-dont-list.test.ts` scans every `.ts`/`.tsx` under `src/` and fails if three or more service ids from 8–25 appear near each other as number literals. Ids belong in JSON data files and in tests.
- `tests/ui/theme-tokens.test.tsx` requires every colour the Tailwind config references to be defined in `src/client/styles/theme.css` as an `H S% L%` triplet.
- `tests/ui/no-dead-styling.test.tsx` forbids a hand-written stylesheet. Styling is Tailwind utility classes and theme tokens only. Never add a CSS rule; `src/client/index.css` keeps zero rules.
- The backend has source-scan tests anchored on lines of `MonitoringService.cs`. The backend patches do not touch those lines; do not edit that file by hand.

### Rules for every task

- **Test first.** Write or apply the tests, run them, see them fail for the reason the step predicts, then write the code. If a new test passes before any code changes, say so in your report instead of presenting it as red-then-green.
- **The tests in this plan are the contract.** If a test here is wrong about the *test tooling* (an import path, a query that cannot find an element that is plainly there), fix the test minimally and list the fix in your report. If it is wrong about the *product* (a number, a label, an order), stop and report: do not change the expectation.
- **No new dependencies.** No database migration. If you find yourself adding either, stop.
- **Commits:** one per task per repo, with the message the task gives. End each message with the attribution lines your session's system reminder gives at the time you commit. Run `git status --short` immediately before committing and commit only files the task names.
- **No mutation loops.** To prove a test bites, break one thing by hand, run the one file, restore it, and confirm `git status` is clean.
- **Do not deploy or push.** The work is delivered as patches in Task 10.
- **Subagents do not spawn subagents**, and do not run their own code review. Review comes from the controller.

---

## Global constraints

- No page-wide filter bar. Each section owns its filters; changing one section's filter must not refetch or reset another section.
- Section order on the page, top to bottom: Anchal-wise performance; Field visits; Where the visits were; Service-wise progress; Collection; Received and disposed.
- Nothing about filing status anywhere: no "filed", no "N / 10", no "reports" badge, no headline tiles.
- Period choices: `Today`, `Past 7 days` (today and the six days before), `This month` (the 1st to today), `Custom` (a from date and a to date, neither after today). The two chart sections offer `Past 7 days`, `This month` and `Custom` only, and start on `This month`. Every other section starts on `Today`.
- Every query key begins with `"dashboard"`, so the page's one refresh mechanism reaches every section.
- Money is stored in paise. A money figure in a table or tooltip is `₹` with Indian grouping and two decimals (the `currency` helper already in `Dashboard.tsx`); a chart axis uses the compact form.
- Counts use Indian grouping with at most one decimal: `formatCount` in `src/domain/visit-cards.ts` (Task 3 adds it).
- Column and series wording: `Received`, `Disposed`, `Pending`, `Disposal %`, `Collected (₹)`. Hindi: `प्राप्त`, `निस्तारित`, `लंबित`, `निस्तारण %`, `संग्रहित (₹)`.
- A visit is `निरीक्षण`; field visits are `क्षेत्रीय निरीक्षण`; Anchal is `अंचल`.

## Review focus

The conditions most likely to hurt the Commissioner that a task-by-task build can miss. Each has a test in the task named.

- **A breakdown that does not add up to the Anchal table.** The per-service and per-day figures must sum to the Anchal rows for the same filter. *(Task 1: `TheServiceRowsAddUpToTheAnchalTable`, `TheDayRowsAddUpToTheAnchalTable`.)*
- **A blank shown as zero, or the reverse**, in the Anchal table when a service is pinned and in the service table always. *(Tasks 4 and 5.)*
- **A sum that quietly understates.** Visit details are optional; a card must say how many visits gave no figure. Voided visits must not be counted. *(Task 2: `AVoidedVisitIsNotCounted`; Task 8: "says how many visits gave no figure".)*
- **A chart handed nothing, one day, or all zeros** must draw its frame, with no `NaN` anywhere in the markup. *(Task 6.)*
- **One section's failure taking the page down**, and a custom period the page should never have asked for. *(Task 4: "asks for nothing while the custom period cannot be asked for"; Task 9: "one section failing leaves the others standing".)*

---

### Task 0: Pre-flight (controller)

- [ ] **Step 1: Record where both repos are**

```bash
cd /home/claude/work && git status --short && git log --oneline -1
cd /home/claude/backend && git status --short && git log --oneline -1
```

Expected: both working trees clean. Record both commit ids in the ledger as the bases for this plan. If either tree is dirty, stop.

- [ ] **Step 2: Confirm both suites are green before anything changes**

Frontend: `npx vitest run` and `npx tsc --noEmit` — expect 680 passing and silence. Then, **after that finishes**, the backend suite — expect 575 passing. If either is not green, stop and report.

- [ ] **Step 3: Confirm the companion patches are present**

```bash
ls /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/
```

Expected: `backend-1-tests.patch`, `backend-1-source.patch`, `backend-2-tests.patch`, `backend-2-source.patch`, `frontend-1-tests.patch`, `frontend-1-source.patch`.

---

### Task 1: The by-service and by-day calls (backend) — Haiku

**Files (all changed by the two patches):**
- Create: `src/Anchal.Application/CommissionerMonitoring/Services/MonitoringService.Breakdowns.cs`
- Create: `tests/Anchal.Tests/CommissionerMonitoring/Application/DashboardBreakdownTests.cs`
- Modify: `src/Anchal.Application/CommissionerMonitoring/Services/MonitoringService.cs` (one word: the class becomes `partial`)
- Modify: `src/Anchal.Application/CommissionerMonitoring/Services/IMonitoringService.cs`
- Modify: `src/Anchal.Application/CommissionerMonitoring/DTOs/MonitoringDtos.cs`
- Modify: `src/Anchal.Api/Controllers/MonitoringDashboardController.cs`
- Modify: `tests/Anchal.Tests/CommissionerMonitoring/FieldVisits/RoleManagerUserAdministrationTests.cs`

**Produces (the frontend relies on these exactly):**

- `GET /v1/api/anchal/dashboard/services?from=YYYY-MM-DD&to=YYYY-MM-DD[&officeId=1..6]` → `{ "rows": [ { "serviceId", "received", "completed", "pending", "disposalPct", "amountPaise" } ] }`. One row per service the daily entry collects (ten), in id order. The sums are raw: `received` on a collection service is its number of payments; `pending` is the closing balance on the `to` day summed over Anchals, and is `0` for a service with no queue; `disposalPct` is `null` for a service with no queue or with nothing received.
- `GET /v1/api/anchal/dashboard/days?from&to[&officeId][&serviceId=1..25]` → `{ "rows": [ { "date": "YYYY-MM-DD", "received", "completed", "amountPaise" } ] }`. One row per day from `from` to `to`, in order, zeros for a day with nothing filed. A period over 92 days is refused with status 422 and the message `Choose a period of 92 days or fewer`.
- Both are Commissioner-only, like `GET /dashboard`.

- [ ] **Step 1: Apply the tests and watch the build fail**

```bash
cd /home/claude/backend && git apply --check /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-1-tests.patch && git apply /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-1-tests.patch && git status --short
/home/claude/.dotnet/dotnet build tests/Anchal.Tests -v q 2>&1 | grep -E " error " | head -5
```

Expected: two files changed (one new), and the build fails with errors naming `GetDashboardServicesAsync`, `ServiceRowDto` and the like, which do not exist yet. That is the predicted failure. If `git apply --check` refuses, stop and report its output.

- [ ] **Step 2: Apply the source**

```bash
cd /home/claude/backend && git apply --check /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-1-source.patch && git apply /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-1-source.patch && git status --short
```

Expected: five more files changed (one new).

- [ ] **Step 3: Run the new tests, then the whole suite**

`/home/claude/.dotnet/dotnet test --filter "FullyQualifiedName~DashboardBreakdownTests"` — expect `Passed: 15`. Then the full suite in the background as described above — expect `Failed: 0, Passed: 592` (575 + 15 + 2 new route-denial cases).

- [ ] **Step 4: Commit** (backend)

```
feat: the dashboard's figures by service and by day
```

---

### Task 2: The visit summary call (backend) — Haiku

**Files (all changed by the two patches):**
- Create: `tests/Anchal.Tests/CommissionerMonitoring/FieldVisits/FieldVisitSummaryTests.cs`
- Modify: `src/Anchal.Infrastructure/CommissionerMonitoring/Officers/MonitoringFieldVisitService.cs`
- Modify: `src/Anchal.Application/CommissionerMonitoring/Services/IMonitoringFieldVisitService.cs`
- Modify: `src/Anchal.Application/CommissionerMonitoring/DTOs/MonitoringDtos.cs`
- Modify: `src/Anchal.Api/Controllers/MonitoringFieldVisitController.cs`
- Modify: `tests/Anchal.Tests/CommissionerMonitoring/FieldVisits/RoleManagerUserAdministrationTests.cs`

**Produces:**

`GET /v1/api/anchal/field-visits/summary?from&to[&officeId=1..6]`, Commissioner-only →

```json
{
  "visits": 5, "officers": 1,
  "services": [
    { "serviceId": 8, "visits": 3, "wardsCovered": 2,
      "numbers": [ { "key": "quantityKg", "sum": 200.5, "visits": 2 } ],
      "choices": [ { "key": "wasteType", "options": [
        { "value": "wet", "visits": 1, "numbers": [ { "key": "quantityKg", "sum": 120.5, "visits": 1 } ] },
        { "value": "dry", "visits": 1, "numbers": [ { "key": "quantityKg", "sum": 80, "visits": 1 } ] },
        { "value": "mixed", "visits": 0, "numbers": [ { "key": "quantityKg", "sum": 0, "visits": 0 } ] } ] } ] }
  ],
  "wards": [ { "ward": 8, "visits": 2 }, { "ward": 24, "visits": 2 } ]
}
```

`services` always holds all eight field-work services in id order, at zero when they had no visit. A number's `visits` is how many visits gave that number. `wards` holds only wards with at least one visit, in ward order. Voided visits and visits stored for a service that is not field work are in no figure.

- [ ] **Step 1: Apply the tests and watch the build fail**

```bash
cd /home/claude/backend && git apply --check /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-2-tests.patch && git apply /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-2-tests.patch && git status --short
/home/claude/.dotnet/dotnet build tests/Anchal.Tests -v q 2>&1 | grep -E " error " | head -5
```

Expected: the test file is new, one existing test file gains a line, and the build still succeeds (the new tests call the route over HTTP). Run `/home/claude/.dotnet/dotnet test --filter "FullyQualifiedName~FieldVisitSummaryTests"` and expect them to fail: the route does not exist, so the requests come back 404 or 405. That is the predicted failure.

- [ ] **Step 2: Apply the source**

```bash
cd /home/claude/backend && git apply --check /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-2-source.patch && git apply /home/claude/work/docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/backend-2-source.patch && git status --short
```

- [ ] **Step 3: Run the new tests, then the whole suite**

`/home/claude/.dotnet/dotnet test --filter "FullyQualifiedName~FieldVisitSummaryTests"` — expect `Passed: 8`. Then the full suite — expect `Failed: 0, Passed: 601` (592 + 8 + 1 new route-denial case).

- [ ] **Step 4: Commit** (backend)

```
feat: field visits summarised for the dashboard, by service and by ward
```

---

### Task 3: The shared foundation (frontend) — Haiku

**Files (all changed by the two patches):**
- Create: `src/domain/period.ts`, `src/domain/daily-entry-order.ts`, `src/domain/visit-cards.ts`, `src/shared/visit-card-wording.json`, `src/client/dashboard-data.ts`, `src/client/pages/dashboard/charts/scale.ts`
- Modify: `src/shared/types.ts`, `src/client/styles/theme.css`, `tailwind.config.ts`
- Create tests: `tests/domain/period.test.ts`, `tests/domain/daily-entry-order.test.ts`, `tests/domain/chart-scale.test.ts`, `tests/domain/visit-cards.test.ts`, `tests/domain/dashboard-data.test.ts`

**Produces (every later task uses these; the signatures are exact):**

```ts
// src/domain/period.ts
export type PeriodKind = "today" | "week" | "month" | "custom";
export type PeriodValue = { kind: PeriodKind; from: string; to: string };   // from/to matter only for "custom"
export function periodRange(value: PeriodValue, today: string): { from: string; to: string } | null;  // null: a custom range that cannot be asked for
export function addDays(date: string, days: number): string;
export function daysInRange(from: string, to: string): number;

// src/domain/daily-entry-order.ts
export const DAILY_SERVICES: { id: number; en: string; name: string; unit: string }[];  // the ten, in the entry form's order
export function displayNumber(serviceId: number): string;                                // "01".."10"; throws for any other service

// src/domain/visit-cards.ts
export type VisitCard = { serviceId: number; visits: number; headline: { value: number; en: string; hi: string }; sub: { en: string; hi: string }; missing: number };
export function visitCard(summary: VisitServiceSummary): VisitCard;
export function formatCount(value: number): string;                                      // "1,25,000", "200.5"

// src/client/dashboard-data.ts
export type DashboardQuery = { from: string; to: string; officeId?: number; serviceId?: number };
export type AnchalRows = { rows: MonitoringRow[]; updatedAt: string; retrievedAt?: string };
export const getAnchalRows: (q: DashboardQuery) => Promise<AnchalRows>;                   // GET /dashboard
export const getServiceRows: (q: Omit<DashboardQuery, "serviceId">) => Promise<{ rows: ServiceRow[] }>;   // GET /dashboard/services
export const getDayRows: (q: DashboardQuery) => Promise<{ rows: DayRow[] }>;              // GET /dashboard/days
export const getVisitSummary: (q: Omit<DashboardQuery, "serviceId">) => Promise<VisitSummary>;            // GET /field-visits/summary

// src/client/pages/dashboard/charts/scale.ts
export function axis(largest: number): { max: number; ticks: number[] };   // six ticks from 0; axis(418) -> max 500
export function xAt(index: number, count: number, left: number, right: number): number;
export function labelIndexes(count: number, most?: number): number[];     // which days are named on the axis; the last always is

// src/shared/types.ts
export type ServiceRow = { serviceId: number; received: number; completed: number; pending: number; disposalPct: number | null; amountPaise: number };
export type DayRow = { date: string; received: number; completed: number; amountPaise: number };
export type VisitSummary = { visits: number; officers: number; services: VisitServiceSummary[]; wards: { ward: number; visits: number }[] };
// plus VisitServiceSummary, VisitChoiceSummary, VisitOptionSummary, VisitNumberSummary, matching Task 2's JSON
```

Tailwind colours added: `chart-1`, `chart-2` (the two series colours) and `ward-1`, `ward-2`, `ward-3` (the ward grid's ramp). Use them as `fill-chart-1`, `stroke-chart-2`, `bg-ward-2`, and so on.

- [ ] **Step 1: Apply the tests and watch them fail**

```bash
cd /home/claude/work && git apply --check docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/frontend-1-tests.patch && git apply docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/frontend-1-tests.patch
npx vitest run tests/domain/period.test.ts tests/domain/daily-entry-order.test.ts tests/domain/chart-scale.test.ts tests/domain/visit-cards.test.ts tests/domain/dashboard-data.test.ts 2>&1 | grep -E "Test Files|Tests |Cannot find|Failed to resolve" | head
```

Expected: all five files fail because the modules they import do not exist.

- [ ] **Step 2: Apply the source**

```bash
cd /home/claude/work && git apply --check docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/frontend-1-source.patch && git apply docs/superpowers/plans/2026-11-28-commissioner-dashboard-files/frontend-1-source.patch && git status --short
```

- [ ] **Step 3: Run everything**

`npx vitest run` — expect `Tests  725 passed`: the 680 from before, the 40 new ones, and 5 more because one existing guard runs once per source file and this adds five. `npx tsc --noEmit` — expect silence.

- [ ] **Step 4: Commit** (frontend)

```
feat: the dashboard's shared pieces: periods, service order, visit cards, chart scale, data calls
```

---

## The frontend's shape (Tasks 4–9)

Everything new for the page lives in `src/client/pages/dashboard/`:

| File | What it is | Task |
|---|---|---|
| `format.ts` | `currency`, `percent`, `usableStamp` (moved out of `Dashboard.tsx` unchanged), `compactRupees` | 4, 7 |
| `PeriodPicker.tsx` | the Period buttons and the two custom dates | 4 |
| `Filters.tsx` | `AnchalFilter` and `ServiceFilter` | 4 |
| `SectionCard.tsx` | a section's card: heading, filter row, error notice, content | 4 |
| `useSection.ts` | one section's data call | 4 |
| `AnchalSection.tsx` | section 1 | 4 |
| `ServiceSection.tsx` | section 4 | 5 |
| `charts/DayChart.tsx` | the bar and line chart, with its table view | 6 |
| `CollectionSection.tsx`, `TrendSection.tsx` | sections 5 and 6 | 7 |
| `FieldVisitsSection.tsx`, `WardSection.tsx` | sections 2 and 3 | 8 |

`src/client/pages/Dashboard.tsx` shrinks to the header, the refresh mechanism, and the sections in order.

**Tests mock one module.** Every dashboard test replaces `src/client/api` with a `vi.fn()` and routes it by path through `tests/ui/dashboard-harness.tsx` (Task 4 creates it). So no dashboard source file may import anything from `src/client/api` except through `src/client/dashboard-data.ts`; in particular, do not import `RequestError`. Read an error as `(error as Error).message`.

**Today.** `todayIST()` from `src/domain/ledger` is today's Indian date as `YYYY-MM-DD`. The tests call the real one and build their expected dates from it with `addDays`, so they hold on any day.

### Wording used by more than one section

| English | Hindi |
|---|---|
| Period | अवधि |
| Today | आज |
| Past 7 days | पिछले 7 दिन |
| This month | इस माह |
| Custom | कस्टम |
| From date | प्रारंभ तिथि |
| To date | अंतिम तिथि |
| Anchal | अंचल |
| All offices | सभी कार्यालय |
| Anchal *N* | अंचल *N* |
| Service | सेवा |
| Start date must be on or before the end date. | आरंभ तिथि समाप्ति तिथि से पहले या उसी दिन होनी चाहिए। |
| TOTAL | कुल |
| Received | प्राप्त |
| Disposed | निस्तारित |
| Pending | लंबित |
| Disposal % | निस्तारण % |
| Collected (₹) | संग्रहित (₹) |

---

### Task 4: The page shell, the period picker and the Anchal section (frontend) — Sonnet

**Files:**
- Create: `src/client/pages/dashboard/format.ts`, `PeriodPicker.tsx`, `Filters.tsx`, `SectionCard.tsx`, `useSection.ts`, `AnchalSection.tsx`
- Rewrite: `src/client/pages/Dashboard.tsx`
- Create tests: `tests/ui/dashboard-harness.tsx`, `tests/ui/dashboard-period-picker.test.tsx`, `tests/ui/dashboard-anchal.test.tsx`, `tests/ui/dashboard-page.test.tsx`, `tests/domain/audit-retired-fields.test.ts`
- Modify test: `tests/ui/dashboard-as-of.test.tsx`
- Delete tests: `tests/ui/dashboard.test.tsx`, `tests/ui/dashboard-shapes.test.tsx`

**Consumes:** everything Task 3 produces.

**Produces:**

```tsx
// format.ts
export const currency: (paise: number) => string;             // "₹2,500.00" — the function now at the top of Dashboard.tsx, moved
export const percent: (value: number | null) => string;       // "75.0%", or "—" for null — moved
export const usableStamp: (value?: string | null) => string | null;   // moved

// PeriodPicker.tsx
export const ALL_PERIODS: readonly PeriodKind[];              // today, week, month, custom
export const CHART_PERIODS: readonly PeriodKind[];            // week, month, custom
export default function PeriodPicker(props: { name: string; value: PeriodValue; onChange: (value: PeriodValue) => void; kinds?: readonly PeriodKind[] }): JSX.Element;

// Filters.tsx
export function AnchalFilter(props: { id: string; value: number | undefined; onChange: (officeId: number | undefined) => void }): JSX.Element;
export function ServiceFilter(props: { id: string; value: number | undefined; onChange: (serviceId: number | undefined) => void; services: typeof DAILY_SERVICES; allLabel: string }): JSX.Element;

// SectionCard.tsx
export default function SectionCard(props: { id: string; title: string; subtitle?: ReactNode; aside?: ReactNode; filters: ReactNode; error?: string | null; children: ReactNode }): JSX.Element;

// useSection.ts
export function useSection<T>(name: string, period: PeriodValue, params: { officeId?: number; serviceId?: number }, read: (query: DashboardQuery) => Promise<T>): { data: T | undefined; range: { from: string; to: string } | null; error: string | null };

// AnchalSection.tsx
export default function AnchalSection(props: { onStamp?: (stamp: string) => void }): JSX.Element;
```

**What each piece does**

- **`PeriodPicker`** renders a `role="group"` labelled `Period` holding one `<button type="button">` per kind, in the order given, each with `aria-pressed`. Use `Button`: the pressed one is the default variant, the others `variant="outline"`. Clicking one calls `onChange({ ...value, kind })`. Only when `value.kind === "custom"` it also renders two date inputs labelled `From date` and `To date`, each with `max={todayIST()}`; changing one calls `onChange` with that date replaced. `kinds` defaults to `ALL_PERIODS`. `name` only makes the input ids unique.
- **`AnchalFilter`** is a `Field` labelled `Anchal` around a `<select>`: `All offices`, then `Anchal 1` to `Anchal 6` (use `ANCHAL_MIN` and `ANCHAL_MAX` from `src/domain/visit.ts`). **`ServiceFilter`** is a `Field` labelled `Service` around a `<select>`: the `allLabel` option, then one option per service given, reading `` `${displayNumber(s.id)} · ${name}` `` with `value={s.id}`. Both call `onChange(undefined)` for the first option.
- **`SectionCard`** renders `<Panel aria-labelledby={`${id}-heading`}>` containing an `<h2 id={`${id}-heading`}>` with the title, the subtitle beneath it, `aside` at the top right, the filters in a wrapping row with a bottom border, then `<Notice>{error}</Notice>` when there is an error, then the children. Copy the heading and subtitle classes from the present `Dashboard.tsx` (`heading`, and the muted 13px line).
- **`useSection`** computes `range = periodRange(period, todayIST())` and calls

  ```ts
  useQuery({
    queryKey: ["dashboard", name, range, params],
    queryFn: () => read({ ...range!, ...params }),
    enabled: range !== null,
    placeholderData: keepPreviousData,     // from @tanstack/react-query: the last figures stay up while new ones load
  })
  ```

  `error` is, in this order: the start-date message from the table above when the period is custom, both dates are filled in and `range` is null; otherwise the failed request's message put through `runtimeText(message, lang)`; otherwise null. When `range` is null because a date is still empty, there is no error and no request.
- **`AnchalSection`** holds its own period (starting `{ kind: "today", from: "", to: "" }`) and service. It calls `useSection("anchals", period, { serviceId }, getAnchalRows)`. Title `Anchal-wise performance` / `अंचलवार प्रदर्शन`; subtitle `What each Anchal received, disposed and collected` / `प्रत्येक अंचल में क्या प्राप्त हुआ, क्या निस्तारित हुआ और कितना संग्रह हुआ`. Filters: `PeriodPicker` then `ServiceFilter` with `services={DAILY_SERVICES}` and `allLabel` `` `All ${DAILY_SERVICES.length} services` `` / `` `सभी ${DAILY_SERVICES.length} सेवाएँ` ``. The table is the present one moved over — same `Table`/`Th`/`Td` use, same scroll region labelled `Anchal-wise performance table` / `अंचलवार प्रदर्शन तालिका`, same pinned-service gating (`queueCell` for Received, Disposed, Pending and Disposal %; `amountCell` for Collected), same total row — with the column heads from the shared wording table. When data arrives it calls `onStamp(usableStamp(data.updatedAt) ?? usableStamp(data.retrievedAt) ?? "")`.
- **`Dashboard.tsx`** keeps its header (eyebrow, `<h1>`, the "Figures as of" line fed by `onStamp`), and its two effects exactly as they are: the 15-second poll while the tab is visible and the refresh on window focus, both `queryClient.invalidateQueries({ queryKey: ["dashboard"] })`. A `Refresh` / `रिफ्रेश` button (`variant="outline"`) sits in the header and does the same. Below the header: `<AnchalSection onStamp={setUpdated} />`. Everything else in the file goes: the filter panel, the filing panel, the tiles, the reports badge, and the code that only they used.

- [ ] **Step 1: Save the one test that is not about the dashboard**

`tests/ui/dashboard-shapes.test.tsx` is about to be deleted, and one test in it checks `src/client/audit`, not the dashboard. Create `tests/domain/audit-retired-fields.test.ts` holding that test: copy the body of `it("keeps the correction history labels for the retired fields", …)` from `dashboard-shapes.test.tsx` unchanged into a `describe("the audit labels for retired fields", …)`, with `import { describe, expect, it } from "vitest";` and `import { auditComparison, auditFields } from "../../src/client/audit";`. Run it: `npx vitest run tests/domain/audit-retired-fields.test.ts` — expect 1 passing.

- [ ] **Step 2: Write the test harness** — `tests/ui/dashboard-harness.tsx`

```tsx
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import type { Mock } from "vitest";
import { Language } from "../../src/client/i18n";
import type { DayRow, MonitoringRow, ServiceRow, VisitServiceSummary, VisitSummary } from "../../src/shared/types";
import { FIELD_WORK_IDS } from "./service-position";

export const anchalRow = (over: Partial<MonitoringRow> = {}): MonitoringRow => ({
  officeId: 1, received: 40, completed: 30, slaWithinTime: 0, pending: 12, disposalPct: 75, slaPct: null,
  amountPaise: 250000, complaintsPending: 0, fieldPending: 0, workDone: 0, submitted: 10, expected: 10,
  configured: true, reviewReasons: [], ...over,
});

export const serviceRow = (serviceId: number, over: Partial<ServiceRow> = {}): ServiceRow => ({
  serviceId, received: 0, completed: 0, pending: 0, disposalPct: null, amountPaise: 0, ...over,
});

export const dayRow = (date: string, over: Partial<DayRow> = {}): DayRow => ({
  date, received: 0, completed: 0, amountPaise: 0, ...over,
});

export const visitService = (serviceId: number, over: Partial<VisitServiceSummary> = {}): VisitServiceSummary => ({
  serviceId, visits: 0, wardsCovered: 0, numbers: [], choices: [], ...over,
});

// All eight field-work services at zero, as the server sends them when nothing was filed.
export const visitSummary = (over: Partial<VisitSummary> = {}): VisitSummary => ({
  visits: 0, officers: 0, services: FIELD_WORK_IDS.map((id) => visitService(id)), wards: [], ...over,
});

export type Answers = {
  anchals?: MonitoringRow[];
  updatedAt?: string;
  retrievedAt?: string;
  services?: ServiceRow[];
  days?: DayRow[];
  summary?: VisitSummary;
};

// Answers each of the dashboard's four reads by its path. A request for anything else fails the test.
export function route(api: Mock, answers: Answers = {}) {
  api.mockImplementation(async (path: string) => {
    if (path.startsWith("/dashboard/services")) return { rows: answers.services ?? [] };
    if (path.startsWith("/dashboard/days")) return { rows: answers.days ?? [] };
    if (path.startsWith("/field-visits/summary")) return answers.summary ?? visitSummary();
    if (path.startsWith("/dashboard?")) {
      return {
        rows: answers.anchals ?? [],
        updatedAt: answers.updatedAt ?? "2026-11-20T05:00:00.000Z",
        ...(answers.retrievedAt === undefined ? {} : { retrievedAt: answers.retrievedAt }),
      };
    }
    throw new Error(`unexpected request: ${path}`);
  });
}

// The paths asked for so far that start with `prefix`, oldest first.
export const paths = (api: Mock, prefix: string): string[] =>
  api.mock.calls.map((call) => String(call[0])).filter((path) => path.startsWith(prefix));

export function renderWithin(ui: ReactElement, lang: "en" | "hi" = "en"): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>{ui}</Language.Provider>
    </QueryClientProvider>,
  );
  return client;
}
```

- [ ] **Step 3: Write the period picker's tests** — `tests/ui/dashboard-period-picker.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Language } from "../../src/client/i18n";
import PeriodPicker, { CHART_PERIODS } from "../../src/client/pages/dashboard/PeriodPicker";
import { todayIST } from "../../src/domain/ledger";
import type { PeriodKind, PeriodValue } from "../../src/domain/period";

function Host({ kinds, seen, lang = "en" }: { kinds?: readonly PeriodKind[]; seen: (v: PeriodValue) => void; lang?: "en" | "hi" }) {
  const [value, setValue] = useState<PeriodValue>({ kind: kinds?.[0] ?? "today", from: "", to: "" });
  return (
    <Language.Provider value={lang}>
      <PeriodPicker name="t" kinds={kinds} value={value} onChange={(v) => { setValue(v); seen(v); }} />
    </Language.Provider>
  );
}

const buttons = () => within(screen.getByRole("group")).getAllByRole("button").map((b) => b.textContent);
const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

afterEach(() => cleanup());

describe("the period picker", () => {
  it("offers the four periods as buttons and marks the one chosen", async () => {
    const seen = vi.fn();
    render(<Host seen={seen} />);
    expect(screen.getByRole("group", { name: "Period" })).toBeTruthy();
    expect(buttons()).toEqual(["Today", "Past 7 days", "This month", "Custom"]);
    expect(pressed("Today")).toBe("true");

    await userEvent.setup().click(screen.getByRole("button", { name: "This month" }));

    expect(seen).toHaveBeenLastCalledWith({ kind: "month", from: "", to: "" });
    expect(pressed("This month")).toBe("true");
    expect(pressed("Today")).toBe("false");
  });

  it("asks for two dates only when the period is custom, neither after today", async () => {
    const seen = vi.fn();
    render(<Host seen={seen} />);
    expect(screen.queryByLabelText("From date")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "Custom" }));
    const from = screen.getByLabelText("From date") as HTMLInputElement;
    const to = screen.getByLabelText("To date") as HTMLInputElement;
    expect(from.type).toBe("date");
    expect(from.max).toBe(todayIST());
    expect(to.max).toBe(todayIST());

    fireEvent.change(from, { target: { value: "2026-11-01" } });
    expect(seen).toHaveBeenLastCalledWith({ kind: "custom", from: "2026-11-01", to: "" });
    fireEvent.change(to, { target: { value: "2026-11-10" } });
    expect(seen).toHaveBeenLastCalledWith({ kind: "custom", from: "2026-11-01", to: "2026-11-10" });
  });

  it("offers only the periods it is given", () => {
    render(<Host kinds={CHART_PERIODS} seen={vi.fn()} />);
    expect(buttons()).toEqual(["Past 7 days", "This month", "Custom"]);
  });

  it("speaks Hindi", () => {
    render(<Host seen={vi.fn()} lang="hi" />);
    expect(screen.getByRole("group", { name: "अवधि" })).toBeTruthy();
    expect(buttons()).toEqual(["आज", "पिछले 7 दिन", "इस माह", "कस्टम"]);
  });
});
```

- [ ] **Step 4: Write the Anchal section's tests** — `tests/ui/dashboard-anchal.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AnchalSection from "../../src/client/pages/dashboard/AnchalSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import services from "../../src/shared/services.json";
import { anchalRow, paths, renderWithin, route } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const table = () => screen.getByRole("table");
const head = () => Array.from(table().querySelectorAll("thead th")).map((th) => th.textContent!.trim());
const cells = (row: Element) => Array.from(row.querySelectorAll("td")).map((td) => td.textContent!.trim());
const bodyRows = () => Array.from(table().querySelectorAll("tbody tr"));
const totalRow = () => table().querySelector("tfoot tr")!;
const lastPath = () => paths(api, "/dashboard?").at(-1);

async function shown(lang: "en" | "hi" = "en", onStamp?: (stamp: string) => void) {
  renderWithin(<AnchalSection onStamp={onStamp} />, lang);
  await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0));
}

beforeEach(() => api.mockReset());
afterEach(() => cleanup());

describe("the Anchal-wise performance section", () => {
  it("shows what each Anchal received, disposed, has pending and collected, and the total", async () => {
    route(api, { anchals: [anchalRow(), anchalRow({ officeId: 2, received: 10, completed: 5, pending: 3, disposalPct: 50, amountPaise: 100000 })] });
    await shown();

    expect(screen.getByRole("heading", { level: 2, name: "Anchal-wise performance" })).toBeTruthy();
    expect(head()).toEqual(["Anchal", "Received", "Disposed", "Pending", "Disposal %", "Collected (₹)"]);
    expect(cells(bodyRows()[0])).toEqual(["Anchal 1", "40", "30", "12", "75.0%", "₹2,500.00"]);
    expect(cells(bodyRows()[1])).toEqual(["Anchal 2", "10", "5", "3", "50.0%", "₹1,000.00"]);
    expect(cells(totalRow())).toEqual(["TOTAL", "50", "35", "15", "70.0%", "₹3,500.00"]);
  });

  it("says it in Hindi", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown("hi");

    expect(screen.getByRole("heading", { level: 2, name: "अंचलवार प्रदर्शन" })).toBeTruthy();
    expect(head()).toEqual(["अंचल", "प्राप्त", "निस्तारित", "लंबित", "निस्तारण %", "संग्रहित (₹)"]);
    expect(cells(bodyRows()[0])[0]).toBe("अंचल 1");
    expect(cells(totalRow())[0]).toBe("कुल");
  });

  it("asks for today first, and for the period chosen after that", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown();
    expect(paths(api, "/dashboard?")[0]).toBe(`/dashboard?from=${today}&to=${today}`);

    await userEvent.setup().click(screen.getByRole("button", { name: "Past 7 days" }));
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${addDays(today, -6)}&to=${today}`));

    await userEvent.setup().click(screen.getByRole("button", { name: "This month" }));
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${today.slice(0, 8)}01&to=${today}`));
  });

  it("offers the ten daily services in the entry form's order and numbering, and pins to the one chosen", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown();
    const select = screen.getByLabelText("Service") as HTMLSelectElement;
    const name = (id: number) => services.find((s) => s.id === id)!.en;

    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "All 10 services",
      ...OFFERED_IDS.map((id) => `${servicePosition(id)} · ${name(id)}`),
    ]);

    await userEvent.setup().selectOptions(select, "11");
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${today}&to=${today}&serviceId=11`));
  });

  // Blank means the service does not record the figure; zero means nothing happened.
  it.each([
    ["a collection, which keeps no queue", "2", ["Anchal 1", "", "", "", "", "₹2,500.00"]],
    ["a queue that takes no money", "11", ["Anchal 1", "40", "30", "12", "75.0%", ""]],
    ["a queue that also takes a fee", "1", ["Anchal 1", "40", "30", "12", "75.0%", "₹2,500.00"]],
  ])("pinned to %s, leaves blank what that service does not record", async (_, serviceId, expected) => {
    route(api, { anchals: [anchalRow()] });
    await shown();

    await userEvent.setup().selectOptions(screen.getByLabelText("Service"), serviceId);
    await waitFor(() => expect(lastPath()).toContain(`serviceId=${serviceId}`));

    await waitFor(() => expect(cells(bodyRows()[0])).toEqual(expected));
    expect(cells(totalRow()).slice(1)).toEqual(expected.slice(1));
  });

  it("asks for nothing while the custom period cannot be asked for, and says why once both dates are in", async () => {
    route(api, { anchals: [anchalRow()] });
    await shown();
    await userEvent.setup().click(screen.getByRole("button", { name: "Custom" }));
    const asked = api.mock.calls.length;

    fireEvent.change(screen.getByLabelText("From date"), { target: { value: addDays(today, -5) } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("To date"), { target: { value: addDays(today, -10) } });

    expect(screen.getByRole("alert").textContent).toBe("Start date must be on or before the end date.");
    expect(api.mock.calls.length).toBe(asked);

    fireEvent.change(screen.getByLabelText("To date"), { target: { value: addDays(today, -1) } });
    await waitFor(() => expect(lastPath()).toBe(`/dashboard?from=${addDays(today, -5)}&to=${addDays(today, -1)}`));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["en", "Invalid reporting filters"],
    ["hi", "रिपोर्टिंग फ़िल्टर गलत हैं"],
  ] as const)("shows the server's refusal inside its own card (%s)", async (lang, message) => {
    api.mockRejectedValue(new Error("Invalid reporting filters"));
    renderWithin(<AnchalSection />, lang);

    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });

  it("carries nothing about filing", async () => {
    route(api, { anchals: [anchalRow({ submitted: 7, expected: 10 })] });
    await shown();

    expect(document.body.textContent).not.toMatch(/filed|reports|7 \/ 10/i);
  });

  it("passes the time of its figures upward", async () => {
    const onStamp = vi.fn();
    route(api, { anchals: [anchalRow()], updatedAt: "2026-11-20T05:00:00.000Z" });
    await shown("en", onStamp);

    await waitFor(() => expect(onStamp).toHaveBeenLastCalledWith("2026-11-20T05:00:00.000Z"));
  });
});
```

- [ ] **Step 5: Write the page's tests** — `tests/ui/dashboard-page.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Dashboard from "../../src/client/pages/Dashboard";
import { anchalRow, renderWithin, route } from "./dashboard-harness";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

beforeEach(() => api.mockReset());
afterEach(() => cleanup());

describe("the Commissioner's dashboard page", () => {
  it("has one page heading and opens with the Anchal-wise performance section", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");

    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Office monitoring dashboard"]);
    expect(screen.getAllByRole("heading", { level: 2 })[0].textContent).toBe("Anchal-wise performance");
    expect(document.querySelector("main")).toBeNull();
  });

  it("has no filing status, no tiles and no page-wide filter", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");

    expect(document.body.textContent).not.toMatch(/Filed today|Filing status|Total pending|Total collection|reports/);
    expect(document.querySelector("[data-metric]")).toBeNull();
    expect(screen.queryByLabelText("View")).toBeNull();
  });

  it("refreshes every section from the one Refresh button", async () => {
    route(api, { anchals: [anchalRow()] });
    const client = renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");
    const spy = vi.spyOn(client, "invalidateQueries");

    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ["dashboard"] }));
  });
});
```

- [ ] **Step 6: Point the "figures as of" tests at the harness**

In `tests/ui/dashboard-as-of.test.tsx`, add `import { route } from "./dashboard-harness";` and replace the whole `respond` function with:

```tsx
function respond(payload: { updatedAt?: string; retrievedAt?: string }) {
  route(api, payload);
}
```

Change nothing else in that file. Every test in it must still pass after Step 8: it pins the "Figures as of" line, the 15-second poll, the refresh on focus, and that no WebSocket is opened.

- [ ] **Step 7: Delete the two old test files and watch the new ones fail**

```bash
cd /home/claude/work && git rm -q tests/ui/dashboard.test.tsx tests/ui/dashboard-shapes.test.tsx
npx vitest run tests/ui/dashboard-period-picker.test.tsx tests/ui/dashboard-anchal.test.tsx tests/ui/dashboard-page.test.tsx 2>&1 | grep -E "Test Files|Tests |Failed to resolve" | head
```

Expected: the picker and Anchal files fail to resolve their imports; the page file fails on the filing text and tiles that are still there.

What those two deleted files pinned, and where it lives now: the filing panel, the tiles and their notes are removed by design; the Anchal table's columns, blank-not-zero pinning and service list are in `dashboard-anchal.test.tsx`; the audit labels are in `audit-retired-fields.test.ts`; "figures as of" and the refresh are still in `dashboard-as-of.test.tsx`.

- [ ] **Step 8: Build the pieces, then rewrite `Dashboard.tsx`**, as described under "What each piece does".

- [ ] **Step 9: Run everything**

`npx vitest run && npx tsc --noEmit`. Expected: all passing, tsc silent. If a test elsewhere fails because it looked for something the dashboard no longer has, report it by name rather than editing it — none is expected.

- [ ] **Step 10: Commit** (frontend)

```
feat: the dashboard opens with Anchal-wise performance and its own filters; filing status is gone
```

---

### Task 5: Service-wise progress (frontend) — Sonnet

**Files:**
- Create: `src/client/pages/dashboard/ServiceSection.tsx`
- Modify: `src/client/pages/Dashboard.tsx` (add the section after `AnchalSection`)
- Create test: `tests/ui/dashboard-services.test.tsx`

**Consumes:** `SectionCard`, `PeriodPicker`, `AnchalFilter`, `useSection`, `currency`, `percent` (Task 4); `DAILY_SERVICES`, `displayNumber`, `formatCount`, `getServiceRows` (Task 3).

**Produces:** `export default function ServiceSection(): JSX.Element`.

**What it does.** Its own period (starting on `today`) and Anchal. `useSection("services", period, { officeId }, getServiceRows)`. Title `Service-wise progress` / `सेवावार प्रगति`. Subtitle `` `The ${n} daily services. A blank means the service does not record that figure.` `` / `` `${n} दैनिक सेवाएँ। खाली स्थान का अर्थ है कि वह सेवा यह आंकड़ा दर्ज नहीं करती।` `` where `n` is `DAILY_SERVICES.length`. Filters: `PeriodPicker`, then `AnchalFilter`.

A table built the way the Anchal table is (`<Table role="table" className={cardTable} containerClassName={cardTableWrap}>` with `Th` and `Td`), inside a scroll region labelled `Service-wise progress table` / `सेवावार प्रगति तालिका`, with one body row per entry of `DAILY_SERVICES`, in that order, and a total row. Columns:

| Column (en / hi) | Cell |
|---|---|
| `No.` / `क्र.` | `displayNumber(id)` |
| `Service` / `सेवा` | the service's name; for a service that keeps no queue, a second muted line `` `${formatCount(received)} payments` `` / `` `${formatCount(received)} भुगतान` `` |
| `Received` | `formatCount(received)` if `movesPendingBalance(id)`, else blank |
| `Disposed` | `formatCount(completed)` if `movesPendingBalance(id)`, else blank |
| `Disposal %` | `percent(disposalPct)` if `movesPendingBalance(id)`, else blank |
| `Pending` | if `movesPendingBalance(id)`: a small horizontal bar and `formatCount(pending)`; else blank |
| `Collected (₹)` | `currency(amountPaise)` if `collects(id, "amountPaise")`, else blank |

Match each `DAILY_SERVICES` entry to the server's row by `serviceId`; a service the server did not send reads as zeros. The bar is one element with `data-pending-bar` and an inline `width` of `` `${largest === 0 ? 0 : (pending / largest) * 100}%` ``, where `largest` is the largest pending among the rows; it is decoration (`aria-hidden`), `bg-chart-1` on a `bg-muted` track.

Total row: an empty first cell, then `TOTAL`; Received and Disposed summed over the services that keep a queue; Disposal % is `percent(received === 0 ? null : (completed / received) * 100)` of those sums; Pending summed (number only, no bar); Collected summed over all rows.

A ratio with nothing received prints `—`, exactly as the Anchal table does today. That is a third thing, distinct from blank and from zero: there was a queue, and no ratio to give.

- [ ] **Step 1: Write the failing tests** — `tests/ui/dashboard-services.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceSection from "../../src/client/pages/dashboard/ServiceSection";
import { todayIST } from "../../src/domain/ledger";
import services from "../../src/shared/services.json";
import { paths, renderWithin, route, serviceRow } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const name = (id: number, lang: "en" | "hi" = "en") => { const s = services.find((x) => x.id === id)!; return lang === "hi" ? s.name : s.en; };
const table = () => screen.getByRole("table");
const head = () => Array.from(table().querySelectorAll("thead th")).map((th) => th.textContent!.trim());
const cells = (row: Element) => Array.from(row.querySelectorAll("td")).map((td) => td.textContent!.trim());
const bodyRows = () => Array.from(table().querySelectorAll("tbody tr"));
const rowOf = (id: number) => bodyRows()[OFFERED_IDS.indexOf(id)];
const totalRow = () => table().querySelector("tfoot tr")!;

// One of each kind carries figures; the other seven are at zero.
const figures = OFFERED_IDS.map((id) =>
  id === 1 ? serviceRow(1, { received: 64, completed: 52, pending: 412, disposalPct: 81.25, amountPaise: 12800000 })
  : id === 11 ? serviceRow(11, { received: 121, completed: 118, pending: 206, disposalPct: 97.52 })
  : id === 2 ? serviceRow(2, { received: 212, amountPaise: 76430000 })
  : serviceRow(id));

async function shown(lang: "en" | "hi" = "en") {
  renderWithin(<ServiceSection />, lang);
  await waitFor(() => expect(cells(rowOf(1))[2]).toBe("64"));
}

beforeEach(() => { api.mockReset(); route(api, { services: figures }); });
afterEach(() => cleanup());

describe("the service-wise progress section", () => {
  it("lists the ten daily services in the entry form's order, numbered as the form numbers them", async () => {
    await shown();

    expect(screen.getByRole("heading", { level: 2, name: "Service-wise progress" })).toBeTruthy();
    expect(head()).toEqual(["No.", "Service", "Received", "Disposed", "Disposal %", "Pending", "Collected (₹)"]);
    expect(bodyRows().map((row) => cells(row)[0])).toEqual(OFFERED_IDS.map(servicePosition));
    expect(cells(rowOf(1))[1]).toBe(name(1));
  });

  it("shows a queue-and-fee service in full, and a queue-only service with its collection blank", async () => {
    await shown();

    expect(cells(rowOf(1)).slice(2)).toEqual(["64", "52", "81.3%", "412", "₹1,28,000.00"]);
    expect(cells(rowOf(11)).slice(2)).toEqual(["121", "118", "97.5%", "206", ""]);
  });

  it("shows a collection as its payments and its amount, with every queue figure blank", async () => {
    await shown();

    expect(cells(rowOf(2))[1]).toContain(name(2));
    expect(cells(rowOf(2))[1]).toContain("212 payments");
    expect(cells(rowOf(2)).slice(2)).toEqual(["", "", "", "", "₹7,64,300.00"]);
    expect(cells(rowOf(1))[1]).not.toContain("payments");
  });

  it("prints zero for a queue with nothing in it, and a dash for a ratio with nothing received", async () => {
    await shown();

    // Service 3 keeps a queue and takes a fee; nothing was filed for it.
    expect(cells(rowOf(3)).slice(2)).toEqual(["0", "0", "—", "0", "₹0.00"]);
  });

  it("totals the queue figures over the services that keep a queue, and the collection over all", async () => {
    await shown();

    expect(cells(totalRow())).toEqual(["", "TOTAL", "185", "170", "91.9%", "618", "₹8,92,300.00"]);
  });

  it("draws each pending bar against the largest pending", async () => {
    await shown();
    const width = (id: number) => (rowOf(id).querySelector("[data-pending-bar]") as HTMLElement).style.width;

    expect(width(1)).toBe("100%");
    expect(width(11)).toBe("50%");
    expect(width(3)).toBe("0%");
    expect(rowOf(2).querySelector("[data-pending-bar]")).toBeNull();
  });

  it("asks for today across all offices first, and narrows to the Anchal chosen", async () => {
    await shown();
    expect(paths(api, "/dashboard/services")[0]).toBe(`/dashboard/services?from=${today}&to=${today}`);

    await userEvent.setup().selectOptions(screen.getByLabelText("Anchal"), "3");

    await waitFor(() => expect(paths(api, "/dashboard/services").at(-1)).toBe(`/dashboard/services?from=${today}&to=${today}&officeId=3`));
  });

  it("says it in Hindi", async () => {
    await shown("hi");

    expect(screen.getByRole("heading", { level: 2, name: "सेवावार प्रगति" })).toBeTruthy();
    expect(head()).toEqual(["क्र.", "सेवा", "प्राप्त", "निस्तारित", "निस्तारण %", "लंबित", "संग्रहित (₹)"]);
    expect(cells(rowOf(2))[1]).toContain(name(2, "hi"));
    expect(cells(rowOf(2))[1]).toContain("212 भुगतान");
    expect(cells(totalRow())[1]).toBe("कुल");
  });

  it("stays standing with all ten rows at zero when the server sends nothing", async () => {
    route(api, { services: [] });
    renderWithin(<ServiceSection />);

    await waitFor(() => expect(bodyRows().length).toBe(10));
    expect(cells(rowOf(1)).slice(2)).toEqual(["0", "0", "—", "0", "₹0.00"]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run tests/ui/dashboard-services.test.tsx`. Expected: the import does not resolve.

- [ ] **Step 3: Build `ServiceSection.tsx`** as described, and add `<ServiceSection />` to `Dashboard.tsx` directly after `<AnchalSection … />`.

- [ ] **Step 4: Run everything** — `npx vitest run && npx tsc --noEmit`. All passing, tsc silent.

- [ ] **Step 5: Commit** (frontend)

```
feat: the dashboard shows progress service by service
```

---

### Task 6: The chart component (frontend) — Sonnet

**Files:**
- Create: `src/client/pages/dashboard/charts/DayChart.tsx`
- Create test: `tests/ui/dashboard-chart.test.tsx`

**Consumes:** `axis`, `xAt`, `labelIndexes` from `charts/scale.ts` (Task 3); `Button`, `Table`, `Th`, `Td` from `src/client/ui`.

**Produces:**

```tsx
export type ChartSeries = { label: string; colour: 1 | 2 };       // colour picks the chart-1 or chart-2 token
export function dayLabel(date: string, lang: "en" | "hi"): string; // "5 Nov" / "5 नव॰"
export default function DayChart(props: {
  kind: "bars" | "lines";
  title: string;                                   // the chart's accessible name
  days: { date: string; values: number[] }[];      // values[i] belongs to series[i]
  series: ChartSeries[];
  format: (value: number) => string;               // used in the tooltip and the table
  formatAxis?: (value: number) => string;          // used on the axis and the end labels; defaults to `format`
}): JSX.Element;
```

**What it draws.** One component for both charts, because they share everything but the marks.

- A button above the chart reading `View as table` / `तालिका के रूप में देखें`; pressed, it reads `View as chart` / `चार्ट के रूप में देखें` and the chart is replaced by a table.
- **Chart view:** an `<svg role="img" aria-label={title}>` with `viewBox="0 0 1170 240"`, class `block h-auto w-full min-w-[640px]`, inside a `div` with `overflow-x-auto`, so it scales with the card and scrolls sideways on a phone. Plot area: left 56, right 1110, top 16, bottom 200.
  - Value axis: `axis(largest value in the data)`; one horizontal grid line per tick (`stroke-border`), and the tick's `formatAxis` text at the left (`fill-muted-foreground`, mono, 11px).
  - Day axis: for each index in `labelIndexes(days.length)`, the day's `dayLabel` under the plot, each a `<text data-x-label>`.
  - `kind="bars"` (one series): one `<path data-bar>` per day, top corners rounded 3px, bottom square, on the baseline, filled with the series colour. Width is 60% of the space per day, at least 3 and at most 40. A zero day still has its `data-bar` element, with no height.
  - `kind="lines"`: one `<polyline data-line>` per series, 2px, no fill, stroked with the series colour; a 4px dot on each line's last point ringed in the card colour; and the last value, through `formatAxis`, as a `<text data-end-label>` just right of the dot in the page's text colour.
  - A legend, a `div data-legend` above the chart, **only when there are two or more series**: a swatch and the label for each. Legend and end-label text are in the page's text colours, never a series colour.
  - Hover and keyboard: one transparent `<rect data-day>` per day spanning the plot's height, focusable (`tabIndex={0}`), with an `aria-label` reading `` `${dayLabel}: ${series label} ${format(value)}` `` for each series joined by `, `. Mouse-enter or focus makes that day active; mouse-leave or blur clears it. While a day is active, a `<g data-chart-tooltip>` shows the day's label and one line per series, `` `${label} ${format(value)}` ``, in a small box (`fill-card stroke-border`) kept inside the plot.
- **Table view:** a `Table` with a `Date` / `तिथि` column and one column per series; one row per day, the day's `dayLabel` and each value through `format`.
- Colours come only from tokens. Tailwind must see the class names written out, so map them as literals: `{ 1: { fill: "fill-chart-1", stroke: "stroke-chart-1", swatch: "bg-chart-1" }, 2: { fill: "fill-chart-2", stroke: "stroke-chart-2", swatch: "bg-chart-2" } }`.
- It must never print `NaN`: no days, one day, and all-zero days each draw the frame. `axis(0)` and `xAt` with one mark already handle this; do not divide by a day count or a range without going through them.

`dayLabel` is `new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`))`.

- [ ] **Step 1: Write the failing tests** — `tests/ui/dashboard-chart.test.tsx`

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DayChart, { dayLabel } from "../../src/client/pages/dashboard/charts/DayChart";

type Day = { date: string; values: number[] };
const month: Day[] = Array.from({ length: 28 }, (_, i) => ({
  date: `2026-11-${String(i + 1).padStart(2, "0")}`,
  values: [400 + i, 360 + i],
}));
const two = [{ label: "Received", colour: 1 as const }, { label: "Disposed", colour: 2 as const }];
const one = [{ label: "Collected", colour: 1 as const }];
const plain = (value: number) => String(value);

function show(props: Partial<Parameters<typeof DayChart>[0]> = {}, lang: "en" | "hi" = "en") {
  render(
    <Language.Provider value={lang}>
      <DayChart kind="lines" title="Received and disposed per day" days={month} series={two} format={plain} {...props} />
    </Language.Provider>,
  );
}
const all = (selector: string) => Array.from(document.querySelectorAll(selector));

afterEach(() => cleanup());

describe("the day chart", () => {
  it("is one named image, with a line and an end label for each series and a legend naming both", () => {
    show();

    expect(screen.getByRole("img", { name: "Received and disposed per day" })).toBeTruthy();
    expect(all("polyline[data-line]")).toHaveLength(2);
    expect(all("[data-end-label]").map((e) => e.textContent)).toEqual(["427", "387"]);
    expect(document.querySelector("[data-legend]")!.textContent).toContain("Received");
    expect(document.querySelector("[data-legend]")!.textContent).toContain("Disposed");
  });

  it("draws one bar per day, and no legend for a single series", () => {
    show({ kind: "bars", series: one, days: month.map((d) => ({ date: d.date, values: [d.values[0]] })) });

    expect(all("[data-bar]")).toHaveLength(28);
    expect(all("polyline[data-line]")).toHaveLength(0);
    expect(document.querySelector("[data-legend]")).toBeNull();
  });

  it("names a readable number of days on the axis and always the last", () => {
    show();
    const labels = all("[data-x-label]").map((e) => e.textContent);

    expect(labels.length).toBeLessThanOrEqual(8);
    expect(labels.at(-1)).toBe("28 Nov");
  });

  it("uses the compact form on the axis and the full form everywhere else", () => {
    show({ formatAxis: (value) => `${value / 100}h` });

    expect(all("[data-end-label]").map((e) => e.textContent)).toEqual(["4.27h", "3.87h"]);
    fireEvent.mouseEnter(all("[data-day]")[0]);
    expect(document.querySelector("[data-chart-tooltip]")!.textContent).toContain("Received 400");
  });

  it("shows a day's date and figures while the pointer or the keyboard is on it", () => {
    show();
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
    const day = all("[data-day]")[4];

    fireEvent.mouseEnter(day);
    const tip = document.querySelector("[data-chart-tooltip]")!.textContent!;
    expect(tip).toContain("5 Nov");
    expect(tip).toContain("Received 404");
    expect(tip).toContain("Disposed 364");
    fireEvent.mouseLeave(day);
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();

    fireEvent.focus(day);
    expect(document.querySelector("[data-chart-tooltip]")!.textContent).toContain("5 Nov");
    fireEvent.blur(day);
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
  });

  it("gives every day a name a screen reader can read, and lets the keyboard reach it", () => {
    show();
    const day = all("[data-day]")[4];

    expect(all("[data-day]")).toHaveLength(28);
    expect(day.getAttribute("aria-label")).toBe("5 Nov: Received 404, Disposed 364");
    expect(day.getAttribute("tabindex")).toBe("0");
  });

  it("turns into a table of the same days and back", async () => {
    show();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.queryByRole("img")).toBeNull();
    const rows = Array.from(screen.getByRole("table").querySelectorAll("tbody tr"));
    expect(Array.from(screen.getByRole("table").querySelectorAll("thead th")).map((th) => th.textContent!.trim())).toEqual(["Date", "Received", "Disposed"]);
    expect(rows).toHaveLength(28);
    expect(Array.from(rows[4].querySelectorAll("td")).map((td) => td.textContent!.trim())).toEqual(["5 Nov", "404", "364"]);

    await user.click(screen.getByRole("button", { name: "View as chart" }));
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it.each([
    ["no days at all", []],
    ["a single day", [{ date: "2026-11-28", values: [418, 371] }]],
    ["days with nothing filed", month.map((d) => ({ date: d.date, values: [0, 0] }))],
  ])("draws its frame for %s, with no NaN anywhere", (_, days) => {
    show({ days: days as Day[] });

    expect(screen.getByRole("img")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("NaN");
    expect(document.body.innerHTML).not.toContain("Infinity");
  });

  it("speaks Hindi, dates included", async () => {
    show({}, "hi");

    expect(all("[data-x-label]").at(-1)!.textContent).toBe(dayLabel("2026-11-28", "hi"));
    expect(dayLabel("2026-11-28", "hi")).not.toBe(dayLabel("2026-11-28", "en"));
    await userEvent.setup().click(screen.getByRole("button", { name: "तालिका के रूप में देखें" }));
    expect(screen.getByRole("table").querySelector("thead th")!.textContent!.trim()).toBe("तिथि");
    expect(screen.getByRole("button", { name: "चार्ट के रूप में देखें" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run tests/ui/dashboard-chart.test.tsx`. Expected: the import does not resolve.

- [ ] **Step 3: Build `DayChart.tsx`** as described.

- [ ] **Step 4: Run everything** — `npx vitest run && npx tsc --noEmit`. All passing, tsc silent.

- [ ] **Step 5: Commit** (frontend)

```
feat: a day chart for the dashboard: bars or lines, a tooltip per day, and a table of the same days
```

---

### Task 7: Collection, and Received and disposed (frontend) — Sonnet

**Files:**
- Create: `src/client/pages/dashboard/CollectionSection.tsx`, `src/client/pages/dashboard/TrendSection.tsx`
- Modify: `src/client/pages/dashboard/format.ts` (add `compactRupees`), `src/client/pages/Dashboard.tsx` (add both sections after `ServiceSection`, Collection first), `src/client/i18n.tsx`, `tests/ui/password-reset-midsession.test.tsx`
- Create tests: `tests/ui/dashboard-collection.test.tsx`, `tests/ui/dashboard-trend.test.tsx`

**Consumes:** `DayChart` (Task 6); `SectionCard`, `PeriodPicker`, `CHART_PERIODS`, `AnchalFilter`, `ServiceFilter`, `useSection`, `currency` (Task 4); `DAILY_SERVICES`, `formatCount`, `getDayRows` (Task 3); `collects`, `movesPendingBalance` from `src/domain/service-kind`.

**Produces:** `export default function CollectionSection(): JSX.Element`, `export default function TrendSection(): JSX.Element`, and in `format.ts` `export function compactRupees(paise: number, lang: "en" | "hi"): string` — `"₹" + new Intl.NumberFormat(lang === "hi" ? "hi-IN" : "en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(paise / 100)`, giving `₹14.8L` in English.

**Both sections** hold their own period starting `{ kind: "month", from: "", to: "" }`, offer `kinds={CHART_PERIODS}`, and have an Anchal and a service filter. Both call `useSection(name, period, { officeId, serviceId }, getDayRows)` — with different names, `"collection"` and `"trend"`, so their queries are separate.

- **`CollectionSection`**: title `Collection` / `संग्रह`; subtitle `Amount collected per day: fees on applications and the collections together.` / `प्रतिदिन संग्रहित राशि: आवेदनों के शुल्क और संग्रह, दोनों।` Filters in this order: `PeriodPicker`, `AnchalFilter`, `ServiceFilter` with `services` = the `DAILY_SERVICES` for which `collects(id, "amountPaise")` and `allLabel` `` `All ${n} that collect` `` / `` `राशि लेने वाली सभी ${n} सेवाएँ` ``. At the right of the filter row (the card's `aside` or the row's end), the label `Collected in this period` / `इस अवधि में संग्रहित` over the sum of the days' `amountPaise` through `currency`, in an element with `data-collection-total`. Then `<DayChart kind="bars" series={[{ label: t("Collected", "संग्रहित"), colour: 1 }]} days={rows.map((r) => ({ date: r.date, values: [r.amountPaise] }))} format={currency} formatAxis={(p) => compactRupees(p, lang)} title={…} />`, where the title is `` `Collection per day, ${range.from} to ${range.to}` `` / `` `प्रतिदिन संग्रह, ${range.from} से ${range.to}` ``.
- **`TrendSection`**: title `Received and disposed` / `प्राप्त और निस्तारित`; subtitle `Applications per day` / `प्रतिदिन आवेदन`. Filters in this order: `PeriodPicker`, `ServiceFilter` with `services` = the `DAILY_SERVICES` for which `movesPendingBalance(id)` and `allLabel` `` `All ${n} with applications` `` / `` `आवेदन वाली सभी ${n} सेवाएँ` ``, then `AnchalFilter`. Then `<DayChart kind="lines" series={[{ label: t("Received", "प्राप्त"), colour: 1 }, { label: t("Disposed", "निस्तारित"), colour: 2 }]} days={rows.map((r) => ({ date: r.date, values: [r.received, r.completed] }))} format={formatCount} title={…} />`, title `` `Received and disposed per day, ${range.from} to ${range.to}` `` / `` `प्रतिदिन प्राप्त और निस्तारित, ${range.from} से ${range.to}` ``.

The server refuses a period over 92 days with `Choose a period of 92 days or fewer`; `useSection` already puts that in the card. This task gives it its Hindi.

- [ ] **Step 1: Write the failing tests**

`tests/ui/dashboard-collection.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollectionSection from "../../src/client/pages/dashboard/CollectionSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import { collects } from "../../src/domain/service-kind";
import services from "../../src/shared/services.json";
import { dayRow, paths, renderWithin, route } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const monthStart = `${today.slice(0, 8)}01`;
const days = [dayRow(addDays(today, -2), { amountPaise: 50000 }), dayRow(addDays(today, -1)), dayRow(today, { amountPaise: 30000 })];
const lastPath = () => paths(api, "/dashboard/days").at(-1);
const bars = () => document.querySelectorAll("[data-bar]").length;

beforeEach(() => { api.mockReset(); route(api, { days }); });
afterEach(() => cleanup());

describe("the collection section", () => {
  it("opens on this month, with a bar per day and the period's total", async () => {
    renderWithin(<CollectionSection />);
    await waitFor(() => expect(bars()).toBe(3));

    expect(screen.getByRole("heading", { level: 2, name: "Collection" })).toBeTruthy();
    expect(paths(api, "/dashboard/days")[0]).toBe(`/dashboard/days?from=${monthStart}&to=${today}`);
    expect(document.querySelector("[data-collection-total]")!.textContent).toContain("₹800.00");
  });

  it("offers the past 7 days, this month and a custom period, and never a single day", async () => {
    renderWithin(<CollectionSection />);
    await waitFor(() => expect(bars()).toBe(3));

    expect(within(screen.getByRole("group", { name: "Period" })).getAllByRole("button").map((b) => b.textContent))
      .toEqual(["Past 7 days", "This month", "Custom"]);
    await userEvent.setup().click(screen.getByRole("button", { name: "Past 7 days" }));
    await waitFor(() => expect(lastPath()).toBe(`/dashboard/days?from=${addDays(today, -6)}&to=${today}`));
  });

  it("offers only the services that collect an amount, and narrows by Anchal and by service", async () => {
    renderWithin(<CollectionSection />);
    await waitFor(() => expect(bars()).toBe(3));
    const collecting = OFFERED_IDS.filter((id) => collects(id, "amountPaise"));
    const select = screen.getByLabelText("Service") as HTMLSelectElement;

    expect(collecting).toHaveLength(7);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "All 7 that collect",
      ...collecting.map((id) => `${servicePosition(id)} · ${services.find((s) => s.id === id)!.en}`),
    ]);

    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText("Anchal"), "4");
    await user.selectOptions(select, "2");
    await waitFor(() => expect(lastPath()).toBe(`/dashboard/days?from=${monthStart}&to=${today}&officeId=4&serviceId=2`));
  });

  it.each([
    ["en", "Choose a period of 92 days or fewer"],
    ["hi", "92 दिन या उससे कम की अवधि चुनें"],
  ] as const)("shows the server's refusal of too long a period (%s)", async (lang, message) => {
    api.mockRejectedValue(new Error("Choose a period of 92 days or fewer"));
    renderWithin(<CollectionSection />, lang);

    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });

  it("says it in Hindi", async () => {
    renderWithin(<CollectionSection />, "hi");
    await waitFor(() => expect(bars()).toBe(3));

    expect(screen.getByRole("heading", { level: 2, name: "संग्रह" })).toBeTruthy();
    expect((screen.getByLabelText("सेवा") as HTMLSelectElement).options[0].textContent).toBe("राशि लेने वाली सभी 7 सेवाएँ");
  });
});
```

`tests/ui/dashboard-trend.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrendSection from "../../src/client/pages/dashboard/TrendSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import { movesPendingBalance } from "../../src/domain/service-kind";
import services from "../../src/shared/services.json";
import { dayRow, paths, renderWithin, route } from "./dashboard-harness";
import { OFFERED_IDS, servicePosition } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const monthStart = `${today.slice(0, 8)}01`;
const days = [dayRow(addDays(today, -1), { received: 402, completed: 368 }), dayRow(today, { received: 1418, completed: 371 })];
const lastPath = () => paths(api, "/dashboard/days").at(-1);
const lines = () => document.querySelectorAll("polyline[data-line]").length;

beforeEach(() => { api.mockReset(); route(api, { days }); });
afterEach(() => cleanup());

describe("the received and disposed section", () => {
  it("opens on this month, with a line each for received and disposed ending on the latest figures", async () => {
    renderWithin(<TrendSection />);
    await waitFor(() => expect(lines()).toBe(2));

    expect(screen.getByRole("heading", { level: 2, name: "Received and disposed" })).toBeTruthy();
    expect(paths(api, "/dashboard/days")[0]).toBe(`/dashboard/days?from=${monthStart}&to=${today}`);
    expect(document.querySelector("[data-legend]")!.textContent).toMatch(/Received.*Disposed/);
    expect(Array.from(document.querySelectorAll("[data-end-label]")).map((e) => e.textContent)).toEqual(["1,418", "371"]);
  });

  it("offers only the services that take applications, and narrows by service and by Anchal", async () => {
    renderWithin(<TrendSection />);
    await waitFor(() => expect(lines()).toBe(2));
    const queues = OFFERED_IDS.filter(movesPendingBalance);
    const select = screen.getByLabelText("Service") as HTMLSelectElement;

    expect(queues).toHaveLength(7);
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      "All 7 with applications",
      ...queues.map((id) => `${servicePosition(id)} · ${services.find((s) => s.id === id)!.en}`),
    ]);

    const user = userEvent.setup();
    await user.selectOptions(select, "11");
    await user.selectOptions(screen.getByLabelText("Anchal"), "2");
    await waitFor(() => expect(lastPath()).toBe(`/dashboard/days?from=${monthStart}&to=${today}&officeId=2&serviceId=11`));
  });

  it("never offers a single day", async () => {
    renderWithin(<TrendSection />);
    await waitFor(() => expect(lines()).toBe(2));

    expect(within(screen.getByRole("group", { name: "Period" })).getAllByRole("button").map((b) => b.textContent))
      .toEqual(["Past 7 days", "This month", "Custom"]);
  });

  it("says it in Hindi", async () => {
    renderWithin(<TrendSection />, "hi");
    await waitFor(() => expect(lines()).toBe(2));

    expect(screen.getByRole("heading", { level: 2, name: "प्राप्त और निस्तारित" })).toBeTruthy();
    expect(document.querySelector("[data-legend]")!.textContent).toMatch(/प्राप्त.*निस्तारित/);
    expect((screen.getByLabelText("सेवा") as HTMLSelectElement).options[0].textContent).toBe("आवेदन वाली सभी 7 सेवाएँ");
  });
});
```

In `tests/ui/password-reset-midsession.test.tsx`, add the row `"Choose a period of 92 days or fewer",` to the `it.each([...])` list under `describe("the Hindi for server messages")`.

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run tests/ui/dashboard-collection.test.tsx tests/ui/dashboard-trend.test.tsx tests/ui/password-reset-midsession.test.tsx`. Expected: the two imports do not resolve, and the Hindi key is missing.

- [ ] **Step 3: Add the Hindi key** in `src/client/i18n.tsx`, at the end of the same table that holds `"Invalid reporting filters"`:

```ts
  // MonitoringService.GetDashboardDaysAsync: a per-day series longer than the
  // charts can show. Drafted, not settled; waits on RMC's reviewer.
  "Choose a period of 92 days or fewer": "92 दिन या उससे कम की अवधि चुनें",
```

- [ ] **Step 4: Build both sections and `compactRupees`**, and add `<CollectionSection />` then `<TrendSection />` to `Dashboard.tsx` after `<ServiceSection />`.

- [ ] **Step 5: Run everything** — `npx vitest run && npx tsc --noEmit`. All passing, tsc silent.

- [ ] **Step 6: Commit** (frontend)

```
feat: the dashboard charts collection per day, and received against disposed
```

---

### Task 8: Field visits and the ward grid (frontend) — Sonnet

**Files:**
- Create: `src/client/pages/dashboard/FieldVisitsSection.tsx`, `src/client/pages/dashboard/WardSection.tsx`
- Modify: `src/client/pages/Dashboard.tsx` (add both **between** `AnchalSection` and `ServiceSection`, Field visits first)
- Create tests: `tests/ui/dashboard-visits.test.tsx`, `tests/ui/dashboard-wards.test.tsx`

**Consumes:** `visitCard`, `formatCount`, `getVisitSummary` (Task 3); `SectionCard`, `PeriodPicker`, `AnchalFilter`, `useSection` (Task 4); `WARD_MIN`, `WARD_MAX` from `src/domain/visit.ts`; `src/shared/services.json` for names.

**Produces:** `export default function FieldVisitsSection(): JSX.Element`, `export default function WardSection(): JSX.Element`.

**`FieldVisitsSection`.** Its own period (starting on `today`) and Anchal; `useSection("visits", period, { officeId }, getVisitSummary)`. Title `Field visits` / `क्षेत्रीय निरीक्षण`. Filters: `PeriodPicker`, then `AnchalFilter`.

- With no visits in the period: one line, in an element with `data-no-visits`, `No visits in this period.` / `इस अवधि में कोई निरीक्षण नहीं।`, and no cards.
- Otherwise a line in an element with `data-visit-count`: `` `${visits} ${visits === 1 ? "visit" : "visits"} by ${officers} ${officers === 1 ? "officer" : "officers"}. Each service counts its own thing, so there is no single total.` `` / `` `${officers} अधिकारियों द्वारा ${visits} निरीक्षण। हर सेवा अपनी ही चीज़ गिनती है, इसलिए कोई एक योग नहीं है।` ``; then one card per entry of `data.services`, in the server's order, each an `<article data-visit-card={serviceId}>` built from `visitCard(summary)`:
  - the service's name (an `<h3>`), and `` `${visits} ${visits === 1 ? "visit" : "visits"}` `` / `` `${visits} निरीक्षण` ``;
  - the headline: `formatCount(card.headline.value)` large and mono, followed by the headline's label;
  - the line beneath: `card.sub` in the page's language;
  - only when `card.missing > 0`, a line in the warning text colour (`text-warning`): `` `${card.missing} without a figure` `` / `` `${card.missing} में आंकड़ा नहीं` ``.
- Cards sit in a grid that is one column on a phone and four across on a wide screen (`grid gap-3 sm:grid-cols-2 xl:grid-cols-4`). There is no total across cards.

**`WardSection`.** Its own period (starting on `today`); no other filter. `useSection("wards", period, {}, getVisitSummary)` — a different name from the visits section, so the two never share a query even on the same period. Title `Where the visits were` / `निरीक्षण कहाँ हुए`. Subtitle `` `All ${WARD_MAX} wards. ${none} had no visit in this period.` `` / `` `सभी ${WARD_MAX} वार्ड। इस अवधि में ${none} वार्डों में कोई निरीक्षण नहीं हुआ।` ``, where `none` is the number of wards without a visit.

- A key, in an element with `data-ward-legend` passed as the card's `aside`: four swatches labelled `None` / `कोई नहीं`, `1`, `2`, `3 or more` / `3 या अधिक`.
- A `<ul>` of one `<li data-ward={n}>` per ward from `WARD_MIN` to `WARD_MAX`, showing the ward's number, shaded by its visits. Write the four class strings out as literals so Tailwind sees them:

  | Visits | Classes |
  |---|---|
  | 0 | `border border-border bg-card text-muted-foreground` |
  | 1 | `bg-ward-1 text-foreground` |
  | 2 | `bg-ward-2 text-foreground` |
  | 3 or more | `bg-ward-3 text-primary-foreground` |

  Each cell's `aria-label` is `` `Ward ${n}: ${visits === 0 ? "no visits" : visits === 1 ? "1 visit" : `${visits} visits`}` `` / `` `वार्ड ${n}: ${visits === 0 ? "कोई निरीक्षण नहीं" : `${visits} निरीक्षण`}` ``. The grid wraps: `grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5`.

- [ ] **Step 1: Write the failing tests**

`tests/ui/dashboard-visits.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FieldVisitsSection from "../../src/client/pages/dashboard/FieldVisitsSection";
import { todayIST } from "../../src/domain/ledger";
import services from "../../src/shared/services.json";
import { paths, renderWithin, route, visitService, visitSummary } from "./dashboard-harness";
import { FIELD_WORK_IDS } from "./service-position";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const card = (id: number) => document.querySelector(`[data-visit-card="${id}"]`)!;
const cards = () => Array.from(document.querySelectorAll("[data-visit-card]"));

// Waste vehicle with a quantity on seven of its nine visits; street dogs complete; street lighting by work type.
const busy = visitSummary({
  visits: 20, officers: 6,
  services: FIELD_WORK_IDS.map((id) =>
    id === 8 ? visitService(8, {
      visits: 9, wardsCovered: 6,
      numbers: [{ key: "quantityKg", sum: 4250, visits: 7 }],
      choices: [{ key: "wasteType", options: [
        { value: "wet", visits: 4, numbers: [{ key: "quantityKg", sum: 2100, visits: 4 }] },
        { value: "dry", visits: 2, numbers: [{ key: "quantityKg", sum: 1400, visits: 2 }] },
        { value: "mixed", visits: 1, numbers: [{ key: "quantityKg", sum: 750, visits: 1 }] },
      ] }],
    })
    : id === 10 ? visitService(10, { visits: 4, wardsCovered: 3, numbers: [{ key: "dogsPicked", sum: 27, visits: 4 }, { key: "dogsNeutered", sum: 20, visits: 4 }] })
    : id === 13 ? visitService(13, { visits: 7, wardsCovered: 5, choices: [{ key: "workType", options: [
        { value: "repair", visits: 4, numbers: [] }, { value: "replace", visits: 2, numbers: [] }, { value: "shift", visits: 1, numbers: [] },
      ] }] })
    : visitService(id)),
  wards: [{ ward: 24, visits: 3 }],
});

beforeEach(() => { api.mockReset(); route(api, { summary: busy }); });
afterEach(() => cleanup());

describe("the field visits section", () => {
  it("says how many visits by how many officers, and gives each field service its own card", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(screen.getByRole("heading", { level: 2, name: "Field visits" })).toBeTruthy();
    expect(document.querySelector("[data-visit-count]")!.textContent).toContain("20 visits by 6 officers");
    expect(cards().map((c) => Number(c.getAttribute("data-visit-card")))).toEqual(FIELD_WORK_IDS);
    expect(card(8).textContent).toContain(services.find((s) => s.id === 8)!.en);
  });

  it("shows what each service counts: a sum and its split, two sums, or jobs by kind", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    for (const text of ["9 visits", "4,250", "kg lifted", "Wet 2,100 · Dry 1,400 · Mixed 750"]) expect(card(8).textContent).toContain(text);
    for (const text of ["4 visits", "27", "dogs picked", "20 neutered"]) expect(card(10).textContent).toContain(text);
    for (const text of ["7 visits", "jobs", "Repair 4 · Replace 2 · Shift 1"]) expect(card(13).textContent).toContain(text);
  });

  it("says how many visits gave no figure, and only where some did not", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(card(8).textContent).toContain("2 without a figure");
    expect(card(10).textContent).not.toContain("without a figure");
    expect(card(13).textContent).not.toContain("without a figure");
  });

  it("uses the singular for one visit and one officer", async () => {
    route(api, { summary: visitSummary({ visits: 1, officers: 1, services: FIELD_WORK_IDS.map((id) => visitService(id, id === 9 ? { visits: 1, wardsCovered: 1 } : {})) }) });
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(document.querySelector("[data-visit-count]")!.textContent).toContain("1 visit by 1 officer.");
    expect(card(9).textContent).toContain("1 visit");
    expect(card(9).textContent).not.toContain("1 visits");
    expect(card(9).textContent).toContain("in 1 ward");
  });

  it("says so when there were no visits, and shows no cards", async () => {
    route(api, { summary: visitSummary() });
    renderWithin(<FieldVisitsSection />);

    await waitFor(() => expect(document.querySelector("[data-no-visits]")!.textContent).toBe("No visits in this period."));
    expect(cards()).toHaveLength(0);
    expect(document.querySelector("[data-visit-count]")).toBeNull();
  });

  it("asks for today across all offices first, and narrows to the Anchal chosen", async () => {
    renderWithin(<FieldVisitsSection />);
    await waitFor(() => expect(cards()).toHaveLength(8));
    expect(paths(api, "/field-visits/summary")[0]).toBe(`/field-visits/summary?from=${today}&to=${today}`);

    await userEvent.setup().selectOptions(screen.getByLabelText("Anchal"), "5");

    await waitFor(() => expect(paths(api, "/field-visits/summary").at(-1)).toBe(`/field-visits/summary?from=${today}&to=${today}&officeId=5`));
  });

  it("says it in Hindi", async () => {
    renderWithin(<FieldVisitsSection />, "hi");
    await waitFor(() => expect(cards()).toHaveLength(8));

    expect(screen.getByRole("heading", { level: 2, name: "क्षेत्रीय निरीक्षण" })).toBeTruthy();
    expect(document.querySelector("[data-visit-count]")!.textContent).toContain("6 अधिकारियों द्वारा 20 निरीक्षण");
    for (const text of [services.find((s) => s.id === 8)!.name, "9 निरीक्षण", "किग्रा उठाया", "गीला 2,100 · सूखा 1,400 · मिश्रित 750", "2 में आंकड़ा नहीं"])
      expect(card(8).textContent).toContain(text);
  });
});
```

`tests/ui/dashboard-wards.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WardSection from "../../src/client/pages/dashboard/WardSection";
import { todayIST } from "../../src/domain/ledger";
import { addDays } from "../../src/domain/period";
import { paths, renderWithin, route, visitSummary } from "./dashboard-harness";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const today = todayIST();
const ward = (n: number) => document.querySelector(`[data-ward="${n}"]`) as HTMLElement;
const wards = () => Array.from(document.querySelectorAll("[data-ward]"));
const visited = visitSummary({ visits: 11, officers: 4, wards: [{ ward: 3, visits: 1 }, { ward: 8, visits: 2 }, { ward: 24, visits: 3 }, { ward: 45, visits: 5 }] });

beforeEach(() => { api.mockReset(); route(api, { summary: visited }); });
afterEach(() => cleanup());

describe("the where-the-visits-were section", () => {
  it("shows all 53 wards in order, and says how many had no visit", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(screen.getByRole("heading", { level: 2, name: "Where the visits were" })).toBeTruthy();
    expect(wards().map((w) => w.textContent!.trim())).toEqual(Array.from({ length: 53 }, (_, i) => String(i + 1)));
    expect(document.body.textContent).toContain("All 53 wards. 49 had no visit in this period.");
  });

  it("shades a ward by its visits in four steps, three or more being the darkest", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(ward(1).className).toContain("bg-card");
    expect(ward(3).className).toContain("bg-ward-1");
    expect(ward(8).className).toContain("bg-ward-2");
    expect(ward(45).className).toContain("bg-ward-3");
    for (const n of [1, 3, 8]) expect(ward(n).className).not.toContain("bg-ward-3");
  });

  it("names each ward and its visits for someone who cannot see the shading", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(ward(1).getAttribute("aria-label")).toBe("Ward 1: no visits");
    expect(ward(3).getAttribute("aria-label")).toBe("Ward 3: 1 visit");
    expect(ward(24).getAttribute("aria-label")).toBe("Ward 24: 3 visits");
  });

  it("has a key for the four steps", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));
    const key = document.querySelector("[data-ward-legend]")!.textContent!;

    for (const text of ["None", "1", "2", "3 or more"]) expect(key).toContain(text);
  });

  it("has a period of its own and no other filter", async () => {
    renderWithin(<WardSection />);
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));
    expect(paths(api, "/field-visits/summary")[0]).toBe(`/field-visits/summary?from=${today}&to=${today}`);
    expect(screen.queryByLabelText("Anchal")).toBeNull();
    expect(screen.queryByLabelText("Service")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "Past 7 days" }));

    await waitFor(() => expect(paths(api, "/field-visits/summary").at(-1)).toBe(`/field-visits/summary?from=${addDays(today, -6)}&to=${today}`));
  });

  it("shows every ward empty when there were no visits", async () => {
    route(api, { summary: visitSummary() });
    renderWithin(<WardSection />);

    await waitFor(() => expect(document.body.textContent).toContain("All 53 wards. 53 had no visit in this period."));
    expect(wards().every((w) => w.className.includes("bg-card"))).toBe(true);
  });

  it("says it in Hindi", async () => {
    renderWithin(<WardSection />, "hi");
    await waitFor(() => expect(ward(24).className).toContain("bg-ward-3"));

    expect(screen.getByRole("heading", { level: 2, name: "निरीक्षण कहाँ हुए" })).toBeTruthy();
    expect(document.body.textContent).toContain("सभी 53 वार्ड। इस अवधि में 49 वार्डों में कोई निरीक्षण नहीं हुआ।");
    expect(ward(24).getAttribute("aria-label")).toBe("वार्ड 24: 3 निरीक्षण");
    expect(ward(1).getAttribute("aria-label")).toBe("वार्ड 1: कोई निरीक्षण नहीं");
    expect(document.querySelector("[data-ward-legend]")!.textContent).toContain("3 या अधिक");
  });
});
```

- [ ] **Step 2: Run them and watch them fail** — `npx vitest run tests/ui/dashboard-visits.test.tsx tests/ui/dashboard-wards.test.tsx`. Expected: the imports do not resolve.

- [ ] **Step 3: Build both sections** as described, and add `<FieldVisitsSection />` then `<WardSection />` to `Dashboard.tsx` between `<AnchalSection … />` and `<ServiceSection />`.

- [ ] **Step 4: Run everything** — `npx vitest run && npx tsc --noEmit`. All passing, tsc silent.

- [ ] **Step 5: Commit** (frontend)

```
feat: the dashboard shows field visits by service, and where they were by ward
```

---

### Task 9: The whole page: order, isolation, live specs and the handover (frontend) — Sonnet

**Files:**
- Modify test: `tests/ui/dashboard-page.test.tsx`
- Modify: `tests/browser/daily-form-live.spec.ts`, `tests/browser/design.spec.ts`
- Modify: `docs/handover/go-live-operational-checks.md`, `docs/superpowers/specs/2026-11-28-commissioner-dashboard-design.md`
- Modify only if a test below fails: `src/client/pages/Dashboard.tsx`

- [ ] **Step 1: Add the page-level tests** to `tests/ui/dashboard-page.test.tsx`. Extend the imports with `import { paths, visitService, visitSummary } from "./dashboard-harness";` (alongside the ones already there) and `import { FIELD_WORK_IDS } from "./service-position";`, and add inside the `describe`:

```tsx
  it("lays the six sections out in the agreed order", async () => {
    route(api, { anchals: [anchalRow()] });
    renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");

    await waitFor(() =>
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
        "Anchal-wise performance",
        "Field visits",
        "Where the visits were",
        "Service-wise progress",
        "Collection",
        "Received and disposed",
      ]),
    );
  });

  it("one section failing leaves the others standing, and says so in its own card", async () => {
    route(api, { anchals: [anchalRow()] });
    const answer = api.getMockImplementation()!;
    api.mockImplementation(async (path: string) => {
      if (path.startsWith("/dashboard/services")) throw new Error("Invalid reporting filters");
      return answer(path);
    });
    renderWithin(<Dashboard />);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Invalid reporting filters");
    expect(alert.closest("section")!.textContent).toContain("Service-wise progress");
    expect(screen.getByText("Anchal 1")).toBeTruthy();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("changing one section's filter asks nothing of the others", async () => {
    route(api, {
      anchals: [anchalRow()],
      summary: visitSummary({ visits: 1, officers: 1, services: FIELD_WORK_IDS.map((id) => visitService(id, id === 9 ? { visits: 1, wardsCovered: 1 } : {})) }),
    });
    renderWithin(<Dashboard />);
    await screen.findByText("Anchal 1");
    await waitFor(() => expect(paths(api, "/dashboard/days")).toHaveLength(2));
    await waitFor(() => expect(paths(api, "/field-visits/summary")).toHaveLength(2));
    const before = { days: paths(api, "/dashboard/days").length, visits: paths(api, "/field-visits/summary").length, services: paths(api, "/dashboard/services").length };

    const anchalCard = screen.getByRole("heading", { level: 2, name: "Anchal-wise performance" }).closest("section")!;
    const service = Array.from(anchalCard.querySelectorAll("select")).find((s) => s.options[0].textContent === "All 10 services")!;
    await userEvent.setup().selectOptions(service, "11");
    await waitFor(() => expect(paths(api, "/dashboard?").at(-1)).toContain("serviceId=11"));

    expect(paths(api, "/dashboard/days")).toHaveLength(before.days);
    expect(paths(api, "/field-visits/summary")).toHaveLength(before.visits);
    expect(paths(api, "/dashboard/services")).toHaveLength(before.services);
  });
```

- [ ] **Step 2: Run them.** `npx vitest run tests/ui/dashboard-page.test.tsx`. If Tasks 4–8 were done as written, all three pass at once — say so in your report; they are guards on the assembled page. If one fails, the fault is in `Dashboard.tsx`'s order or in a section sharing another's query: fix that, not the test.

- [ ] **Step 3: Bring the design's wording in line with what was built.** In `docs/superpowers/specs/2026-11-28-commissioner-dashboard-design.md`, the line under "What the figures mean" reads `- **Disposal %**: disposed over received for the period; blank when nothing was received.` Change `blank when nothing was received` to `shown as a dash when nothing was received, as the Anchal table already does`.

- [ ] **Step 4: Bring the browser specs in line with the page.** They need a live server and **cannot be run here**; say so plainly in your report. `npx playwright test --list` must still list them without an error.

In `tests/browser/daily-form-live.spec.ts`, the commissioner part (roughly lines 720–845) checks things the page no longer has. Known places:

| Looks for | Change |
|---|---|
| `[data-metrics] [data-metric]` having count 3, and the three tiles `Total pending`, `Disposal`, `Total collection` | delete those assertions; where a tile's *figure* was the point (the pending total, the collection total), assert the same number in the Anchal table's `TOTAL` row instead |
| `[data-report-count]` and `N / M reports` | delete; filing status is gone by design |
| `[aria-label='Anchal-wise performance table'] thead th` | the heads are now `Anchal`, `Received`, `Disposed`, `Pending`, `Disposal %`, `Collected (₹)` |
| `getByRole("option", { name: "All 10 services" })` having count 1 | the option now appears once in the Anchal card; scope the locator to the section whose heading is `Anchal-wise performance` |
| the layout measurement of the tile grid and the screenshot named `commissioner-dashboard-three-tiles.png` | delete the tile measurement; keep any measurement of the Anchal table |
| a `View` or page-wide `Service` filter | use the Anchal card's Period buttons and its Service filter |

Then read the rest of that file and `tests/browser/design.spec.ts` for any other use of the filing panel, the tiles, or the page-wide filter, and bring each in line by the same reasoning. Do not add new browser tests.

- [ ] **Step 5: Add to the handover.** In `docs/handover/go-live-operational-checks.md`, add a section before `## Known gaps that are not checks`, in the document's own plain style, saying:

- Heading: `## The Commissioner's dashboard reads three new routes`
- The dashboard is now six sections, each with its own filters. Besides `GET /dashboard`, it reads `GET /dashboard/services`, `GET /dashboard/days` and `GET /field-visits/summary`, all Commissioner-only.
- **Deploy order: backend first.** If the frontend ships first, the Anchal table works and each of the other five sections shows an error in its own card until the backend follows. Nothing is lost; it looks broken.
- An open dashboard makes six small reads every 15 seconds while its tab is visible. That is by design; the server works them out from the same entries as before.
- The two charts refuse a period longer than 92 days and say so.
- Filing status no longer appears anywhere on the dashboard. That was the client's decision.
- Still to confirm with RMC: the units on the visit cards (kg, metres, square metres); that one visit counts as one route for Fogging, one job for Street lighting and one site for Water body cleaning; and all the new Hindi.
- A visit's details are optional, so a visit card says how many of its visits gave no figure.

- [ ] **Step 6: Run everything** — `npx vitest run && npx tsc --noEmit`, then `npx playwright test --list`.

- [ ] **Step 7: Commit** (frontend)

```
test: the assembled dashboard, its live specs and the handover
```

---

### Task 10: Final verification, whole-branch review and delivery (controller, with an Opus reviewer)

- [ ] **Step 1: Verify both repos on their final commits.** Frontend: `npx vitest run` and `npx tsc --noEmit`. Then the backend suite (expect 601). Record both counts. Confirm with `git diff <base> --stat -- src/client/index.css` that the stylesheet is untouched, and that `git diff <base> --name-only` in each repo lists only files this plan named.

- [ ] **Step 2: Look at it.** Start the frontend against the backend if the environment allows (`npm run dev`, with the API proxied or mocked), sign in as the Commissioner, and take a screenshot of the dashboard at 1360px and at 390px wide. Compare with the mockup linked from the design. Check by eye: the six sections in order; filters wrapping rather than overflowing on the phone; both charts readable; ward grid legible; no text clipped in Hindi. If the page cannot be run here, say so and list this as not done — do not claim it.

- [ ] **Step 3: Whole-branch review on Opus.** Give the reviewer both diffs from the Task 0 bases, the design, this plan and the task reports, and ask for: whether the six sections do what the design says; any figure that can disagree between two sections or between the page and the server; any blank/zero confusion; anything that still mentions filing; any service-id list that slipped into `src/`; test changes that weakened rather than updated; and wrong claims in the handover. One fix wave for what it finds, then re-verify as in Step 1.

- [ ] **Step 4: Report to the user**, in this order: final test counts for both repos; every commit, per repo; any test in this plan that had to be corrected, and why; every Hindi string added (Appendix A is the expected list); a plain statement that the browser specs were edited and not run; whether Step 2 was done; anything stopped on.

- [ ] **Step 5: Deliver as patches** (no push, no deploy). Ask the user for `git log --oneline -1` from each repo on their machine and compare by commit **message** with the Task 0 bases. Then:

```bash
cd /home/claude/work && git format-patch <base>..HEAD --stdout > /mnt/user-data/outputs/commissioner-dashboard-frontend.patch
cd /home/claude/backend && git format-patch <base>..HEAD --stdout > /mnt/user-data/outputs/commissioner-dashboard-backend.patch
```

Copy them to `~/Developer/CommissionerDashboard/` and `~/Developer/backend-anchal/` with the device file-commit tool, then list both directories to confirm the files are there. Tell the user to apply **both** before testing either repo, and that on deploy the backend goes first.

---

## Appendix A: Hindi added by this plan (all drafts for the client's reviewer)

| English | Hindi | Where |
|---|---|---|
| Period / Today / Past 7 days / This month / Custom | अवधि / आज / पिछले 7 दिन / इस माह / कस्टम | every section |
| Disposed | निस्तारित | tables, chart |
| Collected (₹) | संग्रहित (₹) | tables |
| What each Anchal received, disposed and collected | प्रत्येक अंचल में क्या प्राप्त हुआ, क्या निस्तारित हुआ और कितना संग्रह हुआ | Anchal section |
| Service-wise progress | सेवावार प्रगति | service section |
| The *n* daily services. A blank means the service does not record that figure. | *n* दैनिक सेवाएँ। खाली स्थान का अर्थ है कि वह सेवा यह आंकड़ा दर्ज नहीं करती। | service section |
| Service-wise progress table | सेवावार प्रगति तालिका | service section |
| No. | क्र. | service section |
| *n* payments | *n* भुगतान | service section |
| Collection | संग्रह | collection section |
| Amount collected per day: fees on applications and the collections together. | प्रतिदिन संग्रहित राशि: आवेदनों के शुल्क और संग्रह, दोनों। | collection section |
| All *n* that collect | राशि लेने वाली सभी *n* सेवाएँ | collection section |
| Collected in this period | इस अवधि में संग्रहित | collection section |
| Collected | संग्रहित | chart series |
| Collection per day, *from* to *to* | प्रतिदिन संग्रह, *from* से *to* | chart name |
| Received and disposed | प्राप्त और निस्तारित | trend section |
| Applications per day | प्रतिदिन आवेदन | trend section |
| All *n* with applications | आवेदन वाली सभी *n* सेवाएँ | trend section |
| Received and disposed per day, *from* to *to* | प्रतिदिन प्राप्त और निस्तारित, *from* से *to* | chart name |
| View as table / View as chart | तालिका के रूप में देखें / चार्ट के रूप में देखें | charts |
| Date | तिथि | chart table |
| Choose a period of 92 days or fewer | 92 दिन या उससे कम की अवधि चुनें | server message |
| No visits in this period. | इस अवधि में कोई निरीक्षण नहीं। | field visits |
| *v* visits by *o* officers. Each service counts its own thing, so there is no single total. | *o* अधिकारियों द्वारा *v* निरीक्षण। हर सेवा अपनी ही चीज़ गिनती है, इसलिए कोई एक योग नहीं है। | field visits |
| *n* visits | *n* निरीक्षण | visit cards |
| *n* without a figure | *n* में आंकड़ा नहीं | visit cards |
| kg lifted / routes covered / dogs picked / neutered / jobs / metres / sq metres cut / trees pruned / sites cleaned | किग्रा उठाया / मार्ग कवर / कुत्ते पकड़े / का बधियाकरण / कार्य / मीटर / वर्ग मीटर कटाई / पेड़ों की छंटाई / स्थल साफ किए | visit cards (`visit-card-wording.json`) |
| in *n* wards | *n* वार्ड में | visit cards |
| Where the visits were | निरीक्षण कहाँ हुए | ward section |
| All 53 wards. *n* had no visit in this period. | सभी 53 वार्ड। इस अवधि में *n* वार्डों में कोई निरीक्षण नहीं हुआ। | ward section |
| None / 3 or more | कोई नहीं / 3 या अधिक | ward key |
| Ward *n*: no visits / *v* visits | वार्ड *n*: कोई निरीक्षण नहीं / *v* निरीक्षण | ward cells |

## Appendix B: Deliberately left alone

- Filing status, the updates feed, export, print, drill-down, a map and period-on-period comparison: out of scope by the design.
- The clerk's daily entry, the officer's visit form, the visit register and the opening-balances screen.
- `GET /dashboard`'s response: it still carries `submitted`, `expected` and other fields the page no longer shows.
- The existing `GET /dashboard/entries` call, which the page has never used.
- Old data. The owner is clearing it separately; nothing here depends on it.
- The stale scripts under `tests/agent/`.
