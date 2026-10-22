# Comprehensive Playwright Handover Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking. Do not execute until the user approves this plan and chooses an execution approach.

**Goal:** Implement the agreed comprehensive local and staging Playwright acceptance suite for the Anchal office and commissioner handover journeys, repair the discrepancies it proves, and produce auditable run evidence.

**Architecture:** Reuse the installed `@playwright/test` runner. Split deterministic browser tests, which intercept every application API call, from opt-in staging runs against a dedicated isolated backend dataset. A stable scenario registry links each executable test to the approved matrix; domain checks and staging/API checks provide evidence where a browser fixture cannot prove backend behavior.

**Tech Stack:** TypeScript, React, Vite, `@playwright/test`, existing Vitest domain/transport tests, Playwright fixtures, axe-core, optional Playwright APIRequestContext for the actual supported staging contract.

**Spec:** [2026-10-19 handover testing design](../specs/2026-10-19-handover-testing-design.md) and [scenario matrix](../../testing/2026-10-19-handover-scenarios.md).

## Global Constraints

- A test of any office/service/date tuple may mutate only the dedicated resettable local fixture or explicitly reserved staging fixture.
- Stage records are unique by office + service + service date; a Ward/Remarks run marker does not isolate a record.
- Do not put credentials, cookies, API keys, or unredacted sensitive traces into source, reports, or shared artifacts.
- No frontend Change History page or navigation. Retain and verify existing backend audit records through a supported isolated fixture/access path.
- Service work completed, complaints resolved, and field tasks completed cannot exceed same-service-date receipts. Opening balances do not increase that cap.
- Work included in the opening balance from before the reporting-start date stays pending; no date-boundary exception, baseline modification, or duplicate receipt.
- Commissioner dashboard data loads on entry and when the user changes filters. Manual Refresh is the explicit freshness action; no polling, live socket, or automatic focus/reconnect refresh.
- Manual Refresh preserves filters. If the service-entry register is open, keep it open and refresh its rows and dashboard totals. On a partial failure preserve available data and identify the section that failed.
- A failed operation, rejected validation, stale version, or unauthorized request must not create a partial write, incorrect audit record, duplicate report, or misleading success state.
- Mark any staging-only check blocked when its real API contract or isolated backend fixture is unavailable. Never use a local mock to claim server authorization, persistence, atomicity, or date enforcement.

## Review Focus

- **Before-start opening balances:** cannot be cleared in this handover; verify they remain included in closing balances and cannot be submitted through an earlier-date bypass. Tests: Task 3 and Task 5.
- **Same-date completion cap on all three tracks:** test service, complaint and field counts against exact-date receipts when openings are nonzero and zero. Tests: Task 3 and Task 5.
- **Mutation commit followed by lost response, stale retry, or failed follow-up GET:** distinguish committed from uncommitted state, reuse idempotency only for identical input, and avoid a false success. Tests: Task 3 and Task 5.
- **Cross-account cache and request/response races:** switch office/commissioner identities or filters during an in-flight read/write and prevent late data from appearing under another identity. Tests: Task 2, Task 4 and Task 5.
- **Manual Refresh when the summary/detail endpoints have different outcomes:** keep selected filters and the open register intact, and report exactly what updated. Tests: Task 4.

---

## File map

Create:

- `tests/browser/fixtures/portal.ts` — strict local API fixture state, route handlers, operation failure injection, and captured requests.
- `tests/browser/helpers/auth.ts` — account login helpers with explicitly supplied credentials; no implicit setup mutations.
- `tests/browser/helpers/entries.ts` — semantic entry-form actions and exact persisted-value assertions.
- `tests/browser/helpers/oracle.ts` — fixed test dates and precomputed ledger/dashboard expectations independent of production aggregation code.
- `tests/browser/scenario-coverage.json` — one registry record per matrix ID; links spec, title, layer, priority, and `implemented | deferred | blocked` state.
- `tests/browser/environment.spec.ts`, `auth.spec.ts`, `setup.spec.ts`, `entry.spec.ts`, `time.spec.ts`, `ledger.spec.ts`, `security.spec.ts`, `dashboard.spec.ts`, `audit.spec.ts`, `accessibility.spec.ts`, `handover.spec.ts` — focused test ownership by journey.
- `playwright-report/` or `output/playwright/<run-id>/` — runtime reports and restricted failure artifacts; generated files remain ignored/untracked.

Modify:

- `playwright.config.ts` — deterministic local and opt-in staging projects, run artifacts, and a Vite-only local server.
- `package.json` — focused local, staging-preflight, and staging commands without new dependencies.
- `src/client/pages/InitialBalances.tsx`, `src/client/pages/DailyEntry.tsx`, `src/domain/ledger.ts`, relevant domain tests — only where failing tests demonstrate missing confirmed date/count/server-aligned validation or misleading recovery.
- `src/client/pages/Dashboard.tsx`, `src/client/query.ts`, dashboard/browser tests — initial/filter reads, manual refresh and open-register preservation; remove unused live behavior and unsolicited refresh.
- `tests/browser/portal.spec.ts`, `tests/browser/design.spec.ts`, `tests/browser/history.spec.ts` — migrate valid scenarios to current `/anchal/` route, strict API prefix, actual UI selectors, and the confirmed backend-only audit scope.
- `README.md` — replace obsolete Worker browser setup instructions with the verified local/staging test workflow and safeguards.

Do not modify the unrelated tracked `.gitignore` change that predates this plan.

## Task 1: Establish the isolated browser harness and scenario registry

**Files:** Create `tests/browser/fixtures/portal.ts`, `tests/browser/scenario-coverage.json`; modify `playwright.config.ts`, `package.json`.

**Interfaces:** The local Playwright fixture exports `test` and `expect` from an extended `@playwright/test` base and adds a `portal` fixture with `seed(seed: PortalSeed): void`, `failNext(operation: PortalOperation, response: PortalFailure): void`, and `requests(): readonly RecordedRequest[]`. `PortalSeed` contains the session, optional setup, office entries/openings, dashboard response, detail rows, and audit fixture state. `PortalOperation` names only actual calls: `session`, `login`, `logout`, `setup.read`, `setup.create`, `entries.read`, `entries.create`, `entries.update`, `dashboard.read`, `dashboard.entries`, `audit.read`. `RecordedRequest` contains method, pathname, query, and parsed request body; never stores credential headers or cookies. In local mode, every `/v1/api/anchal/**` route is explicitly handled and any unknown API request fails closed.

- [ ] **Step 1: Add failing harness checks** in `tests/browser/environment.spec.ts` for base URL `/anchal/`, request matching on `/v1/api/anchal/`, unknown-path failure, scenario ID uniqueness, and exclusion of real credentials from recorded requests.
- [ ] **Step 2: Run the focused checks** with `npm run test:browser -- tests/browser/environment.spec.ts`. Expected: missing fixture/registry assertions fail; no request reaches the configured staging host.
- [ ] **Step 3: Configure deterministic local and explicit staging projects** in `playwright.config.ts`. Local uses a stable Vite port and base `/anchal/`, a Vite `webServer`, blocked service workers, one worker and failure-only traces/screenshots. Staging has no implicit default URL/password or web server, uses one worker for writes, and loads secrets only from explicit private environment configuration. Add npm commands `test:browser:local`, `test:browser:staging:preflight`, and `test:browser:staging`.
- [ ] **Step 4: Implement the local `portal` fixture** using `page.route`; route each actual API method/path, parse and record requests, seed isolated in-memory state, return explicit configured responses, and fail on unknown application API traffic. Do not intercept an external real backend in the staging project.
- [ ] **Step 5: Add the registry for all 211 matrix IDs**, including the three explicitly deferred frontend-history presentation IDs as `deferred`. Reject duplicate/missing IDs. Mark unresolved actual backend-contract checks `blocked` until access exists; do not count them as pass.
- [ ] **Step 6: Run the focused harness test** again; expected: all environment/registry assertions pass and local browser traffic contains only explicit local fixture requests.
- [ ] **Step 7: Commit** `test: isolate Playwright local and staging runs`.

## Task 2: Cover login, role gates, base-path routing, and first-run setup

**Files:** Create `tests/browser/helpers/auth.ts`, `tests/browser/auth.spec.ts`, `tests/browser/setup.spec.ts`; modify `tests/browser/portal.spec.ts`, `tests/browser/design.spec.ts`, `src/client/App.tsx` only if a regression test proves a behavior defect.

**Interfaces:** `signIn(page: Page, username: string, password: string): Promise<void>` performs only the login interaction and confirms the resulting signed-in account; it must not provision or complete setup. Tests that need an initialized office seed setup explicitly with `portal.seed`. Setup scenarios use a separately resettable unconfigured account.

- [ ] **Step 1: Write failing auth and route tests** for empty credentials, wrong credentials, each of six office identities, commissioner identity, protected deep links, `/anchal/` refresh, fresh-office setup gate and role redirects. Assert that the first protected read occurs only after valid session state.
- [ ] **Step 2: Run focused auth/route tests**. Expected: at least the current old `/api/...` mocks or root URLs fail instead of being hidden by their catch-all mock replies.
- [ ] **Step 3: Repair the existing browser tests’ API paths and URLs** using Vite base `/anchal/` and `/v1/api/anchal/...`; remove response catch-alls that fabricate valid success payloads.
- [ ] **Step 4: Add setup tests** for all 25 service IDs and 75 balance inputs; deliberate zero confirmation; distinct persisted signatures; today/past/future date bounds; every balance’s blank, negative, fractional and over-limit cases; immutable subsequent write; concurrent first setup; failure/retry preserving entered values. Assert no report read before setup and no partial setup on invalid save.
- [ ] **Step 5: Fix only confirmed setup/routing defects** revealed by these tests. Preserve `/anchal/` deep-link behavior and role routing.
- [ ] **Step 6: Run `npm run test:browser:local -- tests/browser/auth.spec.ts tests/browser/setup.spec.ts tests/browser/portal.spec.ts`**. Expected: deterministic role/setup tests pass with no data-dependent skips.
- [ ] **Step 7: Commit** `test: cover sign-in roles routing and office setup`.

## Task 3: Cover Today, Backdate, edits, validation, drafts, and time

**Files:** Create `tests/browser/helpers/entries.ts`, `tests/browser/helpers/oracle.ts`, `tests/browser/entry.spec.ts`, `tests/browser/time.spec.ts`, `tests/browser/ledger.spec.ts`; modify `src/client/pages/DailyEntry.tsx`, `src/client/pages/InitialBalances.tsx` only for tested defects, `src/domain/ledger.ts`/domain tests only if the agreed rule belongs in the shared client/domain boundary, and existing browser specs.

**Interfaces:** `fillEntry(page: Page, values: EntryFormValues): Promise<void>`, `submitEntry(page: Page, options?: { expectCorrection?: boolean }): Promise<void>`, and `expectSavedEntry(page: Page, expected: EntryExpectation): Promise<void>`. `EntryFormValues` uses exact client names: `serviceDate`, `serviceId`, `ward`, `received`, `completed`, `slaWithinTime`, `amountRupees`, `complaintsReceived`, `complaintsResolved`, `fieldReceived`, `fieldCompleted`, `avgDisposalDays`, `remarks`, `reason`. Oracle exports `todayISTAt(utcInstant: string): string` only if needed for stable fixture construction; expected balances/rates/counts remain precomputed test constants and never call `summarizePeriod` to assert its own output.

- [ ] **Step 1: Add failing Today/Backdate tests** for every catalog service ID, Today’s no-date-picker rule, Backdate’s start/yesterday inclusive bounds, no Backdate when start=today, immutable registration time, delayed-entry reason, correction reason, saved read-only state, exact edit/cancel restore, zero activity versus missing report, one-per-service/day identity, progress at 1/25, 24/25 and 25/25.
- [ ] **Step 2: Add failing validation and draft tests** for all seven counts, Ward, remarks, paise parsing/limits, average days, reason lengths, whitespace, same-date receipt caps for each of service/complaint/field tracks, invalid API field errors, request retry identity, all dirty-entry navigation prompts, accepted and canceled service/date changes, delayed form load/write races and IST midnight rollover/draft continuation.
- [ ] **Step 3: Add failing ledger cases from the approved oracle** in the design and scenario matrix. Assert balances `(12,4,6)` after D0 and `(13,5,7)` after D2; movement totals 9 received, 6 completed, 5 SLA, ₹133.46; disposal 66.7%, SLA 83.3%; 2/3 service reports and 2/75 office reports. Assert opening work remains pending and over-receipt completions are rejected even when openings could cover them.
- [ ] **Step 4: Run only the focused local/domain tests**. Expected: receipt-cap violations, stale route/data races, unsupported boundary states, or incorrect new oracle expectations fail by scenario ID.
- [ ] **Step 5: Implement and validate the agreed frontend/domain rules** revealed by the failing tests. The completion invariant is `completed <= received`, `complaintsResolved <= complaintsReceived`, and `fieldCompleted <= fieldReceived`; `slaWithinTime <= completed`. A pre-start date remains rejected and opening balances remain immutable. Any backend-only mismatch is registered as blocked until real backend evidence is available.
- [ ] **Step 6: Fix draft handling, request identity, error recovery and IST rollover** for the exact tested transitions. A failure after a committed write must report the committed write separately from failed reload and must never invite a duplicate submission.
- [ ] **Step 7: Run `npm run typecheck`, `npm run test:domain`, and `npm run test:browser:local -- tests/browser/entry.spec.ts tests/browser/time.spec.ts tests/browser/ledger.spec.ts`**. Expected: confirmed same-day limits hold for all three work tracks; every valid form saves to its intended key; negative balances stay rejected for the legacy compatibility fixture only; the approved independent oracle matches the UI.
- [ ] **Step 8: Commit** `test: cover office reports corrections and ledger boundaries`.

## Task 4: Implement and test commissioner filters, manual refresh, and open register

**Files:** Create `tests/browser/dashboard.spec.ts`; modify `src/client/pages/Dashboard.tsx`, `src/client/query.ts`, `tests/browser/portal.spec.ts`, and `tests/browser/design.spec.ts`.

**Interfaces:** Dashboard request keys retain the existing query contract `from`, `to`, optional `officeId` and optional `serviceId`. Manual Refresh refetches the active summary query and fetches detail rows only when the register is open; no new WebSocket/polling API. One explicit `refreshDashboard()` operation coordinates these reads and leaves controls/filter state available. Keep detail result tied to the filter query that requested it.

- [ ] **Step 1: Add failing dashboard tests** for initial fetch, day/range/month boundaries, each office 1–6, each service 1–25, combinations, six metrics/footer arithmetic, all-zero/configured/unconfigured/partial/complete empty states, strict threshold equality, missing-report indicators, date/service/office query construction, and deliberately reordered filter responses.
- [ ] **Step 2: Add failing manual-refresh tests**: office write leaves the commissioner snapshot unchanged until Refresh; Refresh updates the summary; no dashboard fetch on elapsed time/focus/visibility/reconnect; no `/api/live` websocket; preserved selected filters; no unnecessary detail read when register closed.
- [ ] **Step 3: Add failing open-register tests**: when open, Refresh requests summary and detail rows for the same active filters, keeps the panel open, and shows both refreshed results; summary-only or detail-only failure retains the previous available section and reports the failed section; closing while requests are in flight prevents a late response from reopening it.
- [ ] **Step 4: Run focused dashboard tests**. Expected: tests detect the current unsolicited socket/interval/focus behavior and current `setDetails(null)` on refresh.
- [ ] **Step 5: Change `query.ts`** so dashboard queries do not automatically refetch on window focus. Keep ordinary initial loads and query-key changes.
- [ ] **Step 6: Change `Dashboard.tsx`** to remove the unsupported socket, heartbeat, interval, reconnect and focus refetch; implement the explicit Refresh operation above; preserve current details only for matching filters and refresh them when open; add clear, section-specific failure feedback without claiming stale content is fresh.
- [ ] **Step 7: Run `npm run test:browser:local -- tests/browser/dashboard.spec.ts tests/browser/portal.spec.ts`**. Expected: no background read occurs after initial load, explicit Refresh updates both open sections without changing filters/panel state, and partial failures remain truthful and recoverable.
- [ ] **Step 8: Commit** `feat: make commissioner data refresh manual and preserve details`.

## Task 5: Verify real staging persistence, authorization, and backend audit

**Files:** Create `tests/browser/security.spec.ts`, `tests/browser/audit.spec.ts`, `tests/browser/handover.spec.ts`; modify `playwright.config.ts`, `tests/browser/scenario-coverage.json`, and `scripts/` only if the backend owner provides an approved isolated fixture API/command. Never invent or call a destructive reset endpoint.

**Interfaces:** Staging configuration accepts `RMC_TEST_URL`, an explicit credentials-file path or CI secret variables, explicit dedicated test dataset identity, and explicit write opt-in. Preflight validates the URL host against an allowlist, required role accounts, backend build/contract identifier, dataset/reset identity and unique run ID before any writes. No hardcoded default password. Use `APIRequestContext` only with documented, supported backend methods and cookie/origin rules. The backend implementation is not in this repository; staging proof depends on its actual available contract and reset mechanism.

- [ ] **Step 1: Add a failing staging preflight** proving no request or mutation occurs with missing URL/credentials/dataset/reset identity/write opt-in, mismatched host, or missing build identifier; prove no secrets enter logs/reports.
- [ ] **Step 2: Obtain and record the real test contract** in run configuration: test URL, separate six office accounts and commissioner, expected status/error envelopes, cookie behavior, backend build, allowed origins, audit read/verification path and isolated dataset reset. If not available, mark S cases `blocked` and continue local fixtures without fake backend claims.
- [ ] **Step 3: Add staging authorization tests** for signed-out requests, all six office ownership boundaries, commissioner read-only enforcement, setup gate, direct API bypass, forged office/service/date/registration/version, invalid routes, session revocation and CSRF/origin rules that the backend contract actually supports.
- [ ] **Step 4: Add staging mutation/read-back tests** against a resettable dedicated dataset: one setup fixture, the agreed daily completion cap, valid Today and Backdate entries, backdated/correction reasons, immutable registration timestamps, idempotent lost-response recovery, stale-version conflict, opening pre-start pending remains pending, and independent API read reconciliation.
- [ ] **Step 5: Add backend audit verification** through supported retrieval/fixture inspection. Assert setup/create/correct records, correct actor/action/reason/before/after/time, and atomicity. Keep the audit presentation backend-only; create no history page or frontend link. Test access boundaries only where a supported backend audit endpoint exists.
- [ ] **Step 6: Add one protected staging preflight run**. Expected: it prints a redacted dataset/build/run summary, writes nothing, and aborts before login if configuration is incomplete.
- [ ] **Step 7: Run the isolated staging smoke path** only against the confirmed test dataset; read back entries and audit events. Expected: all writes use reserved tuples; every record matches the independent oracle; reset removes only that run’s approved test data. If safe reset/read-back is absent, stop write campaigns and label them blocked.
- [ ] **Step 8: Commit** `test: gate staging acceptance on isolated backend fixtures`.

## Task 6: Close accessible, localized, failure-state, and browser coverage

**Files:** Create `tests/browser/accessibility.spec.ts`; modify `tests/browser/design.spec.ts`, `tests/browser/portal.spec.ts`, focused feature specs, and `tests/browser/scenario-coverage.json`.

- [ ] **Step 1: Add failing locale/viewport/keyboard tests** across login, setup, Today, Backdate, dashboard and detail register. Verify language switch preserves drafts/filters; tab navigation, skip link, actual `.ui-*` field selectors, progress values, modal drawer keyboard behavior, and the supported control target-size rule.
- [ ] **Step 2: Add explicit loading/empty/failed request tests** for each implemented endpoint and operation: 400/401/403/404/409/422/429/5xx, abort/offline, timeout, malformed JSON/HTML, error envelopes, retry, session expiry, setup failure, lost write response and failed post-write read. Assert visible error context, saved draft retention, no double writes, no false zero/empty success, and whether stale data remains.
- [ ] **Step 3: Run focused local cases** and correct selectors to the actual DOM. Expected: no stale UX4G selector can silently scan zero controls and pass.
- [ ] **Step 4: Repair verified accessibility/localization/resilience issues** only when the new browser assertions demonstrate them; keep Change History presentation out of page scans.
- [ ] **Step 5: Run Chromium layout and axe checks** at 320, 390, 768, 1100, 1500 and 1920 widths, in light/dark appearance, English/Hindi, empty/error/full data, keyboard navigation and mobile drawer states. Review screenshots; do not update baselines blindly.
- [ ] **Step 6: Run principal flows in installed Chromium, Firefox and WebKit projects**. If a browser binary is unavailable, mark that browser blocked with its setup requirement; never silently drop its coverage ID.
- [ ] **Step 7: Commit** `test: cover bilingual accessible and resilient handover states`.

## Task 7: Complete matrix-to-test traceability and all-office/service campaigns

**Files:** Modify all focused `tests/browser/*.spec.ts`, `tests/browser/scenario-coverage.json`; create `tests/browser/handover.spec.ts`; modify `README.md`.

- [ ] **Step 1: Add a registry consistency test** for all 211 matrix IDs, expected family/variant counts, no duplicate IDs, three deferred frontend-history presentation IDs, and explicit `implemented | deferred | blocked` outcomes.
- [ ] **Step 2: Expand local service fixtures** to cover selection/form/read/correction/cancel for every service ID 1–25, all seven numeric activity fields, 75 setup values, both roles, route transitions and validation boundary partitions. Avoid one brittle monolithic journey.
- [ ] **Step 3: Add staged catalog/read/isolation verification** for all six × 25 office/service combinations. Before writes, verify resettable reservation. Then submit the planned controlled campaign across all 150 combinations using zero/nonzero variants and verify exact readback. Exercise each office’s Today/Backdate/correction roles without modifying non-test tuples.
- [ ] **Step 4: Add repeatable synthetic walkthroughs**: fresh Anchal → setup → daily reports → backdated report → correction → logout; commissioner concurrent login → day/range/month and office/service filters → manual Refresh → open-register refresh → logout; include the crossed midnight draft only in the deterministic local clock suite.
- [ ] **Step 5: Update README browser instructions** for local Vite-only mocks, staged real API requirements, commands, fixture resets, report artifacts and credential safeguards. Remove obsolete `npm run test:worker` / Worker-server browser assumptions only where they are verified obsolete.
- [ ] **Step 6: Run the full local suite** with `npm run test:browser:local`, `npm run typecheck`, `npm run test:domain`, and `npm run build`. Expected: deterministic results, zero unexplained network/console errors, no silent required skips, no private credentials in artifacts.
- [ ] **Step 7: Run the two consecutive clean isolated staging passes** with `npm run test:browser:staging` only after Task 5 preflight is satisfied. Expected: all unblocked staging IDs pass twice, exact data/audit reconciliation, approved fixture cleanup, explicit report of any backend-blocked IDs.
- [ ] **Step 8: Commit** `test: complete handover scenario coverage and run guide`.

## Verification and release handoff

Each test title is `[SCENARIO-ID][layer][browser] description`; parameterized variants include role, office/service/value boundary in the title or test annotations. The JSON registry records source file/title, execution layer, priority and result state. Generate HTML, JSON and JUnit results in `output/playwright/<run-id>/`; retain failure traces and screenshots there with secrets redacted.

The final handover report records commit, frontend/backend build IDs, local/staging environment identity, executed matrix variants, first-attempt results, retries, failures, blocked backend checks, defects, known accepted exclusions, oracle reconciliation and fixture cleanup. Passing a mocked test does not pass its staging authorization/persistence counterpart.

The release gate is the one in the test design: no unresolved P0 failures, no required scenario silently skipped, two consecutive critical runs, complete independent reconciliation, no unaccepted serious/critical accessibility findings, and documented owner/workaround for accepted noncritical issues. The three deferred frontend-history presentation IDs are excluded by the confirmed scope. Backend audit verification remains required.

## Self-review

- **Spec coverage:** ENV/AUTH/ROUTE/SETUP are Tasks 1–2; Today/Backdate/validation/edit/draft/IST/ledger are Task 3; commissioner metrics/filters/manual refresh/register/partial failures are Task 4; backend authorization/persistence/audit is Task 5; errors/locales/accessibility/responsive/multi-browser are Task 6; the 211-ID registry, all-office/service campaign, handovers and run guide are Task 7. No frontend history screen is planned.
- **Review Focus mapping:** each of the five top-level cases appears explicitly in its owning task tests.
- **External prerequisites:** tracked source includes no backend implementation for `/v1/api/anchal`. Task 5 needs real API documentation, dedicated staging accounts/dataset and a supported safe reset/readback mechanism. If unavailable, server-only scenarios remain blocked; local fixture results cannot substitute.
- **Order and interfaces:** fixture/registry precede auth and feature tests; shared `portal` fixture and exact entry helper names are defined before consumers; dashboard uses the existing query shape; staging credentials are not reused from local fixture auth.
- **Scope:** no new end-user feature is proposed apart from fixes required to satisfy the already-confirmed handover behavior. Staging scripts must not invent a reset/delete API.

---

Plan complete. Please review [this implementation plan](2026-10-19-comprehensive-playwright-handover.md). It covers the confirmed scope across seven sequenced tasks and preserves the backend-access prerequisite. **Does it capture what you want, and which execution approach should we use?**

- **Native:** I implement the dependent tasks sequentially in this session, then request one independent full-plan review. Recommended here because the harness and shared fixtures must land before feature tests, and staging work depends on their exact interfaces.
- **Subagent-driven:** one implementer per task with a review before advancing, then a final branch review. This provides more independent gates across seven tasks, at higher coordination cost.
