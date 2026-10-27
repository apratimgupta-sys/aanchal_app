# Handover scenario and coverage matrix

Date: 19 October 2026. Companion: [test plan and handover gates](../superpowers/specs/2026-10-19-handover-testing-design.md).

Inventory: **211 scenario families across 23 areas**; 120 P0, 89 P1 and 2 P2. Parameterized office/service/input/browser variants expand beyond these family counts.

**Confirmed scope decision, 19 October 2026:** no Change History on the frontend for either role; keep backend audit capability for possible future frontend use. HIST-05, HIST-06 and HIST-08 are explicitly deferred presentation families and excluded from the release gate. Other audit assertions use backend/API evidence; browser journeys contain no history-screen step. The missing history screen is intentional.

**Confirmed completion rule, 19 October 2026:** completions/resolutions are limited to the corresponding receipts on the same service date for service work, complaints and field tasks. Opening balances do not increase the allowance. Permitted pending-work updates use backdated entries/corrections with reasons in the backend audit. The user confirmed that opening work from before the reporting start stays pending for this handover, with no exception to the date boundary. Do not fabricate receipts, extend the start or alter the locked baseline to clear it.

**Confirmed refresh decision, 19 October 2026:** initial and filter-driven dashboard reads plus manual Refresh; no polling, live connection or automatic focus/reconnect refresh. No automatic propagation latency target or required live-status indicator. A failed manual refresh preserves the previous snapshot with a clear error. LIVE IDs below are retained as stable identifiers but now test manual refresh and the absence of unsolicited reads. The user confirmed that Refresh keeps an open service-entry register open, retains filters, and updates both its rows and the dashboard totals; failed/partial refresh must not silently close it or claim both sections updated.

All rows are **planned / not executed by this audit**. Existing test overlap below is an inventory, not acceptance evidence. A row is a scenario family: expand enumerations and boundary tables into named tests. Record each expanded result separately. `L` = deterministic local Playwright; `S` = real staging browser/API verification; `D` = supporting domain/transport tests. P0 = access, integrity or indispensable journey; P1 = required feature/recovery; P2 = supplementary presentation/robustness. See the plan for release gates; P2 does not mean optional by default.

Expected outcomes describe the intended acceptance contract, including known gaps, rather than codifying every current behavior. Proposed timing/UX requirements are labeled in the plan and require review. For an invalid operation, assert **no write, no new audit event, no progress increment, no changed balances**, as well as the error. Every valid save must be reread independently after reload or in a new context.

## Source key

| Key | Code or requirement source |
| --- | --- |
| APP | [`App.tsx`](../../src/client/App.tsx), [`portal-path.ts`](../../src/client/portal-path.ts) |
| AUTH | [`Login.tsx`](../../src/client/pages/Login.tsx), APP, transport |
| SET | [`InitialBalances.tsx`](../../src/client/pages/InitialBalances.tsx) |
| ENTRY | [`DailyEntry.tsx`](../../src/client/pages/DailyEntry.tsx) |
| DASH | [`Dashboard.tsx`](../../src/client/pages/Dashboard.tsx) |
| LEDGER | [`ledger.ts`](../../src/domain/ledger.ts), [`types.ts`](../../src/shared/types.ts) |
| IO | [`api.ts`](../../src/client/api.ts), [`mutation.ts`](../../src/client/mutation.ts), [`query.ts`](../../src/client/query.ts) |
| SHELL | [`AppShell.tsx`](../../src/client/components/AppShell.tsx), [`ui.tsx`](../../src/client/ui.tsx), [`main.tsx`](../../src/client/main.tsx) |
| LANG | [`i18n.tsx`](../../src/client/i18n.tsx), [`dates.ts`](../../src/client/lib/dates.ts), [`services.json`](../../src/shared/services.json) |
| HOST | [`vite.config.ts`](../../vite.config.ts), [`vercel.json`](../../vercel.json), [`playwright.config.ts`](../../playwright.config.ts) |
| HISTORY | [`audit.ts`](../../src/client/audit.ts), [approved routed workflow](../superpowers/specs/2026-10-05-anchal-entry-workflow-design.md) |
| UI-SPEC | [13 October UI design](../superpowers/specs/2026-10-13-shadcn-government-ui-design.md) |
| API-SPEC | [7 October API integration design](../superpowers/specs/2026-10-07-anchal-frontend-integration-design.md) |

## ENV — execution and deployment prerequisites

Sources: HOST, IO, API-SPEC. No staging browser write runs before ENV-03/04 pass.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| ENV-01 | Launch local harness without backend credentials; visit `/anchal/` | App/assets load; all application requests are intercepted; unexpected path/method fails; zero external backend traffic including sockets | L | P0 |
| ENV-02 | Exercise all local route handlers and intentional error fixtures | Actual `/v1/api/anchal` path is matched; request bodies/query values verified; no generic fallback success masks a mismatch | L | P0 |
| ENV-03 | Start staging project with missing URL, credentials, run manifest, dedicated dataset or write opt-in | Explicit preflight failure before any mutation; no default-password fallback or automatic production/shared-office selection | S | P0 |
| ENV-04 | Initialize/reset approved isolated staging fixtures | Correct backend/build/tenant; fresh/configured account states verified; reserved uniqueness keys clear; existing non-test data unchanged | S | P0 |
| ENV-05 | Serve built frontend through intended hosting/proxy arrangement | `/anchal/`, assets and all deep links work; API responses are JSON, not SPA HTML; cookies set/sent through correct domain/path | S | P0 |
| ENV-06 | Block external font/logo resources or simulate failed asset loading | Usable readable fallback; no broken essential actions; logo alt text; lazy-chunk failure has actionable recovery | L | P1 |
| ENV-07 | Run complete suite twice with reset fixtures | No order dependency, dynamic data-dependent skips, leaked sessions, duplicate tuples, or artifacts overwriting other runs | L/S | P1 |

## AUTH — beginning and end of the session

Sources: AUTH, APP, IO. Parameterize successful office sign-in across all six accounts.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| AUTH-01 | First unauthenticated visit; delay `/session`, then return 401 | Loading shown, then sign-in; no protected-data flash; controls become usable | L/S | P0 |
| AUTH-02 | Submit blank/whitespace username and blank password independently and together | Associated required errors; trimmed username rule; no login request until valid | L | P1 |
| AUTH-03 | Sign in as each office with valid credentials | Cookie-backed session, correct office identity; fresh office → setup, configured office → Today | L/S | P0 |
| AUTH-04 | Sign in as commissioner | Dashboard and commissioner identity; office setup/actions absent | L/S | P0 |
| AUTH-05 | Wrong username, wrong password, unknown account, password with spaces | Authentication denied clearly; password not silently trimmed; no session or account-enumeration leak in error distinctions | L/S | P0 |
| AUTH-06 | Submit by Enter; rapid Enter/click while response delayed | Correct payload; one pending attempt; busy/disabled state; successful continuation once | L/S | P1 |
| AUTH-07 | Fail login with network abort, 429 or 5xx, then recover | Actionable error, preserved username, no false success; retry available; contract-defined rate-limit behavior | L/S | P1 |
| AUTH-08 | Reload/new tab/new context after login | Existing cookie session restores correct role; independent context remains signed out; password never in localStorage/URL | L/S | P0 |
| AUTH-09 | Expire session on setup/read/create/correction/dashboard/details requests | Clear sign-in requirement and safe recovery; no unauthorized save; draft handling follows approved policy; no anonymous-looking zero success | L/S | P0 |
| AUTH-10 | Successful logout, then reload, browser Back and direct protected URL | Session invalid server-side; protected content not restored by cache; sign-in required | L/S | P0 |
| AUTH-11 | Fail/delay logout | No unhandled rejection or misleading logged-out claim; explain failure and permit retry; protected APIs still enforce actual session state | L/S | P1 |
| AUTH-12 | Logout office A, login office B then commissioner in same browser | No stale form, setup, metrics, details or query cache from previous identity; language may persist but business data may not | L/S | P0 |
| AUTH-13 | Change/expire cookie in a second tab while first tab is open | Next read/write cannot continue as previous authenticated identity; recover without cross-account data exposure | S | P0 |

## ROUTE — navigation, deep links and role boundaries

Sources: APP, HOST, SHELL. Test links through the real browser history, not only synthetic popstate events.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| ROUTE-01 | Signed out: open every protected deep link | Login gate; no protected read/write initiated under a fake client session | L/S | P0 |
| ROUTE-02 | Fresh office: open Today, Backdate, setup, dashboard, unknown route | Redirect to setup; entry APIs not called before setup completes | L/S | P0 |
| ROUTE-03 | Configured office: login, open setup/dashboard/unknown route | Canonical Today route; setup not editable; no commissioner data | L/S | P0 |
| ROUTE-04 | Commissioner: open office Today/Backdate/setup and unknown route | Canonical commissioner dashboard; office controls absent | L/S | P0 |
| ROUTE-05 | Office Today ↔ Backdate via nav and browser Back/Forward | Correct active nav, date mode, fields and request; clean navigation has no discard prompt | L/S | P1 |
| ROUTE-06 | Refresh every `/anchal/...` route; include trailing slash and query/hash | Supported canonical route loads assets/session and same role gate; unsupported variants recover clearly | L/S | P1 |
| ROUTE-07 | Visit `/anchal`, `/anchal/`, malformed sibling prefix `/anchal-other`, unprefixed legacy route | Hosting/base-path boundaries explicit; no prefix confusion or accidental API/asset rewrite | L/S | P1 |
| ROUTE-08 | Open legacy history deep link as office and commissioner | No history screen/nav exposed; recover to the appropriate role's supported route; backend audit capability unaffected | L/S | P1 |

## SETUP — first-use reporting baseline

Sources: SET, APP, LEDGER. Use FRESH and BASELINE; irreversible staging cases require resettable fixtures.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| SETUP-01 | Open fresh setup in both languages | Exactly 25 catalog services, IDs unique 1–25; three correctly labelled balance inputs each; date defaults to IST today; explicit zero confirmation unchecked | L/S | P0 |
| SETUP-02 | Attempt save without confirmation; toggle confirmation | Save disabled until confirmed; no request before confirmation; keyboard checkbox works | L/S | P1 |
| SETUP-03 | Enter distinct nonzero signatures in all 75 fields; save with historical start | Exact service/kind mapping in request and persisted setup; one save event; redirect Today; correct opening balances for each service | L/S | P0 |
| SETUP-04 | Confirm/save all zero balances | Valid intentional setup; zero baseline retained; returning login bypasses setup | L/S | P0 |
| SETUP-05 | Date blank, invalid date, today, yesterday, future; bypass DOM max | Invalid dates rejected with visible field feedback; no setup; valid past/today retained exactly | L/S/D | P0 |
| SETUP-06 | Empty, negative, fractional, limit/over-limit/unsafe balance variants | Every balance kind rejects invalid input with field feedback; valid 0 and allowed max accepted; no partial setup | L/S/D | P0 |
| SETUP-07 | Delay save; double click/Enter; retry after lost response | Single baseline and audit event; stable request identity; busy prevents duplicate submission | L/S | P0 |
| SETUP-08 | Fail setup write with validation/conflict/server/network failure | All 75 inputs/date/confirmation retained; no false redirect; actionable retry | L/S | P1 |
| SETUP-09 | After save, revisit setup and directly repeat/change PUT | Baseline/start date immutable; backend rejection; original version, balances and reports unchanged | L/S | P0 |
| SETUP-10 | Two contexts load fresh setup, submit different baselines concurrently | One initial setup wins; second clear conflict; no mixed balances or two audit events | L/S | P0 |
| SETUP-11 | Setup API fails during returning login/session refresh | Distinguish setup outage from absent baseline and invalid credentials; retry safely, never offer overwrite | L/S | P1 |
| SETUP-12 | Navigate, reload, close or sign out with an unfinished setup | Test actual draft-loss behavior; intended warning/preservation policy explicit; accidental irreversible values not saved | L | P1 |

## TODAY — daily reporting for all 25 services

Sources: ENTRY, LEDGER, LANG. Run create/read/edit mapping for IDs 1–25; both zero and nonzero reports.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| TODAY-01 | Configured office with no entries | 0/25; all service statuses missing; first service selected; seven counts/money blank, dates/openings correct, no service-date chooser | L/S | P0 |
| TODAY-02 | Select each service by visible name/keyboard | Matching ID/category/bilingual names; own opening balance and saved status; correct selected indicator; no neighboring record leakage | L/S | P0 |
| TODAY-03 | Fill every field and submit nonzero activity | Exact values including paise; `mode=today`, today's service date, expectedVersion null; backend derives office/registration; saved read-only state | L/S | P0 |
| TODAY-04 | Use Set zero activity on new report | Seven counts zero, money 0.00, average null; Ward/Remarks preserved; not yet submitted; intentional submit still required | L/S | P1 |
| TODAY-05 | Submit zero activity with Ward | Valid report increments submission, preserves pending stocks; differs from missing report in completeness | L/S | P0 |
| TODAY-06 | Submit services through 1/25, 24/25 and 25/25 | Exact unique progress/statuses and accessible progressbar; correction does not increment count | L/S | P0 |
| TODAY-07 | Read existing report after reload/re-login | Exact persisted values and openings; read-only inputs/textareas; no new-submit action; Edit available | L/S | P0 |
| TODAY-08 | Two Wards for same office/service/day | Ward is descriptive; changing it is a correction, not a second record; no duplicate report key | L/S | P0 |
| TODAY-09 | Same day/service across two offices and adjacent services | Independent records/openings/progress; writes cannot cross office or service | L/S | P0 |
| TODAY-10 | Change inputs and inspect closing preview before save | Work, complaints and field previews independently equal opening + received − completed; blank shows dash, never NaN/Infinity | L/D | P1 |
| TODAY-11 | Delay/fail initial entries load; Retry | Distinct loading/error/retry; form not seeded with false zero openings; successful retry restores correct service/day | L/S | P1 |

## VALID — field and cross-field boundaries

Sources: ENTRY, SET, LEDGER, IO. Apply the boundary table near the end to each applicable field.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| VALID-01 | Submit blank or whitespace-only Ward; lengths 1, 200, 201 | Required/limit feedback; valid English/Hindi Ward stored correctly; no whitespace-only saved Ward | L/S/D | P0 |
| VALID-02 | For each of seven counts: blank, 0, 1, negative, decimal, upper bound and beyond | Nonnegative whole-number enforcement; blank ≠ zero; coherent browser/server errors; safe integers only | L/S/D | P0 |
| VALID-03 | Nonzero opening; completed equals same-date receipts, then exceeds them by 1; repeat with zero receipts | Equal accepted, excess rejected even when openings cover it; receipts 0 permit only completion 0; repeat for complaints resolved and field completed; backend enforces rule | L/S/D | P0 |
| VALID-04 | SLA completed 0, equal completed, greater by 1 | No SLA above completions; denominator zero renders dash on dashboard; no other field reset | L/S/D | P0 |
| VALID-05 | Amount exact decimal variants and limits | Exact integer paise; no rounding drift or exponent/grouped/negative acceptance; documented backend max enforced | L/S/D | P0 |
| VALID-06 | Avg days null/0/0.01/1.50/100000/over-limit/negative | Null allowed only when completed=0; finite valid nonnegative decimals accepted; required/max errors actionable | L/S/D | P1 |
| VALID-07 | Remarks empty, Hindi, multiline, 2000/2001 chars | Optional blank supported; boundary honored; text preserved and escaped in register; backend audit retains exact values | L/S/D | P1 |
| VALID-08 | Delay/correction reason empty, spaces, 1/1000/1001 chars | Trimmed nonempty reason required in applicable modes; limit enforced server-side; error associated with reason | L/S | P0 |
| VALID-09 | Server returns field errors for Ward, amount, reason, serviceDate and unknown field | Known fields visibly linked; unmatched errors still actionable; no silent error; draft values intact | L | P1 |
| VALID-10 | Tamper HTML limits/readOnly and raw JSON input types | Backend rejects null/string/object/NaN representation, invalid IDs/dates/counts and forged office/metadata as defined by contract | L/S | P0 |
| VALID-11 | Correct an invalid value, then resubmit | Error clears at appropriate time; only valid payload commits; no stale success/error or stuck busy state | L/S | P1 |

## BACK — reporting prior service dates

Sources: ENTRY, APP, LEDGER. New Backdate and correction are different paths.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| BACK-01 | Setup starts today; open Backdate | Explanatory unavailable state, no invalid date control or entries request; Today remains usable | L/S | P1 |
| BACK-02 | Historical setup; open Backdate | Default yesterday IST; min=start date/max=yesterday; delayed reason for new row | L/S | P0 |
| BACK-03 | Submit on start date and yesterday | Both inclusive; mode backdate; current server registration date/time; chosen service date retained | L/S | P0 |
| BACK-04 | Select before start, today, future, invalid/blank date; bypass picker | Clear validation, no save; setup/start unchanged; no request loop or crash | L/S/D | P0 |
| BACK-05 | New historical report with missing/whitespace reason | No write; delayed-reporting reason required; not mislabeled as correction | L/S | P0 |
| BACK-06 | Save new historical report with reason | Stored once; reason in audit; older movement reflected in future openings and commissioner period totals by service date | L/S | P0 |
| BACK-07 | Select another historical date with existing/absent record | Correct record/openings/status per date; no moving/rekeying the previous entry or stale values | L/S | P0 |
| BACK-08 | Edit saved historical row | Correction reason, not a new delayed reason; immutable original registration; expected saved version sent | L/S | P0 |
| BACK-09 | Switch Today ↔ Backdate after clean save | Today has no delayed reason/date picker; Backdate fields/mode reset coherently; service identity correct | L/S | P1 |
| BACK-10 | Report/correct work on permitted earlier dates with reasons; attempt pre-start backfill for carried-in opening work | Same-date cap and chronological recomputation apply; earlier-than-start entry rejected; carried-in work stays pending with no duplicate receipts, baseline change or date-boundary exception | L/S/D | P0 |

## EDIT — corrections and persisted identity

Sources: ENTRY, IO, LEDGER, HISTORY.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| EDIT-01 | Click Edit for saved Today/Backdate report | Business fields editable; correction reason appears; no write before Save | L/S | P0 |
| EDIT-02 | Change every editable field and save correction | PUT correct saved ID/version; version increments once; all values persist; record count stable | L/S | P0 |
| EDIT-03 | Edit then Cancel with changed Ward, counts, money, average, remarks, reason | Exact saved values/read-only state restored; fields/errors cleared; no write, new version or history event | L/S | P1 |
| EDIT-04 | Correct a saved report without reason | Required actionable reason error; original report remains unchanged | L/S | P0 |
| EDIT-05 | Correct a report then inspect serviceDate, reportingDate, createdAt and officeId | Identity and first-registration values immutable; only updated timestamp/version changes | L/S | P0 |
| EDIT-06 | Submit unchanged values with a reason | Contract-defined no-op/version/audit semantics; user receives accurate result; no duplicate record or invented business diff | L/S | P1 |
| EDIT-07 | Save correction, reload, inspect commissioner and backend audit | Saved report/dashboard/backend audit reconcile; before/after/reason correct; original registration retained; no frontend history required | L/S | P0 |
| EDIT-08 | Invoke Set zero activity while editing | Pending preview recalculated, Ward/Remarks retained; correction reason still required; Cancel restores saved activity | L/S | P1 |

## DRAFT — unsaved changes and navigation

Sources: ENTRY, APP, SHELL. Repeat with numeric-only, money-only, reason-only and text-only dirtiness.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| DRAFT-01 | Dirty report; choose different service; dismiss prompt | Selected service/URL/fields/error context unchanged; exact draft retained | L | P0 |
| DRAFT-02 | Dirty report; choose different service; accept prompt | Old draft discarded; new service has its own defaults/saved values; submitted ID must match new selection; GAP-07 target | L/S | P0 |
| DRAFT-03 | Dirty Backdate; choose another date; accept/dismiss | Dismiss preserves old date/data; accept loads only new date and clears old draft; correct save key | L/S | P0 |
| DRAFT-04 | Dirty report; navigate Today ↔ Backdate; accept/dismiss | Dismiss preserves route and draft; accept resets cleanly for destination mode; no unintended save | L | P0 |
| DRAFT-05 | Dirty report; browser Back/Forward; accept/dismiss repeatedly | Correct history/URL/active tab; no phantom extra navigation, stale route or lost draft on dismissal | L | P1 |
| DRAFT-06 | Dirty report; Sign out; accept/dismiss | Dismiss performs no logout; accept discards only after explicit action and follows logout error policy | L/S | P0 |
| DRAFT-07 | Dirty report; reload/tab-close/external navigation | Browser-supported unsaved-change protection verified with user activation; any unsupported persistence limitation recorded | L | P1 |
| DRAFT-08 | Dirty report; click current service/current nav | No draft loss or accidental reset; unnecessary discard prompt treated as UX defect | L | P1 |
| DRAFT-09 | Edit field back to saved value; cancel edit; save successfully | Dirty-state policy consistent; canceled/saved forms stop prompting; clean forms do not warn | L | P1 |
| DRAFT-10 | Change language/viewport or open mobile drawer; refresh commissioner in separate context | Office draft and selected identity unchanged; no mutation or unexpected navigation | L | P1 |

## TIME — IST and temporal state transitions

Sources: ENTRY, LANG, APP, LEDGER. Local clock tests must not be reported as server-clock proof.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| TIME-01 | At 18:29:59Z then 18:30:00Z in browser timezones UTC/Kolkata/Los Angeles | Service day/registration display uses IST consistently, not OS day | L/D | P0 |
| TIME-02 | Clean Today form crosses IST midnight | Within refresh trigger loads new today; new date/openings/saved state; no spurious previous-day submission | L | P0 |
| TIME-03 | Dirty Today draft crosses midnight by timer, focus and visibility | Warning shown; submit disabled/guarded; original draft date/values retained | L | P0 |
| TIME-04 | Continue previous-day draft in Backdate | Route/date/selected service/all fields preserved; delayed/correction reason appropriate; valid submit targets prior day | L | P0 |
| TIME-05 | Discard old draft and start today | Old values/reason/edit state removed; today's openings/entries loaded; no old-date write | L | P1 |
| TIME-06 | Tab sleeps across several days; resume and submit before interval fires | Live submit guard catches date change; no misdated write; correct available Backdate range | L | P0 |
| TIME-07 | Cross month/year ends and leap day | Yesterday/min/max and monthly last day correct for 28/29/30/31-day months; invalid dates rejected | L/D | P1 |
| TIME-08 | Backend registration around IST boundary; reload/correct | Actual server timestamps immutable and formatted correctly; client cannot forge registration | S | P0 |
| TIME-09 | Commissioner stays open across midnight, then explicitly refreshes selected period | No idle/automatic refresh; selected date labels remain honest; Refresh retains selected filters and correct expected-report calculation | L | P1 |
| TIME-10 | Browser/server clocks disagree; direct Today/Backdate save | Server authoritative date checks; safe explanatory rejection instead of silent reassignment | S | P0 |

## LEDGER — independent arithmetic and report completeness

Sources: LEDGER, ENTRY, DASH. Use the exact oracle in the plan and independent expected constants.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| LEDGER-01 | Opening + receipts − disposals for all three tracks, with all new receipts completed | Preview, saved response, subsequent opening, dashboard and details agree exactly; carried-in opening pending remains after net-zero new activity | L/S/D | P0 |
| LEDGER-02 | Plan's D0/D1/D2 dataset respecting same-date caps | Received 9/completed 6/SLA 5/₹133.46/closing 13,5,7; disposal66.7%, SLA83.3%; correct missing report count | L/S/D | P0 |
| LEDGER-03 | Day without report between two reports | Stocks carry forward; period activity remains unsynthesized; missing day remains incomplete | L/S/D | P0 |
| LEDGER-04 | Explicit zero report on missing day | Stocks unchanged; submitted count increases by one; no artificial transactions | L/S/D | P0 |
| LEDGER-05 | Valid historical correction and insertion | Later openings/closings recalculate, period flows change only for affected service dates; no duplicate entries | L/S/D | P0 |
| LEDGER-06 | Legacy compatibility fixture only: earlier correction would make a later old-policy disposal negative | Atomic rejection; later records/audit/version unchanged. New records must obey same-date cap; never create an invalid current-policy record to seed this test | L/D; S if legacy fixture supported | P0 |
| LEDGER-07 | Period starts before setup, ends before setup or contains setup day | Expected count clipped to start and today; pre-setup stocks zero; on/after setup opening balances represented | L/S/D | P0 |
| LEDGER-08 | Filter service versus all services and one office versus six | Independent sums, no double counting; completeness uses 1 versus 25 services per eligible day | L/S/D | P0 |
| LEDGER-09 | Different office receipt weights, zero denominators and compliant reports | TOTAL rates are ratio of summed counts, not average percentages; dash for zero denominator; compliant reports cannot yield disposal >100%. Display of existing >100% legacy data must remain numerically honest without permitting new invalid writes | L/S/D | P0 |
| LEDGER-10 | Large valid values across services/days/offices | Exact safe arithmetic, integer paise; no overflow, Infinity or rounding accumulation; backend aggregate limits documented | L/S/D | P1 |

## WRITE — concurrency, retry and atomic persistence

Sources: IO, ENTRY, SET, LEDGER. Use independent contexts and prove final state through read APIs.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| WRITE-01 | Rapid duplicate submit/correction while request pending | Button busy/disabled; one logical write/version/audit/progress change | L/S | P0 |
| WRITE-02 | Commit save, lose successful response, retry identical payload | Same requestId; original result returned or equivalent idempotent response; exactly one row/version/audit event | L/S | P0 |
| WRITE-03 | Fail attempt, change any payload field/reason/mode/service/date, retry | New intent/requestId; no old-payload replay; correct new values and key | L/S/D | P0 |
| WRITE-04 | Two contexts create same office/service/date concurrently | One unique record; loser clear conflict/reload path; no overwrite or duplicate event | L/S | P0 |
| WRITE-05 | Two contexts edit version N; A saves then B submits stale version | B rejected; A's values intact; B draft not silently overwritten; explicit reload/reapply recovery | L/S | P0 |
| WRITE-06 | Same requestId with changed body, reused IDs across users | Contract-defined conflict; no cross-office replay/result leakage | S | P0 |
| WRITE-07 | Write succeeds but follow-up GET fails | Explain committed save versus stale view; no false coherent success; retry refresh cannot create duplicate; GAP-08 | L/S | P0 |
| WRITE-08 | Backend fails before/during mutation via controlled fault hook | Entry/setup, version, audit and revision remain atomic; no partial balances or success notification | S | P0 |
| WRITE-09 | Abort navigation/context during save, reopen entry | Actual committed state discovered, no ambiguous duplicate write; discarded client state does not imply server rollback | L/S | P1 |
| WRITE-10 | Correct same row sequentially several times | Monotonic versions; exact reason/before/after sequence; immutable registration; retries not extra revisions | L/S | P0 |
| WRITE-11 | While save/read is delayed, edit more fields or switch service/date/route; release old response | Pending payload remains identifiable; late response cannot overwrite newer draft/selection or label another record saved; verify actual committed tuple independently | L/S | P0 |

## SEC — server authorization and isolation

Sources: APP, IO, shared contracts, backend contract required. Run with unauthenticated, office A, office B and commissioner cookies.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| SEC-01 | Unauthenticated read/write to every protected endpoint | Contract-defined 401; zero protected data or writes; no frontend-only enforcement | S | P0 |
| SEC-02 | Office A reads/updates office B entry ID, filters or forged officeId | Denied/scoped without B data; B unchanged; no existence leak beyond agreed contract | S | P0 |
| SEC-03 | Office attempts commissioner dashboard/detail and any retained backend audit read scopes | Backend role policy enforced; office cannot enumerate other offices through queries/direct API; no frontend history required | S | P0 |
| SEC-04 | Commissioner invokes setup/create/correct/delete office endpoints | Read-only role enforced server-side; no mutation despite hidden UI | S | P0 |
| SEC-05 | Unconfigured office directly reads/writes entry-dependent endpoints | Setup gate enforced by server; no activity created before baseline | S | P0 |
| SEC-06 | Forge registrationDate/createdAt/version/service key/office identity | Server authoritative identity/time/version; key mutation rejected; original record retained | S | P0 |
| SEC-07 | Tamper service IDs 0/26/fraction/string, unknown entry ID, invalid office filter | Clear safe validation/not-found/forbidden per contract; no 500 or unintended fallback to all data | L/S | P0 |
| SEC-08 | Logout/expire session then replay old cookies/write requests | Server rejects revoked/expired sessions; no successful replay of protected data | S | P0 |
| SEC-09 | Cross-origin mutation and missing/invalid anti-forgery context | Backend cookie/origin/CSRF policy verified against actual deployment; unauthorized origin cannot mutate | S | P0 |
| SEC-10 | Ward/remarks/reason contain HTML, script-looking text, SQL-like text and Unicode | Displayed as literal text in form/register; backend audit preserves values; no script execution, broken table, altered query or data loss | L/S | P1 |
| SEC-11 | Repeated invalid login attempts on isolated account | Actual rate-limit/reset contract enforced; valid accounts and parallel offices remain usable; no real shared-account lockout | S | P1 |

## DASH — commissioner overview and six metrics

Sources: DASH, LEDGER, UI-SPEC.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| DASH-01 | Commissioner login; initial read delayed then loaded | Clear loading; six-office rows, six metrics and total row; no premature successful-looking zeros | L/S | P0 |
| DASH-02 | All offices unconfigured versus configured with no reports | Different empty/setup-needed/completeness states; expected counts and opening stocks correct; no fabricated activity | L/S | P0 |
| DASH-03 | MULTI fixture with distinct per-office values | Every column/metric and footer reconciles: receipts, completed, pending, disposal, SLA, money, complaints, field, reports | L/S | P0 |
| DASH-04 | Zero receipts/completions, zero collection and missing averages | Dash only for undefined ratios; valid zero remains zero; INR formatting correct; no NaN/Infinity | L/S | P1 |
| DASH-05 | Mixed unconfigured, partial and complete offices | Missing setup shown separately; incomplete indicator only when submitted < expected; 25/25 explicit zero is complete | L/S | P0 |
| DASH-06 | Threshold values below/at/above 10 pending, 5 complaints, 10 field, 90% disposal and SLA | Strict comparisons; no flag at equality; correct reason count/content; simultaneous flags all present | L/S/D | P1 |
| DASH-07 | Expand/collapse threshold review by mouse/keyboard in both languages | Accurate translated reasons, operable disclosure, no hidden information limited to color | L | P1 |
| DASH-08 | Empty rows response versus failed/malformed dashboard response | Empty/no-result and error states distinguished; filters/retry remain usable; stale totals not mislabeled | L | P1 |

## FILTER — period, office and service combinations

Sources: DASH, LEDGER, HOST. Test each option and representative combinations; enumerate six offices and 25 services.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| FILTER-01 | Default Single day; choose start day, yesterday and another saved date | `from=to` correct service date; UI and detail query agree; dates use service, not registration | L/S | P0 |
| FILTER-02 | Date range inclusive boundaries and one-day range | All movement on both boundary days counted once; end-of-period stocks used; correct expected report count | L/S | P0 |
| FILTER-03 | Blank/future dates or from > to; bypass input min/max | Actionable invalid-filter state; no misleading old-result/new-label combination or request loop | L/S | P1 |
| FILTER-04 | Monthly current/past month, February leap/non-leap, 30/31 days, December→January | First day correct; current month through IST today; past month through actual last day | L/S/D | P0 |
| FILTER-05 | Switch day/range/month repeatedly | Documented defaults applied coherently; no leftover incompatible dates; correct labels and queries | L | P1 |
| FILTER-06 | All offices then each office 1–6 | Rows, totals, completeness and details scoped; returning All restores all six; no office identity crossover | L/S | P0 |
| FILTER-07 | All services then each service 1–25 | Stable ID/name mapping; totals and details scoped; expected denominator switches 25↔1 | L/S | P0 |
| FILTER-08 | Office × service × period combined | Intersection applied consistently to cards/table/footer/details; query omits optional filters only when All selected | L/S | P0 |
| FILTER-09 | Rapid filters with responses deliberately returned out of order | Only latest selection displayed; stale query/details cannot overwrite; loading/error bound to active filter | L | P0 |
| FILTER-10 | Restore cached prior filter, explicitly refresh, then refocus | Correct filter-bound data and manual refresh; no stale cross-account data; current filters retained; focus alone causes no read | L | P1 |

## DETAIL — service entry register and remarks

Sources: DASH, LANG, UI-SPEC.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| DETAIL-01 | Open detail register with data | Exactly the 18 rendered columns map to correct values; service/reporting dates and IST timestamp distinct; exact money/average/remarks | L/S | P0 |
| DETAIL-02 | Open register with zero matching entries | Explicit “No entries submitted” state; no crash or false records; Close works | L/S | P1 |
| DETAIL-03 | Cross-check rows under every active filter | All rows satisfy office/service/date intersection; no hidden extra records; selected period reconciles summary | L/S | P0 |
| DETAIL-04 | Close and reopen register repeatedly | Correct fresh query; focus and state predictable; no duplicate panels/request leaks | L | P1 |
| DETAIL-05 | Save office activity while register open, then manually Refresh commissioner; repeat with either read failing | No automatic update; Refresh retains filters and open register, updates both rows/totals on success; partial failure preserves panel and identifies failed section without false all-updated success; GAP-05 | L/S | P1 |
| DETAIL-06 | Change filters while details request in flight/open | Old-filter result discarded/cleared; no incorrectly labeled rows; newest query opens correct data | L | P0 |
| DETAIL-07 | Close register while request in flight; repeat open clicks | Late response does not unexpectedly reopen after Close; duplicate reads bounded; actionable loading state | L | P1 |
| DETAIL-08 | Fail/slow details GET then retry | Existing summary/filters remain usable; error/toast accurate; no false empty result or unrecoverable panel | L/S | P1 |
| DETAIL-09 | Long Hindi/multiline remarks, empty remarks/null average and large result fixture | Literal readable content; dash for absent optional values; horizontal table scrolling without page overflow; no silently truncated rows | L | P1 |

## LIVE — manual refresh and snapshot behavior (stable legacy IDs)

Sources: DASH, IO and the confirmed manual-refresh decision, which supersedes older polling/WebSocket expectations in API-SPEC. No live/freshness monitoring feature is required.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| LIVE-01 | Office and commissioner in separate contexts; save/correct, then click commissioner Refresh | Loaded snapshot unchanged before Refresh; latest committed scoped value appears after successful Refresh without full-page reload | L/S | P0 |
| LIVE-02 | Manual Refresh with active office/service/period, with register open and closed | Same filters preserved; open register stays open and both detail/summary reads refresh; closed register stays closed with no unnecessary detail request; busy/repeat-click behavior safe | L/S | P1 |
| LIVE-03 | After initial load, advance time several minutes, hide/show and refocus tab | No timer polling, focus or visibility-triggered dashboard requests; loaded snapshot remains stable | L | P1 |
| LIVE-04 | Disconnect commissioner, click Refresh, submit office activity elsewhere, reconnect and click Refresh | Failed Refresh retains prior data and clear error; reconnect alone causes no update; explicit Refresh recovers newest scoped values | L/S | P0 |
| LIVE-05 | Manually refresh through repeated failures, then success | Bounded request retries only; no background retry loop; previous snapshot retained honestly; successful Refresh clears error | L | P1 |
| LIVE-06 | Inspect idle snapshot and failed Refresh display | No false live/connected/current claim; failure explains previous data retained; last-loaded timestamp optional, accurate if present | L/S | P1 |
| LIVE-07 | Log out/unmount/remount dashboard repeatedly | Only intended initial/manual/filter reads; no unauthenticated requests, orphan timers or duplicate handlers | L | P1 |
| LIVE-08 | Observe requests on dashboard open and during idle/manual refresh | No `/api/live` connection or reconnect attempts; manual reads work through the supported API prefix | L/S | P1 |

## HIST — retained backend audit; frontend history excluded

Sources: HISTORY, APP, and the user's confirmed scope decision above, which supersedes older UI-SPEC history requirements. Verify backend audit retention and authorized retrieval using actual supported APIs or an approved backend fixture/inspection mechanism. Missing backend access blocks those checks; it does not require a frontend screen. Presentation helpers may remain for future use.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| HIST-01 | Inspect office/commissioner nav and legacy history URLs | No frontend history entry or screen; normal supported role navigation remains usable | L/S | P1 |
| HIST-02 | Read retained backend audit with no events; induce read failure via controlled fixture | Correct empty response versus structured error; no invented records or destructive changes; retrieval remains usable for future integration | S | P1 |
| HIST-03 | Save baseline, new Today, new Backdate and correction; inspect backend records | Exactly intended setup/create/correct events; before/after values, actor office identity, action, timestamp and required reason correct | S | P0 |
| HIST-04 | Access retained audit through unauthenticated/office A/office B/commissioner contexts where API supported | Actual backend authorization policy enforced; no cross-office leak or unauthenticated retrieval; no new frontend feature needed | S | P0 |
| HIST-05 | DEFERRED: frontend human-readable comparison of zero/null/money/dates | Excluded by user decision; retain ID for a possible future frontend | Deferred | P1 |
| HIST-06 | DEFERRED: frontend comparison presentation for no-op/reordered/derived changes | Excluded by user decision; existing comparison helpers may remain; raw backend audit correctness remains required by HIST-03 | Deferred | P1 |
| HIST-07 | Retrieve backend records with legacy/missing/corrupt snapshots or unknown service references | Original audit records retained; safe contract-defined response/diagnostic; no crash, silent deletion or destructive snapshot rewrite | S | P1 |
| HIST-08 | DEFERRED: frontend history disclosure, keyboard, Hindi, mobile and theme | Excluded by user decision; no frontend history accessibility/visual gate for this handover | Deferred | P1 |

## FAIL — loading, errors and recovery across every networked surface

Sources: IO, AUTH, SET, ENTRY, DASH, SHELL, UI-SPEC. Expand by endpoint and applicable operation using the operation map below.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| FAIL-01 | Hold response indefinitely, then release success | Honest loading/busy state; no duplicate submit or false empty success; no focus lost to passive refresh | L | P1 |
| FAIL-02 | Abort/offline/connection reset on each read and write | Understandable error and safe retry; existing draft/data retained according to operation; no phantom commit | L | P0 |
| FAIL-03 | 400/422 structured validation, 401, 403, 404, 409, 429, 500/502/503 | Status-appropriate recovery; auth/access/conflict distinguished; no write retries automatically creating duplicates | L/S | P0 |
| FAIL-04 | HTML instead of JSON, empty 204, malformed JSON, malformed error object | No opaque unhandled JSON crash; usable failure/recovery; no false success | L | P1 |
| FAIL-05 | Unexpected success envelope/missing fields/null/unknown service ID | Transport/schema boundary failure handled safely; no silently wrong totals or crash without recovery | L | P1 |
| FAIL-06 | Fail lazy page chunk/render, click Try again or reload | Visible crash fallback; operable recovery, no infinite crash loop or stranded blank shell | L | P1 |
| FAIL-07 | Fail read with old data available, change filters, then recover | Data marked stale or withheld under new filter; errors clear on correct response; old success notice does not mislead | L | P0 |
| FAIL-08 | Error reload while dirty; fail reload again, then succeed | Explicit discard/retain behavior; no silent draft destruction; latest version eventually loads and can be corrected | L | P1 |
| FAIL-09 | Record console errors, uncaught exceptions and failed network requests | No unexplained failures in clean journeys; injected faults annotated; no auth headers/cookies/passwords in shared evidence | L/S | P1 |
| FAIL-10 | Browser denies storage access or saved language preference is malformed | Recover to a usable default/sign-in view or actionable fallback; session security unaffected; no permanent render-crash loop | L | P2 |

## I18N — English, Hindi and India formatting

Sources: LANG, AUTH, SET, ENTRY, DASH, SHELL, HISTORY.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| I18N-01 | Toggle login language; reload/new tab | Visible English/Hindi labels, `html.lang`, persisted preference and keyboard accessible toggle | L/S | P1 |
| I18N-02 | Complete principal office and commissioner journeys entirely in Hindi | All actionable labels/navigation/errors/reasons/empty states understandable; unchanged endpoint IDs/values | L/S | P1 |
| I18N-03 | Toggle during setup, draft, edit, error, dashboard filters and open details | Business values/selection/draft/filter state preserved; no unwanted requests or resets | L | P1 |
| I18N-04 | Iterate services 1–25, categories and status labels in both languages | Correct catalog mappings and complete text; untranslated exposed labels recorded, including mobile branding/progress/status | L | P1 |
| I18N-05 | Server known/unknown validation errors and dynamic negative-balance error | Known messages translate; unknown safe fallback still actionable; field association and dates retained | L | P1 |
| I18N-06 | Money 0/0.01/1234567.89, ratios and date/time at midnight | INR/Indian grouping/paise and decimal precision correct; IST timestamps stable in all browser timezones | L/S/D | P1 |

## A11Y — keyboard, assistive semantics and interaction

Sources: SHELL, UI-SPEC, all pages. Automated scans plus deliberate keyboard verification are both required.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| A11Y-01 | Keyboard-only each primary journey; skip link | Correct focus order, visible focus, skip reaches one main landmark; all actions operable without mouse | L | P1 |
| A11Y-02 | Inspect every input/select/textarea/checkbox, including 75 setup inputs | Programmatic name, required state, helper/error description and invalid state; IDs unique across desktop/drawer copies | L | P1 |
| A11Y-03 | Submit invalid fields; loading/save success/failure | Error summary/field recovery discoverable; status announced; passive refresh does not steal focus | L | P1 |
| A11Y-04 | Scan all frontend pages plus loading/empty/error/edit/detail states with axe | No unaccepted serious/critical violations; full WCAG A/AA rule findings reviewed; no frontend history requirement or false claim of complete conformance | L | P1 |
| A11Y-05 | Mobile drawer open by keyboard, Tab/Shift+Tab, Escape, backdrop and Close | Focus enters/stays in modal drawer, Escape/Close restores trigger focus; hidden drawer not focusable | L | P1 |
| A11Y-06 | Open drawer then choose route, cancel dirty prompt, rotate/resize | Correct visible nav/active state; cancellation preserves page and usable focus; no scroll lock/backdrop left behind | L | P1 |
| A11Y-07 | Accessible progress, selected services/nav, tables and review disclosures | Correct roles/values/headers/aria-current; status not conveyed by color alone; 0–25 progress coherent | L | P1 |
| A11Y-08 | 200% zoom, narrow viewport, reduced motion, light/dark, long Hindi | No essential content clipped, readable contrast/focus, motion preference respected, controls meet agreed 44px target requirement | L | P1 |

## VIS — responsive and visual review

Sources: SHELL, UI-SPEC, `src/client/styles.css`, `src/client/styles/theme.css`.

| ID | Setup / action | Expected assertions | Layer | Priority |
| --- | --- | --- | --- | --- |
| VIS-01 | Pages at 320/390/768/1100/1500/1920 widths | No page-level horizontal overflow; intended tables scroll; first/last service and all actions reachable | L | P1 |
| VIS-02 | Mobile entry/setup/dashboard with keyboard open and landscape | Submit, required fields and drawer accessible; no sticky panel obscures input or unreachable controls | L | P1 |
| VIS-03 | Light/dark snapshots: normal, empty, error, correction, details | Readable controls/table headers/alerts; intentional tokens rather than white-on-white/hardcoded light remnants | L | P1 |
| VIS-04 | Hindi and maximal legal text, large amounts, all review reasons | No truncation of essential values; correct wrapping/alignment; contrast/focus remain visible | L | P1 |
| VIS-05 | Chromium/Firefox/WebKit principal workflows | Native date/month/number input, validation, dialogs, cookies, focus and responsive nav function consistently | L/S | P1 |
| VIS-06 | Freeze data/clock/fonts; compare reviewed baselines and inspect full-page images | Deterministic meaningful visual differences; reviewers examine changes, not blindly update snapshots | L | P2 |

## JOURNEY — continuous handover acceptance walkthroughs

These complement isolated scenarios and must run against the actual candidate release. Use distinct contexts throughout to prove role separation.

| ID | Ordered journey | Required end evidence | Layer | Priority |
| --- | --- | --- | --- | --- |
| JOURNEY-01 | Fresh office login → 75 nonzero balances → save baseline → Today nonzero/zero submissions → 25/25 → logout/re-login | Correct identity, irreversible setup, persisted 25 reports, completeness, exact stock/collection totals | L/S | P0 |
| JOURNEY-02 | Returning office → yesterday/start-date Backdate → delayed reason → saved read-only → Edit/Cancel → valid correction → logout | Original registration, correct reasons/version and recalculated later balances; backend audit checked independently, no history screen | L/S | P0 |
| JOURNEY-03 | Commissioner login concurrently → correct day/office/service → office create/correct → manual Refresh → range/month → details → Refresh → empty filter → logout | Independent oracle reconciliation; no edit rights; accurate manual updates/details/empty state; no unsolicited updates; backend audit verified separately | L/S | P0 |
| JOURNEY-04 | Office draft → invalid submission → offline save failure → unchanged retry → conflict from second office context → reload/reapply → commissioner review | No lost/duplicate/unauthorized write; useful validation and explicit recovery; final persisted version exact | L/S | P0 |
| JOURNEY-05 | Hindi mobile office → menu navigation → dirty cancel → Backdate save; Hindi mobile commissioner review | Complete keyboard/touch usable bilingual path with correct data and no overflow | L/S | P1 |
| JOURNEY-06 | Dirty Today crosses midnight → continue in Backdate → reason → save → commissioner correct service-date review | Prior-day activity/current registration retained; no misdated or lost report; server boundary proof separately recorded | L; S with clock support | P0 |

## Parameter tables — mandatory expansions

### Values and limits

| Input | Valid representatives | Invalid/boundary probes | Expected rule/source |
| --- | --- | --- | --- |
| Seven activity counts | 0, 1, 1,000,000,000 subject to available balance | blank, -1, 0.5, 1,000,000,001, unsafe integer, exponent input, null/string/object raw JSON | Nonnegative safe integer ≤1e9; browser/schema/server consistent; evaluate exponent normalization across browsers |
| Completion/resolution allowance | 0, corresponding same-date receipts | receipts+1, any completion when receipts=0 even with nonzero opening | Each track limited to its own service-date receipts; SLA still limited to completed; Backdate and corrections follow the same rule |
| 75 opening values | 0, 1, 1e9, unique per service/kind | blank, -1, fraction, max+1, NaN/null/string; duplicate/missing/extra service in raw setup | Exactly IDs 1–25 once each, three valid balances; verify actual backend bound; current client schema lacks max |
| Money | `0`, `0.00`, `0.01`, `1.1`, `1.01`, `001.20` | blank, `.5`, `1.`, `1.001`, `-1`, `1e3`, commas, spaces, `NaN`, huge value | `parseMoney` accepts digits with optional 1–2 decimal places; paise exact. `validateEntry` caps amountPaise at 1e9 (₹10,000,000.00), unlike parseMoney's safe-integer-only max; reconcile actual server contract |
| Money server cap | ₹9,999,999.99, ₹10,000,000.00 | ₹10,000,000.01; max safe integer paise and beyond | Pin server/client limits; never silently round or accept until later failure |
| Avg days | null when no completion, 0, 0.01, 1.5, 100000 | null with completed>0, negative, 100000.01, nonfinite/raw wrong type | Optional only at zero completed; finite range 0–100000 in domain; browser step 0.01 |
| Ward / remarks / reason | Hindi/English/punctuation/line breaks; 1/200, 0/2000, 1/1000 chars respectively | whitespace-only required strings, length+1, very long unbroken strings, emoji boundary lengths, HTML-looking strings | Document character-count semantics; required trimmed Ward/reason; optional remarks; literal safe rendering |
| IDs and versions | office1–6; service1–25; expectedVersion null for create/current integer for correction | 0, out-of-range, fraction, missing, string/null wrong operation, other office's entry, stale/future version | API validates identity and authorization independent of client |
| Dates | start, yesterday, today; month/year boundaries; 2028-02-29 | start−1, future, blank, malformed, 2026-02-29, 2026-02-30 | Canonical valid date; Today and Backdate route bounds server-enforced |

### Backend operation and failure map

All actual HTTP operations currently invoked by the frontend are listed here. Map every applicable FAIL family to each operation; report unsupported/absent operations rather than inventing mocks as evidence.

| Operation | Current method/path | Primary scenario owners | Applicable failure focus |
| --- | --- | --- | --- |
| Session bootstrap | GET `/v1/api/anchal/session` | AUTH, ROUTE | 401 versus outage, slow, malformed identity, cache/account isolation |
| Login | POST `/v1/api/anchal/login` | AUTH | validation, invalid credentials, 429, network/5xx, lost response, cookie/session refresh |
| Logout | POST `/v1/api/anchal/logout` | AUTH, DRAFT | network/5xx, expiry, repeated submit, server revocation |
| Baseline read | GET `/v1/api/anchal/office/setup` | SETUP, ROUTE | null versus 401/403/outage, wrong-office data, partial contract |
| Baseline create | PUT `/v1/api/anchal/office/setup` | SETUP, WRITE, SEC | invalid values, existing setup, concurrent create, atomicity/idempotency |
| Day/mode entries | GET `/v1/api/anchal/office/entries?date=...&mode=...` | TODAY, BACK, TIME | setup/date/role errors, stale races, missing openings, retry |
| Create entry | POST `/v1/api/anchal/office/entries` | TODAY, BACK, VALID, WRITE | validation, setup/role/date, duplicate key, lost response, expiry |
| Correct entry | PUT `/v1/api/anchal/office/entries/:id` | EDIT, LEDGER, WRITE, SEC | stale version, reason, later negative, wrong office/ID, atomicity |
| Dashboard | GET `/v1/api/anchal/dashboard?from=...&to=...[&officeId=...&serviceId=...]` | DASH, FILTER, LIVE | invalid filter, auth, malformed/empty/stale rows, out-of-order response |
| Detail rows | GET `/v1/api/anchal/dashboard/entries?...` | DETAIL | role/filter, late response, unknown service, empty/error, pagination contract |
| Legacy socket | Current code attempts WS(S) `/api/live`; excluded by confirmed manual-refresh requirement | LIVE, ENV | Verify no connection/reconnect traffic after alignment; no socket authorization feature required |
| Backend audit only | No frontend call required; historical tests use `/api/history` | HIST | Confirm actual retained backend retrieval/inspection contract and authorization; no frontend screen or request requirement |
| Service catalog | No current network call; static `services.json` | TODAY, FILTER, SETUP | Compare all 25 IDs/names with backend; catalog drift cannot silently remap reports |

Read malformed responses include empty/HTML bodies and JSON missing nested fields. Write tests must distinguish “not committed” from “committed but response lost”. Cookie/authorization, persistence, server time, atomic transactions and genuine idempotency require S evidence; local mocks alone cannot pass them.

## Existing suite overlap and repair inventory

| Existing scenario | Matrix overlap | Why it cannot establish handover coverage as-is |
| --- | --- | --- |
| `portal.spec.ts` bilingual login | I18N-01 | Root URL requires subpath repair; one language screen only |
| Office submission/live/correction/history | TODAY, EDIT, LIVE, HIST | Replace live/timing/Connected assertions with explicit manual Refresh; remove frontend history assertion; repair old URL matcher and shared/random fixture assumptions |
| Monthly register refresh | FILTER-04, DETAIL-05 | Current data effect closes register; no independent calendar/aggregate oracle |
| Deliberate counts/zero | TODAY-01/04 | Assumes a particular service unused; no invalid-submit persistence checks |
| Back-entry dates | BACK-03, EDIT-05 | Ambiguous create/correction setup; new-backdate reason not always supplied; depends on live state |
| Backdate reason | BACK-05/06 | Data-dependent skips; inspects required attribute but does not cover whitespace/server bypass |
| `design.spec.ts` login accessibility/responsiveness | A11Y, VIS | Legacy selectors can miss current controls; screenshots are not asserted/reviewed baselines |
| Dashboard/entry accessibility | A11Y, VIS | Limited states; login/setup helper can skip; current mobile/desktop duplicate controls need scope |
| Canceled service switch | DRAFT-01/02 | Useful intent, but accepted switch only checks selection, not changed form/save identity |
| Saved read-only/Cancel | TODAY-07, EDIT-03 | Data-dependent saved-row precondition and skips; no all-field persistence verification |
| Setup/routing mock | ROUTE, SETUP | Mock branches check old paths; default catch-all payload masks real transport mismatch |
| Canceled nav | DRAFT-04/05 | Local-only skip; synthetic popstate, not complete actual Back/Forward behavior |
| Midnight mock | TIME-02/03/04 | Old API paths; covers browser clock only; does not submit/reconcile draft or test server clock |
| `history.spec.ts` readable diff | HIST-05/06, A11Y | Retire frontend acceptance requirement per confirmed scope; retained helper unit tests do not establish backend audit correctness |
| 18 domain/transport tests | LEDGER, VALID, IO, HIST helper | Useful baseline but no backend authorization/persistence or complete browser journeys |

## Coverage completion procedure

1. Expand each family into named tests with `[ID]`, layer, role and variant in the title; keep a machine-readable manifest mapping them to this matrix and code source.
2. Enumerate actions and state branches in APP/AUTH/SET/ENTRY/DASH/SHELL after implementation; add an ID for any unmatched branch. Also compare required spec flows so missing pages cannot erase requirements.
3. Record all six office and all 25 service variants, numeric/date/error enumerations and browser samples. Count executed variants independently of scenario-family count.
4. For each run record pass/fail/blocked/excluded, first-attempt result, retry, defect link and evidence. A family with unexecuted required variants is incomplete.
5. Reconcile staging persisted records, versions, audit and dashboard against precomputed expected values. Mark backend-only verification blocked when unavailable.
6. Apply the plan's release gate and publish remaining scope decisions. This matrix is the inventory; execution evidence is a separate deliverable.

Outside the current implementation: individual staff administration/password-management UI, citizen grievance case lifecycle, photo/evidence uploads, staff/infrastructure tracking, commissioner directions, exports/print workflows, baseline correction and period-close/reopen. The catalog's evidence descriptions do not create upload features. If any are part of the contractual handover scope, add them explicitly rather than assume they were tested here.
