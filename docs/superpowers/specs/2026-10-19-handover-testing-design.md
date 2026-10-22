# Comprehensive Playwright handover test plan

Date: 19 October 2026. Status: proposed test design for review; no browser acceptance run or product changes performed by this audit.

## Purpose and scope

Prove that an Anchal office user can start with a new account, complete opening setup, report all municipal services, backdate activity, correct saved reports, recover from failures, and sign out; and that a commissioner can independently review accurate, current, office-scoped and service-scoped information. Test every reachable workflow and the previously specified workflows that are missing from the current build. Missing functionality must be recorded as a gap rather than disappearing from coverage.

The user selected **local deterministic tests plus a dedicated staging dataset**. Treat “Anchal admin” as the existing `office` role: the code exposes `office` and `commissioner`, not a separate administrator account or administration console.

**Confirmed scope decision, 19 October 2026:** Change History is excluded from the frontend for both roles. Retain backend audit storage and its authorized retrieval capability for a possible future frontend. Verify audit creation, before/after values, actor, timestamps, reasons, isolation and atomicity through backend/API evidence. The missing frontend history screen is intentional and is not a handover defect. This decision supersedes the older frontend-history requirements cited below; do not add history navigation, screens or browser walkthrough steps.

**Confirmed completion rule, 19 October 2026:** service completions, resolved complaints and completed field tasks cannot exceed their corresponding receipts on the same service date. Opening balances do not increase this daily completion allowance. The user requires pending work to be handled through a backdated entry or correction with a reason retained in the backend audit. Test both new Backdate reasons and correction reasons, with balance recomputation and immutable registration timestamps. Do not implement the earlier recommendation to permit completion against opening + received.

**Confirmed opening-work boundary, 19 October 2026:** pending work carried into opening balances from before the reporting-start date stays pending for this handover. There is no earlier-date exception, baseline adjustment or reopening workflow. Keep the reporting-start boundary and saved baseline immutable; do not add duplicate receipts to clear the opening work. Test that legitimate new activity and permitted backdated corrections leave this carried-in portion pending and that the commissioner continues to see it in closing balances.

**Confirmed dashboard refresh decision, 19 October 2026:** the commissioner reviews a loaded snapshot and uses a manual Refresh button when updated information is wanted. Fetch on initial opening and filter changes; no timer polling, automatic focus/reconnect refresh, WebSocket/live connection or live-propagation timing requirement. Preserve existing data on a failed manual refresh with an actionable error that makes clear it was not updated. No new live/connecting indicator is required; a last-loaded timestamp may be useful but is not a confirmed handover feature.

**Confirmed register refresh decision, 19 October 2026:** when the service-entry register is open, manual Refresh keeps it open, preserves selected filters and refreshes both the register rows and dashboard totals. When it is closed, Refresh need not fetch detail rows. A failed read must not close the register or claim both sections refreshed successfully; retain available data and identify the section that could not update. Filter changes remain separate user actions and must not relabel old-filter rows as new results.

Companion: [scenario matrix](../../testing/2026-10-19-handover-scenarios.md): **211 inventoried scenario families across 23 areas**, including three explicitly deferred frontend-history presentation families. Priority labels cover 120 P0, 89 P1 and 2 P2 families before parameter expansion; deferred families do not enter the release gate. Each has a stable ID, source, expected outcome, execution layer, and priority. This is a test-design artifact, not authorization to deploy or a claim that the application passes it.

## What the code audit establishes

Audited tracked frontend source, domain calculations, shared contracts/catalog, Vite and deployment configuration, all browser/domain tests, and relevant workflow/integration/UI designs at commit `c6f4f5c` with an existing unrelated `.gitignore` modification. No backend implementation for `/v1/api/anchal` is present in this checkout. Historical SQL/provisioning files are not evidence of the current backend's behavior.

| Surface | Current code | Coverage obligation |
| --- | --- | --- |
| Session, role routing, setup gate, dirty navigation | `src/client/App.tsx` | Login lifecycle; office/commissioner access; direct routes; canceled navigation; account switching |
| Portal subpath | `src/client/portal-path.ts`, `vite.config.ts`, `vercel.json` | `/anchal/` entry and deep links; assets; API routing at the actual hosting layer |
| Login | `src/client/pages/Login.tsx` | Required fields, credentials, submit lifecycle, errors, language, keyboard |
| First-run setup | `src/client/pages/InitialBalances.tsx` | One start date; 25 × 3 balances; confirmation; immutable save; failure/retry |
| Today, Backdate, corrections | `src/client/pages/DailyEntry.tsx` | All fields; 25 services; record identity; draft lifecycle; dates; validation; retries/conflicts |
| Commissioner | `src/client/pages/Dashboard.tsx` | Six metrics, office rows/totals, period/office/service filters, thresholds, detail register, refresh |
| Transport, cache, write identity | `src/client/api.ts`, `query.ts`, `mutation.ts` | Cookie contract, response/error handling, deduplication, cache isolation, idempotency |
| Balances and reports | `src/domain/ledger.ts`, `src/shared/types.ts` | Independent arithmetic checks, date boundaries, closing stocks versus period flows |
| Shared interaction and presentation | `components/AppShell.tsx`, `ui.tsx`, `i18n.tsx`, `lib/dates.ts`, styles | Desktop/mobile navigation, accessibility, English/Hindi, IST, long content, theme |
| Backend audit; no frontend Change History | `src/client/audit.ts`; historical specs/tests; current user scope decision | Verify backend records and authorized access; ensure no history screen/nav is offered; frontend presentation deferred |

Fresh baseline checks during this audit: `npm run typecheck` passed; `npm run test:domain` passed **18 tests in 4 files**; `./node_modules/.bin/playwright test --list` discovered **14 tests in 3 files**. Listing is not executing. Previous verification claims in README/status files do not apply automatically to this revision.

## Findings to resolve before handover

These are static findings and regression targets, not browser-reproduced defects. Keep each as an issue linked to scenario IDs until reproduced and resolved or explicitly accepted.

| ID | Finding and evidence | Required decision or verification |
| --- | --- | --- |
| GAP-01 | Old browser mocks match `/api/session`, `/api/office/setup`, etc.; the app calls `/v1/api/anchal/...`. Existing tests also navigate to `/` or unprefixed office routes while Vite uses `/anchal/`. | Repair test transport matching and base/deep-link handling before interpreting results. Unexpected local requests fail closed. See ENV and ROUTE. |
| GAP-02 — resolved scope | No history page/nav exists. Older specs required frontend history for both roles. | User confirmed frontend history is excluded. Retain and verify backend audit capability; defer presentation cases explicitly. No frontend restoration required. |
| GAP-03 — scope confirmed; enforcement to verify | `DailyEntry.tsx:31`–35 caps completions/resolutions at same-day receipts; older domain rules/tests permit more when openings suffice. | User confirmed the same-day cap and that pre-start opening work stays pending. Verify backend/domain enforcement matches this rule, rejects earlier dates and preserves the locked baseline. Permitted backdated activity requires reasons. |
| GAP-04 — manual refresh confirmed | `Dashboard.tsx:66` connects to `/api/live`, interval/focus handlers invalidate dashboard queries, and query defaults refetch on focus. Older plans/tests expect polling/live freshness. | User requires manual refresh only after initial/filter-driven loads. Remove automatic dashboard refresh/socket expectations and verify idle/focus/reconnect cause no unsolicited refetch. Failed Refresh must preserve the prior snapshot with clear error. |
| GAP-05 — register behavior confirmed | `Dashboard.tsx:46`–56 clears details whenever query data/error changes, while an existing test requires the open register to survive refresh. | User confirmed keeping the register open, retaining filters and refreshing both rows and totals. Test successful and partial-failure refresh without silent panel closure or a false all-refreshed result. |
| GAP-06 | Setup uses `noValidate`; its Zod schema omits the date maximum and numeric maximum and does not render resolver field errors. | Test programmatically entered future dates/over-limit values and visible accessible validation, not only browser input attributes. |
| GAP-07 | In `DailyEntry.tsx:196`, accepting a service/date switch does not clear `dirty`; the input-reset effect returns early while dirty. | Reproduce accepted switches as well as canceled switches; verify values and submitted identity cannot follow the wrong service/date. |
| GAP-08 | `DailyEntry.tsx:450`–460 announces save success even when the follow-up `load()` catches a read failure and returns null. | Distinguish committed write from failed refresh; preserve retry identity and never represent stale values as a confirmed current view. |
| GAP-09 | Session/setup refresh shares one catch that drops the session; there is no centralized mid-session 401 handling. Logout awaits an API call without recovery handling. | Test expired cookies, setup outages, failed logout, and restoring a safe draft without leaking it to a different account. |
| GAP-10 | In-app navigation prompts exist, but there is no `beforeunload` handler. Drawer open/close state has no explicit focus trap, Escape handling, or focus restoration. | Test reload/close and keyboard drawer recovery; decide any browser-imposed limits explicitly. |
| GAP-11 | Existing accessibility selectors still target `.ux4g-input`/`.ux4g-checkbox`; current helpers emit `.ui-input`/`.ui-checkbox-control`. Recent styles override themed colors and topbar target sizes. | Update coverage to actual rendered controls, rerun light/dark and focus/target checks, and review screenshots. |
| GAP-12 | API transport assumes raw JSON and same-origin cookies; there is no response-envelope adapter. Backend mapping described by the integration spec is not fully evidenced here; its polling proposal is superseded by manual refresh. README commands reference removed Worker scripts. | Verify the deployed contract, hosting proxy, cookie path, and runnable setup instructions before staging acceptance. |

## Recommended test architecture

Use the existing repository `@playwright/test` runner for repeatable regression coverage. Supplement it with a headed exploratory pass after automation; exploration is evidence for additional scenarios, not a replacement for the suite.

Three possible approaches:

1. **Recommended: deterministic local browser suite + real staging integration + handover walkthrough.** Local fixtures cover exceptional states cheaply and repeatably; staging proves cookies, authorization, persistence and backend arithmetic. This is the selected environment approach.
2. Staging-only browser suite: realistic but first-run setup is irreversible without reset tooling, edge cases are hard to seed, and shared records produce flaky totals.
3. Mock-only local suite: fast and exhaustive for UI branches but cannot establish actual permissions, atomic writes, cookie behavior, or persistence.

Use three execution labels throughout the matrix:

- **L**: local browser tests using deterministic HTTP fixtures; no request may reach staging. Model saved state in the fixture, validate exact method/path/query/body, and fail unknown requests. Supply explicit failure responses rather than a catch-all success object. Stub/block legacy live sockets and external font traffic separately.
- **S**: Playwright browser plus `APIRequestContext` checks against the actual staging backend with isolated cookies and synthetic data. API bypass tests complement the browser when the UI intentionally hides a forbidden action. No mocked authorization or database writes count as staging proof.
- **D**: focused domain/transport tests for exhaustive numeric/date combinations. Carry representative cases through L and S to prove browser/server wiring. Do not import `summarizePeriod` as the expected-value oracle for a test of that same calculation.

An S scenario is blocked, not passed, if its backend contract, fixture/reset access, or endpoint is unavailable. Backend audit rows remain required; frontend history presentation rows are explicitly deferred by the user's scope decision. Do not preserve obsolete assertions merely to increase pass counts.

## Controlled test data

Local tests own their entire dataset per test. Staging needs a dedicated tenant/database or equivalent isolated namespace with six office accounts and one commissioner; no hardcoded password fallback. Use a run manifest containing run ID, commit, frontend/backend build IDs, fixture version, account aliases, IST anchor date, seeded keys, and approved reset mechanism. Credentials stay in environment/private files and never in reports.

Because office + service + service date is unique and setup is locked, a run prefix in Ward/Remarks alone does **not** isolate records. Reserve/reset the actual office/service/date tuples, or create a fresh tenant/database. No test may assume a service is unused, choose a shared office opportunistically, or rewrite operational records. First-run and concurrent-setup scenarios require separate resettable fresh offices. Execute those fixture phases serially; parallel read tests use independent contexts. Reset via existing supported backend operations; if none exist, obtaining a safe staging reset is a prerequisite, not a frontend feature to invent during this plan.

Fixtures must include:

| Fixture | Contents and use |
| --- | --- |
| FRESH | Unconfigured office; all services absent; first login and concurrent setup |
| ZERO | Configured office starting today; all balances zero; Backdate unavailable |
| BASELINE | Configured historical office with nonzero balances in all three tracks; no entries |
| PARTIAL | 1/25 then 24/25 submissions; mix of zero and nonzero activity |
| COMPLETE | 25/25 entries; deterministic per-service signatures; no duplicate keys |
| CHAIN | Date-specific receipts/completions each respecting the daily cap, a skipped day, and valid/invalid historical corrections; separate synthetic legacy rows only for compatibility checks |
| REVIEW | Offices/periods immediately below, at and above each review threshold |
| MULTI | Six distinguishable offices; all 25 service IDs and bilingual catalog names |
| TEXT | Hindi, punctuation, multiline remarks, boundary lengths, literal HTML/script-looking text |
| CONFLICT | Same saved entry loaded into two independently authenticated browser contexts |
| TIME | IST midnight/month/year/leap-day fixtures; browser timezones UTC, Asia/Kolkata and America/Los_Angeles |

### Independent ledger oracle

Use anchor dates D0 = reporting start, D1 = next day, D2 = following day. Fix local time so D2 is today. For staging derive dates from the server's IST date and avoid crossing midnight during ordinary write runs.

For office A/service 1 start with opening `(work, complaints, field) = (10,3,5)`; all other service openings are zero.

| Date | Received / completed / SLA | Complaints received / resolved | Field received / completed | Collection | Expected close |
| --- | --- | --- | --- | --- | --- |
| D0 | 6 / 4 / 3; avg days 1.5 | 2 / 1 | 3 / 2 | ₹123.45 | (12,4,6) |
| D1 | No report | No report | No report | No report | Carries (12,4,6); still missing |
| D2 | 3 / 2 / 2; avg days 2 | 1 / 0 | 2 / 1 | ₹10.01 | (13,5,7) |

For D0–D2/service 1: received 9; completed 6; SLA 5; collection **13,346 paise / ₹133.46**; disposal **66.7%**; SLA **83.3%**; closing stocks **13/5/7**; reports **2/3**, not 3/3. Without a service filter expected reports are **75**, still only 2 submitted. Changing D0 completed from 4 to 5 changes later work closing to 12. Increasing D0 completed to 7 must reject because it exceeds D0 receipts of 6, even though the opening balance could cover it. Repeat the daily-cap checks for complaints and field tasks.

The oracle follows the confirmed same-day cap. Nonnegative opening balances plus daily received ≥ completed imply new compliant records cannot create a later negative closing balance. Preserve negative-later protection as a legacy compatibility test only: synthetic old-policy rows may use opening 0, D0 received 10/completed 0, D2 received 0/completed 10; reducing D0 receipts to 9 would create a negative later balance and must reject. Do not create that noncompliant D2 row through the normal current UI/API. Actual legacy-data staging verification is conditional on a supported isolated fixture or existing legacy dataset; it is not a reason to relax the new cap.

## Coverage rules

“Comprehensive” means every audited route, user action, visible state, validation rule, API operation, permission boundary, and data transition has an ID and evidence. It does not mean an unbounded Cartesian product of every input. Use exhaustive small enumerations (six offices, 25 services, seven count fields), boundary-value tables for ranges, state-transition tests for navigation/edits, and pairwise sampling for presentation combinations.

Mandatory enumeration:

- Local create, read, edit, cancel, save and reload for **each of 25 services** in both Today and Backdate; include catalog label, stable ID, correct record key and progress. All six office identities receive route and isolation checks.
- Staging all **150 office/service combinations** receive catalog/read/isolation verification. A controlled submission campaign creates one report for each combination; include both zero and nonzero reports. Across all six offices exercise Today, new Backdate, correction and persistence. Historical/backlog/date-chain cases use separately reserved tuples.
- Every numeric field receives the count boundary table, not just `received`. All 75 setup inputs receive persistence checks; invalid cases iterate each balance kind and representative first/middle/last services.
- Each local endpoint/state receives applicable 401/403/409/422/429/5xx, abort/offline, slow and malformed-response cases. Actual status codes must be pinned to the backend contract before S assertions are implemented.
- All pages and reachable error/empty states receive keyboard/axe checks. Full English and Hindi principal journeys; language switching during setup/draft/edit/error/detail views preserves business state.

Use desktop Chromium for the complete deterministic matrix. Run principal journeys plus date/input/navigation/cookie checks on Firefox and WebKit. Use mobile Chromium and WebKit at 390×844 and 320px narrow width, plus 768, 1100, 1500 and 1920 widths where layout changes. Check 200% zoom, portrait/landscape and reduced motion. Test dark styling because it exists and existing tests assert it; no theme-toggle feature is assumed.

## Execution sequence and deliverables

| Phase | Work and deliverable | Exit condition |
| --- | --- | --- |
| 0. Contract and scope | Apply confirmed backend-only history, same-day completion cap, retained pre-start pending work, manual dashboard refresh and open-register preservation; record actual staging endpoints, envelopes/statuses, cookies, hosting paths and fixture reset | Behavior decisions recorded; dataset and backend contract/version identified |
| 1. Harness repair | Plan modifications to `playwright.config.ts` and existing specs; local webServer at a stable port with `/anchal/` URLs; separate local/staging projects; guarded staging writes; fixtures/assertion helpers; HTML/JSON/JUnit results and traces | Fail-closed local smoke test; real staging auth preflight; no silent data-dependent skips |
| 2. Access/setup | AUTH, ROUTE, SETUP, SHELL scenarios; serial staging fresh-office phase | First-run and returning-user journeys proven with correct role/account boundaries |
| 3. Office reporting | TODAY, VALID, BACK, EDIT, DRAFT, TIME scenarios and all-service campaign | Correct persisted records, immutable timestamps and safe draft behavior |
| 4. Integrity | LEDGER, WRITE and SEC; concurrent contexts and lost-response tests | Exact independent oracle; no duplicate/partial writes; authorization verified at API layer |
| 5. Commissioner and audit | DASH, FILTER, DETAIL, LIVE; backend HIST checks | Cross-role end-to-end reconciliation, correct filters, backend audit integrity; no frontend history |
| 6. Resilience and usability | FAIL, I18N, A11Y, VIS; cross-browser and deployment deep-link pass | Recovery works; accessible controls and readable empty/error/data states |
| 7. Handover | Full clean run, repeat critical writes/conflicts/date/filter races, headed office-to-commissioner walkthrough, evidence report and defect disposition | Release gate below |

Proposed suite boundaries: `environment`, `auth`, `routing`, `setup`, `today`, `backdate`, `validation`, `corrections`, `drafts`, `time`, `ledger`, `concurrency`, `authorization`, `dashboard`, `filters`, `details`, `refresh`, `backend-audit`, `resilience`, `localization`, `accessibility`, `visual`, and `handover-journeys`. Keep helpers in `tests/browser/fixtures/` (transport/data/auth/environment) and `tests/browser/helpers/` (form actions, oracle assertions, artifact capture). These are proposed implementation targets, not files created in this planning pass.

Retain existing scenarios only after porting their URL contracts/selectors and splitting tests that combine unrelated failures. Local fixtures should not rely on login helpers that secretly complete setup. Real login gets its own tests; pre-authenticated contexts can accelerate unrelated scenarios. Clear browser storage and query cache between account identities; close manually created contexts in `finally` blocks.

Use locator-driven waits and response/state assertions. Clock control handles local midnight and proves that elapsed idle time does not trigger dashboard polling; never use arbitrary sleeps to mask a race. Register dialog/response handlers before the triggering action. A response injected before a write is not a lost-after-commit test: prove the backend committed once, then lose the response and retry. Use a controlled proxy or backend fixture hook if required; otherwise mark the true post-commit scenario blocked.

Keep local browser time control separate from server time. Staging midnight validation requires an agreed backend test clock or a scheduled real-boundary test; a mocked browser clock alone cannot prove server date enforcement.

## State and failure acceptance rules

- First loading is distinguishable from zero activity or a true empty result. A failed read must not display a successful-looking zero dashboard.
- Empty setup, unconfigured office, configured/no reports, missing daily reports, zero activity and no matching detail rows are different states and retain their meaning in totals.
- Validation identifies the affected field, is keyboard reachable and preserves entered data. Browser constraints complement server checks; bypassed HTML attributes must not permit invalid writes.
- Failed writes preserve the draft and leave data/audit/progress unchanged. A committed write followed by failed refresh explains that distinction and permits safe recovery.
- Conflict recovery cannot silently overwrite another user's correction or discard a draft before an explicit decision. Same payload retries reuse request identity; changed payloads obtain a new one.
- Permission is proved by actual server responses and absence of unauthorized records; a redirect or hidden button alone is insufficient.
- Filter changes must never label stale old-filter metrics/details as the new selection. Same-filter refresh must preserve the user's review context.
- Manual refresh acceptance: an office submission does not automatically update the commissioner's loaded snapshot. Clicking Refresh fetches the latest committed data for the selected filters, with a loading/busy indication and safe repeat-click handling. Timer advancement, tab focus and reconnection do not silently refresh. There is no two-second or 20-second automatic propagation gate. Initial load, explicit filter changes and explicit detail opening remain ordinary user-triggered reads.

## Evidence and handover gate

Each expanded test title includes the scenario ID, role, data variant and browser. A machine-readable report maps IDs to spec/test, layer, run result, retries, defect, and artifacts. Allowed results: not implemented, passed, failed, blocked, explicitly excluded with named scope decision. Skipped or flaky-on-retry is not a clean pass. Track local and staging results separately.

Store artifacts under `output/playwright/<run-id>/`: run manifest, coverage report, HTML/JSON/JUnit output, failure traces/screenshots/video, important request/response assertions with secrets redacted, arithmetic reconciliation and reviewed visual baselines. Trace/network artifacts may contain synthetic credentials or session cookies; restrict access and redact before handover sharing. Capture steps/results, not only final screenshots. Record unexpected console errors, uncaught exceptions, failed requests and old `/api` traffic, with narrow documented allowances for deliberately injected failures.

Release requires:

1. Every required scenario family is implemented and every parameter variant has an outcome; no missing P0 coverage, unresolved P0 failures, or silently skipped required scenarios.
2. All handover-critical P1 flows pass; other known issues have a documented owner, impact, workaround and explicit acceptance. A percentage alone never overrides an authorization or integrity failure.
3. Local deterministic suite and actual staging journeys both pass on the same candidate frontend revision and recorded backend version.
4. The all-office/all-service campaign reconciles exactly; corrections, backlog, timestamps, incomplete reporting, retries and conflicts are verified from independent reads.
5. Two consecutive clean runs of critical journeys/race cases using reset isolated fixtures; retries must not conceal flaky failures.
6. No unaccepted serious/critical axe violations; keyboard and visual review cover setup, entry, backdate, dashboard, details, empty/error and mobile drawer states. Frontend history is excluded. Automated axe alone does not establish accessibility conformance.
7. Current setup/test instructions work from a clean checkout, including deployment subpath/API routing. Historical Worker instructions are corrected or clearly archived.
8. Handover report states tested revision/environment, coverage, failures/accepted exclusions, fixture cleanup and residual limitations. It never says “every possible scenario” was proved.

## Behavior decisions complete; next execution prerequisites

The behavior-alignment step is complete: no frontend history, retained backend audit, same-date completion limits, pre-start opening work left pending, manual dashboard refresh, and preserved open-register/filter state with refresh of both rows and totals. These decisions supersede conflicting expectations in older specs and tests. No application behavior has been changed by this documentation step.

Next, prepare local deterministic fixtures and identify the staging frontend URL, isolated backend dataset/reset mechanism, account aliases/credentials through private configuration, and actual backend contract/version. Then repair the test harness and implement the confirmed acceptance scenarios. Product discrepancies discovered by those tests remain implementation work; this planning decision does not claim they are fixed.
