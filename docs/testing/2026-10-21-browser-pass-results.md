# Browser pass results: staging, 21 Oct 2026

Run against the staging backend through the local Vite proxy (`http://127.0.0.1:5173/anchal/`), driven by hand in the browser pane. This is a manual pass of selected P0 families from the [focused plan](2026-10-21-focused-handover-plan.md), not the Playwright suite. Read-only except where noted under "Data changed".

## Passed

| Plan ID | Check | Evidence |
| --- | --- | --- |
| ENV | Frontend reaches staging through the proxy | `/session` 401 from Render; responses carry `x-render-origin-server: Kestrel` |
| AUTH-01/03/04 | Office and commissioner login, anchal1/2/6 | 200 `{ok:true}`; commissioner lands on dashboard |
| AUTH-05 | Wrong password, unknown user, empty strings, spaces in password | 401 "Invalid username or password"; empty body or non-string fields 400 |
| AUTH-10 | Logout then `/session` | 401 "Please sign in" |
| SEC-01 | Every protected endpoint with no cookie (GET and PUT/POST) | 401 on all 7 |
| ROUTE-01 | Signed-out deep links (`/office/today`, `/commissioner/dashboard`) | Login form shown, path kept |
| AUTH (UI) | Empty submit; wrong password | Field errors "Username is required" / "Password is required"; alert "Invalid username or password" |
| ROUTE-04 | Office user on commissioner route; commissioner on office setup; unknown route | Redirected to own home; no dashboard request fired |
| SEC-03/04 | Office on dashboard APIs; commissioner on setup/entries/create | 403 "Access denied" |
| SEC-07 | Dashboard filters: missing, bad, junk, reversed, huge date range; officeId 0/7/abc; serviceId 26/0.5 | 422 with field errors |
| SEC-02 (read) | Office 1 asking for entries with `officeId=2` | Server ignores the parameter, returns own office |
| Entries | Wrong mode, off-route date, bad date | 422; DELETE gives 405; unknown entry id 404 |

## Failed or defects

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | High | `PUT /office/setup` returns **500** instead of 422 for malformed input: invalid date (`2026-02-30`), blank date, fractional balance, null balance, huge number (1e21), `balances` not an array | Reproduced; same body with other invalid values gets proper 422 |
| 2 | High | Setup accepts a **string** balance (`"7"`) and saves it | Office 6 setup was saved by this probe; see "Data changed" |
| 3 | Medium | Dashboard re-fetches every 15 s and again on focus | Requests at 1, 16, 31, 46 s; extra request after a focus event (known GAP-04; you decided on manual refresh) |
| 4 | Medium | When a dashboard filter is invalid (blank or future date), an alert shows but the table shows all zeros labelled with the invalid date | Looks like real data under an error |
| 5 | Medium | First-run setup form sends invalid dates to the server (client lets them through), and shows no field errors for number problems | Known GAP-06; server then rejects |
| 6 | Low | Unconfigured offices on the dashboard show "REVIEW (1)" with an empty remark, unlike configured ones | Offices 3 to 5 |
| 7 | Low | Wrong `mode` query value reports "Date is outside this reporting route" rather than an invalid-mode message | |
| 8 | Info | Usernames are case-insensitive at login (`ANCHAL1` works) | Confirm this is intended |

## Not verified

- Cross-office **write** isolation (SEC-02): the update endpoint checks the request id first, and a valid probe would risk overwriting another office's data.
- Setup validation for wrong service count, duplicate or out-of-range service ids, missing opening: office 6 became configured partway through, so these returned 409.
- Entry forms (Today, Backdate, corrections, drafts, time rollover), the service-entry register, manual Refresh, filter combinations with data, Hindi, accessibility, responsive layouts: not covered in this pass.
- The Playwright specs, staging write flows and journeys: not run.

## Data changed on staging

One unintended write: office 6 (`anchal6`) now has its opening setup saved (start date 2026-10-01, service 1 opening 7, all other balances 0). Setup is locked after the first save, so this cannot be undone through the app. Offices 3, 4 and 5 are still unconfigured and available for first-run tests. The dashboard shows office 6 pending = 7.

---

# Part 2: controlled write pass (office 6) and backend fix

All writes as `anchal6`, wards prefixed `QA-1021`. Same method as above (hand-driven API and UI checks through the proxy, not the Playwright suite).

## Passed

| Area | Check | Result |
| --- | --- | --- |
| Create | Valid Today entry | 200, version 1, registration date = today |
| Idempotency | Same request id and body replayed | Same entry returned, no duplicate |
| Idempotency | Same request id, different body | 409 "request identifier already used for different data" |
| Uniqueness | Second create for the same service and day | 409 |
| Validation | Negative, over 1e9, ward blank or 201 chars, remarks 2001, SLA above completed, avg days missing or negative, service 0 or 26, future date, off-route date, invalid mode | 422 with field errors; nothing saved |
| Corrections | No reason or blank reason | 422 "A correction reason is required" |
| Corrections | Valid correction | 200, version 2; service date, registration date and created time unchanged |
| Corrections | Stale expected version | 409 "Entry changed. Reload before correcting." |
| Backdate | No or blank reason | 422 "A delayed-reporting reason is required" |
| Backdate | Yesterday and the reporting start date, with reason | 200; registration date stays today |
| Backdate | Before start date; today in backdate mode | 422 |
| Isolation | Office 1 sends a fully valid correction for an office 6 entry | 404; entry unchanged |
| Ledger | Closing = opening + received − completed (7 + 6 − 3 = 10; then 7 + 2 − 5 = 4) | Correct |
| Commissioner | Today, yesterday and range totals (received, completed, SLA, amount, pending); office and service filters; register rows | All match the entries written |

## Defects (additions to the list above)

| # | Severity | Finding |
| --- | --- | --- |
| 9 | **High** | Backend does not enforce "completions cannot exceed same-day receipts". A correction with received 2, completed 5 was accepted (200) because the opening balance covered it. Only the frontend form enforces the rule, so API calls bypass it. (GAP-03) |
| 10 | Medium | Entry creation also returns **500** for a fractional count (`1.5`) and for an invalid date (`2026-02-30`). Same cause as defect 1; fixed in the backend working tree, not yet deployed. |
| 11 | Low | Over-balance completions return the generic "Invalid pending balance on <date> (service N)" with no field error. |

## Backend fix (defects 1, 2, 10): written, not yet verified or deployed

- Root cause: `MonitoringHttpAdapter.Setup()` and `Entry()` call `JsonElement.Deserialize<T>()` with the Web defaults. The existing `catch (JsonException)` only wraps the earlier `JsonDocument.Parse`, so type mismatches escape as unhandled 500s. The Web defaults also allow numbers to be read from strings, so `"7"` became 7.
- Change: one shared `Command<T>()` that deserializes with `NumberHandling.Strict` and turns `JsonException` into a 422 with the offending JSON path.
- Tests added to `MonitoringEndpointTests.cs`: malformed setup values (6 cases), non-array balances, and malformed entry counts (3 cases). They are written to fail before the change.
- **Not compiled or run:** there is no .NET SDK in this environment. Run `dotnet test` before committing. The change is left uncommitted in `backend-anchal`.
- After deploying, re-run the 500 cases in this document (setup and entries) and expect 422.

## Decision: dashboard polling

The dashboard re-fetches every 15 s and on focus, and the backend answers each request normally. Decision: leave it as is. A Refresh button already exists on the dashboard. Plan scenarios LIVE-01 to LIVE-08 should therefore be read as "polling plus manual Refresh", not "manual only".

## Still open

- Playwright suite not run: the test environment cannot reach the staging host, so it must run on your machine.
- Entry-form UI behaviour (drafts, dirty-state prompts, midnight rollover), Hindi, accessibility, responsive layouts and the dashboard register UI were not exercised.
- Test data now on staging (office 6): setup (start 2026-10-01, service 1 opening 7); entries for service 1 (today, version 3), service 3 (2026-10-20) and service 4 (2026-10-01).

## Part 3: same-day completion rule (backend patch, unverified)

Defect 9 is fixed in the `backend-anchal` working tree (uncommitted, not compiled, not deployed).

- `MonitoringRules.ValidateEntry` now rejects `completed > received`, `complaintsResolved > complaintsReceived` and `fieldCompleted > fieldReceived` with field-level 422 errors (same wording as the frontend form). It is called from the shared save path, so it covers both create and correction. Opening balances do not raise the allowance.
- Tests: a new rule test, and a service test showing create and correction are rejected even when the opening balance covers the excess. Two existing service tests encoded the old behaviour and were rewritten: the "later balance goes negative" test (a case the new rule makes unreachable; replaced by a recompute-after-correction test) and the dashboard totals test (new numbers: pending 12 / complaints 4 / field 5 / disposal 50%).
- Consequences to be aware of: a day's disposal percentage can no longer exceed 100%, and carried-in opening work can no longer be reduced through normal entries. This matches the 19 Oct decisions, but it contradicts the old README line saying disposal "can exceed 100% when clearing backlog".
- Check on a machine with .NET: the changed files parse with Roslyn (no syntax errors); type checking and `dotnet test` have not been run because NuGet is unreachable from the test environment.

## Part 4: retest on the deployed fix (staging, branch `fix/strict-request-parsing-and-completion-cap`, commit 7853167)

Run same-origin against the staging backend as `anchal6`, then `anchal1` and `commissioner`. The deployed build compiled and started.

| Defect | Retest | Result |
| --- | --- | --- |
| 1, 10 (500s) | Setup: invalid date, blank date, fraction, null, 1e21, non-array balances. Entry: fraction, null, bad date | All **422** with the field path, e.g. `balances[0].opening.service`, `input.received`, `startDate`; nothing saved |
| 2 (string accepted) | Setup balance `"7"`; entry count `"3"` | **422**, nothing saved |
| 9 (completion cap) | Correction with received 2 / completed 5 (opening covers it) | **422** `completed: Completed cannot exceed received` |
| 9 | Resolved complaints above received; completed field tasks above received | **422** with the matching field error |
| 9 | Create with completed above received | **422** field error (was a generic "Invalid pending balance") |
| Regression | Correct the previously saved violating row to received 6 / completed 3 | 200, version 4, closing service 10 |
| Regression | Replay of the same request | Same version, no duplicate |
| Regression | Stale expected version; duplicate create for the same service and day | 409 |
| Regression | Valid create for a new service | 200 |
| Isolation | Office 1 sends a valid correction for an office 6 entry | 404 |
| Commissioner | Today, office 6: received 9, completed 6, SLA 5, amount 25000, pending 13 | Matches the entries written |

Open: the frontend still needs to map the new field paths (`input.received`, `balances[0].opening.service`) to its form fields; today it may show only the summary message. Playwright suite: not run (staging not reachable from the test environment; the local dev server was also stopped during this retest).

## Part 5 - Playwright plugin pass against staging (dev server on the Mac)

Run via the Playwright plugin driving `http://127.0.0.1:5173/anchal/` (proxy to staging). Entry writes were blocked by route interception; nothing was saved.

Passed
- Sign-in: empty submit shows "Username is required" / "Password is required"; wrong password stays on sign-in; valid office and commissioner logins land on the right pages.
- Role gates: office users are redirected from commissioner, setup, history and unknown routes to Today's Entry; commissioner is redirected from office routes to the dashboard; sign-out returns to sign-in.
- Entry form (client rules, no request sent): completed > received, SLA > completed, complaints resolved > received, and a non-numeric amount each show a field error. Decimal received is blocked by native validation.
- Dashboard: a past range with no data shows zeros and dashes.

Defects
1. Dashboard, reversed date range (from after to) or a future date: shows "Invalid reporting filters" but keeps the previous totals visible underneath, so stale figures look current. Should clear the figures and name the problem (for example "Start date must be on or before end date").
2. Entry form: a "Reload latest entry" button appears beside ordinary validation errors where reloading does not help.
3. Entry form: Avg Disposal Days is natively required once completed is above zero, but its label has no required marker.
4. After sign-out, opening an office URL stays on that URL and shows the sign-in form instead of redirecting to the sign-in route (minor).

Not run: the full Playwright spec files (the plugin cannot spawn `npx playwright test`).

### Part 5 fixes (verified in the browser on the staging-backed dev server)
- Defect 1 fixed (`Dashboard.tsx`): a 4xx dashboard error clears the totals, and a reversed range shows "Start date must be on or before the end date." (Hindi included). Reversed range, future date and a valid range after them were all re-checked.
- Defect 2 fixed (`DailyEntry.tsx`): "Reload latest entry" now shows only for server or network failures. Field errors and a bad amount no longer show it; a blocked save ("Failed to fetch") still does.
- Defect 3 fixed (`DailyEntry.tsx`): Avg Disposal Days shows a required marker once completed is above zero.
- Defect 4 (office URL after sign-out shows the sign-in form in place) left as is.

## Part 6 - Agent-run suite (tests/agent)

Ten script files (see `tests/agent/README.md`), run through the Playwright plugin against the staging-backed dev server. Entry writes were aborted by the suite; the setup form ran on mocked responses.

Final run: 82 checks, 0 failures. Auth and roles 19, entry form 20, dashboard 18, setup form (mocked) 9, Hindi / accessibility / responsive 16.

Observations
- The entry form asks "Discard unsaved entry changes and leave this page?" when leaving with edits (expected).
- Set zero activity needs a confirmation step before it sends anything.
- Saving the same entry twice after a failed save reuses the same requestId.
- Hindi preference persists in local storage (`rmc-language`), so a suite that switches language must switch back.
- Two checks (one h1, 25 service buttons) failed on timing in two earlier runs and passed once the suite waited for the page to finish loading; the application was fine when inspected by hand.

Not covered: real writes (office 6 write pass was done earlier by hand), the midnight rollover, correction and backdate saves, and live updates in production.
