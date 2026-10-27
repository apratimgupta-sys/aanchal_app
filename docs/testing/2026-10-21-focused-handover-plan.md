# Focused Playwright handover plan: Anchal frontend

Date: 21 October 2026. Scope: frontend only, run against the staging backend. This is a cut-down of the 19 Oct matrix ([scenarios](2026-10-19-handover-scenarios.md), [design](../superpowers/specs/2026-10-19-handover-testing-design.md)). Scenario IDs below refer to that matrix. Nothing here has been executed yet.

## 1. API target (verified from code, 21 Oct)

| Item | Finding |
| --- | --- |
| API path in code | `src/client/api.ts` uses the relative base `/v1/api/anchal`, same-origin, `credentials: "same-origin"`. No absolute URLs in `src/` or `dist/`. |
| Where it resolves | `vite.config.ts` proxies `/v1/api/anchal` to `RMC_BACKEND_URL`, defaulting to **`https://anchal-backend-staging.onrender.com`**. The proxy rewrites cookie `Path` to `/` and sets the `origin` header. |
| Env state | No `.env` file in the project. `RMC_BACKEND_URL` is not set in the shell. The staging default is therefore active. |
| App base path | `/anchal/` (Vite `base`). The app is served at `http://127.0.0.1:5173/anchal/`. |
| Playwright default | `baseURL` falls back to `http://127.0.0.1:8787`, the old Worker port. This is wrong for the current app. |
| Not yet confirmed | Whether staging responds. It could not be reached from the sandbox used to write this plan. Confirm in step 2.1. |

Run configuration:

```sh
export RMC_BACKEND_URL=https://anchal-backend-staging.onrender.com   # set explicitly, do not rely on the default
npm run dev                                                          # Vite on 127.0.0.1:5173
export RMC_TEST_URL=http://127.0.0.1:5173/anchal/
export RMC_TEST_OFFICE=6                                             # the only office that may be written to on staging
export RMC_TEST_PASSWORD=<staging password, from the shell only>
npx playwright test
```

## 2. Pre-flight (gate before any other test)

| # | Check | Pass condition |
| --- | --- | --- |
| 2.1 | Warm staging: `curl -i $RMC_BACKEND_URL/v1/api/anchal/session` until it answers | HTTP 401 with a JSON body. Render cold starts can take 30 to 60 s, so use a longer timeout on this first request only. |
| 2.2 | Fixed target check: a test that reads the URL of the first `/v1/api/anchal/session` request | The request goes through `127.0.0.1:5173` and the proxy reaches the staging host. The suite aborts if the host is anything else. |
| 2.3 | Test credentials | The password comes from the environment. Remove the hardcoded default in `tests/browser/portal.spec.ts`. |
| 2.4 | Repair old mocks (GAP-01) | Route matchers use `/v1/api/anchal/**` and navigation uses `/anchal/...`. Unmatched `/v1/api/anchal` requests in mocked tests fail the test. |
| 2.5 | Write guard | Real-staging writes run only for office 6 and only when `RMC_ALLOW_STAGING_WRITES=1`. Any other write attempt fails the test. |

## 3. Two execution modes

- **Mocked (L):** `page.route('**/v1/api/anchal/**')` fulfils every response. Used for all empty, error, slow, malformed and race states. These never touch staging data, and they are where most edge cases live.
- **Staging (S):** the real backend through the Vite proxy. Used for happy paths, persistence after reload, session cookies, and role and office isolation. Mutating tests use office 6 only, with synthetic ward names prefixed `QA-<run id>`.

## 4. Test set (about 60 scenario families, P0 only)

### 4.1 Session, routing and role gates
| Matrix ID | What to prove | Mode |
| --- | --- | --- |
| AUTH-01 | Slow `/session` shows a loading state. A 401 shows login with no console error (Suggestions #2). | L |
| AUTH-05 | Wrong password, unknown user, password with spaces: a clear error, no session. Empty fields are blocked. | L, S |
| AUTH-03, 04 | Office and commissioner login land on the right page. | S |
| AUTH-08, 10 | Reload keeps the session. After logout, reload, Back and a direct protected URL all go to login. | S |
| AUTH-09 | A 401 on setup, read, create, correct, dashboard or detail requests mid-session ends in a clean return to login with no crash. | L |
| AUTH-12 | Office A logs out, office B then commissioner log in on the same browser: no cached data from the previous account. | S |
| ROUTE-01 to 04 | Every protected deep link and unknown route, for signed-out, fresh office, configured office and commissioner. The commissioner cannot open office pages, and an office cannot open the dashboard. Direct refresh works under `/anchal/`. | L, S |

### 4.2 First-run setup (opening balances)
| Matrix ID | What to prove | Mode |
| --- | --- | --- |
| SETUP-01 | Setup renders in English and Hindi, with all 25 services by 3 balance fields. | L |
| SETUP-05 | Blank, invalid, today, yesterday and future start dates, including a future date forced past the DOM `max` (GAP-06). | L |
| SETUP-06 | Empty, negative, fractional, huge and over-limit balances. Each shows a visible field error, not silence. | L |
| SETUP-07 | Double click and Enter while saving send one request. A lost response followed by retry does not create a second baseline. | L |
| SETUP-04, 09 | Zero balances need explicit confirmation. After save, setup is locked in the UI. | L, S (office 6 only if it is still unconfigured) |

### 4.3 Daily entry: Today, Backdate, corrections
| Matrix ID | What to prove | Mode |
| --- | --- | --- |
| TODAY-01 | Configured office with no entries: empty state, no broken table. | L |
| TODAY-03, 05, 07 | Nonzero and zero-activity submits. The saved value is still there after reload and re-login. | S |
| VALID-01 | Ward blank, whitespace only, 1, 200 and 201 characters. | L |
| VALID-02 | Each count field: blank, 0, 1, -1, 0.5, 1e9, 1e9+1, exponent text. | L |
| VALID-03, 04 | Completed greater than same-day received by 1 is rejected. SLA completed greater than completed is rejected. Opening balance does not raise the allowance (confirmed rule). | L |
| VALID-05 | Amount: `0`, `1.1`, `001.20`, `.5`, `1.001`, `-1`, commas, `1e3`, over the cap. | L |
| VALID-08 | Delay or correction reason: empty, spaces, 1, 1000 and 1001 characters. | L |
| VALID-10 | Edit the HTML `max` and `readOnly` attributes in devtools and submit: validation still holds. | L |
| BACK-04, 05 | Dates before the start date, today, future, blank and malformed are rejected. A new backdated row without a reason is rejected. | L |
| BACK-03, 06, 08 | Start date and yesterday save with a reason. A saved row is read-only until Edit. | S |
| EDIT-01, 04, 05 | Edit and Cancel work. A correction without a reason is blocked. After a correction, service date and registration date are unchanged. | S |

### 4.4 Drafts, time and writes
| Matrix ID | What to prove | Mode |
| --- | --- | --- |
| DRAFT-01, 02 | Switching service or date with unsaved edits prompts. Dismiss keeps the draft. **Accept must not carry old values to the new service or date (GAP-07).** | L |
| DRAFT-03, 04, 06 | The same checks for Today and Backdate switching, and for Sign out. | L |
| TIME-01, 02, 03 | Browser clock set to UTC, Kolkata and Los Angeles around 18:29:59Z and 18:30:00Z. The Today form moves to the new IST date, and a dirty draft is not lost silently. Use `page.clock`. | L |
| TIME-04 | A previous-day draft can be continued in Backdate. | L |
| WRITE-01, 02, 03 | Double submit sends one request. A lost response followed by retry of the same payload is idempotent. A changed payload after a failure is treated as a new write. | L |
| WRITE-05 | Two contexts edit the same version and the second save gets a conflict message. | S (office 6) |
| WRITE-07 | The save succeeds but the follow-up read fails. The UI must not claim the data is current (GAP-08). | L |
| WRITE-11 | Slow responses released out of order must not overwrite newer input. | L |

### 4.5 Commissioner dashboard: empty, error, filter states
| Matrix ID | What to prove | Mode |
| --- | --- | --- |
| DASH-01 | Slow initial read shows a loading state, then data. | L |
| DASH-02 | All offices unconfigured, and all configured but no reports: distinct, readable empty states. | L |
| DASH-03, 05 | Six offices with distinct values, and mixed unconfigured, partial and complete offices. Totals match values computed independently in the test. | L |
| FILTER-01, 02, 04 | Single day, inclusive range, one-day range, and month boundaries (February in leap and non-leap years, 30 and 31 days, December to January). | L |
| FILTER-06 to 08 | All offices and each of 1 to 6, all services and each of 1 to 25, and combinations. | L |
| FILTER-09 | Rapid filter changes with out-of-order responses: the final screen matches the last filter chosen. | L |
| DETAIL-01, 03 | The register opens, and its rows match the active filters. | L |
| DETAIL-06 | Filters changed while details load or while the register is open: no old-filter rows under the new filter label. | L |
| LIVE-01, 04 | Manual Refresh picks up new office data. A failed Refresh keeps the previous snapshot and shows an error. **No automatic polling, socket or focus refetch (GAP-04). An open register must stay open on Refresh (GAP-05).** | L, S |

### 4.6 Failure states on every endpoint
| Matrix ID | What to prove | Mode |
| --- | --- | --- |
| FAIL-02 | Abort, offline and connection reset on every read and write. | L |
| FAIL-03 | For each of the 10 operations in the matrix's failure map: 400/422, 401, 403, 404, 409, 429, 500, 502, 503. The user sees an actionable message, no raw JSON or stack text, and the page does not white-screen. | L |
| FAIL-07 | A read fails while old data is shown. Change filters, then recover: no stale mixing. | L |
| FAIL-x | Responses that are HTML (a Render 502 page), empty, or JSON with missing nested fields. `api.ts` calls `r.json()` unguarded, so expect failures here. | L |

### 4.7 Security spot checks from the browser (S, office 6 only)
SEC-01 (no cookie gives 401 on every endpoint), SEC-02 (office A cannot reach office B data), SEC-03 and 04 (role boundaries), SEC-07 (service IDs 0, 26, a fraction, a string), SEC-08 (replay after logout).

### 4.8 Cross-cutting
| Area | Check |
| --- | --- |
| I18N | English and Hindi on login, setup, entry and dashboard. No clipped text and no untranslated keys. Dates in IST format. |
| A11Y | Keyboard-only login and entry. Errors are announced and tied to fields. Drawer focus and Escape (GAP-10). Rewrite selectors from `.ux4g-*` to `.ui-*` (GAP-11). |
| VIS | Screenshots at 1440, 1024, 768 and 375 px width for login, setup, entry and dashboard. Very long ward names and remarks do not break layout. |
| Console | The suite fails on any unexpected console error or failed request, including the favicon 404 (Suggestions #1). |

### 4.9 End-to-end journeys (S, run last)
JOURNEY-01 (fresh office through all 25 services and logout), JOURNEY-02 (backdate, edit, correct), JOURNEY-03 (commissioner review with manual Refresh), JOURNEY-04 (draft, invalid, offline failure, retry, conflict).

## 5. Expected failures to decide before the run

These are known from the code audit. Each will fail its tests unless fixed first. Decide per item: fix before handover, or accept and record in the handover note.

| Gap | Symptom | Tests it fails |
| --- | --- | --- |
| GAP-04 | Dashboard still opens `/api/live` and polls or refetches on focus | LIVE-x, DASH-x |
| GAP-05 | The open register closes on refresh | DETAIL-x, LIVE-x |
| GAP-06 | Setup has no visible field errors and no max limits | SETUP-05, 06 |
| GAP-07 | Accepting a service switch keeps the old draft values | DRAFT-02, 03 |
| GAP-08 | "Saved" is announced even when the follow-up read failed | WRITE-07 |
| GAP-09 | No central handling of a mid-session 401, and logout has no failure handling | AUTH-09, FAIL-03 |

## 6. Run order and exit criteria

1. Pre-flight (section 2).
2. Mocked suite (L), all of sections 4.1 to 4.6. Fast and safe. Run it as many times as needed.
3. Staging read-only checks (S): login, role gates, dashboard and filters.
4. Staging write checks (S) on office 6, with the write flag set.
5. Journeys (4.9), then the visual and accessibility pass.
6. Re-run the whole suite once more from a clean browser context.

Ready for handover when: every P0 above passes or is on the accepted-gap list with the client's knowledge, there are no unexpected console errors in the final run, and a test report with screenshots is saved (`playwright-report/`).

Risks: staging data is shared, and mutation tests alter it (use office 6 only and note the run ID). Render cold starts cause timeouts, which pre-flight 2.1 handles. Cookie and CORS behaviour on the real client hostname is not covered by the Vite proxy, so run a short smoke test against the deployed frontend URL as well (matrix ENV-05).
