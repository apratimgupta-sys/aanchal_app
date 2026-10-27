# RMC Anchal Office Monitoring

Working first iteration: bilingual React portal backed by the Anchal API. The Vite development server proxies the relative `/v1/api/anchal` API to the configured backend. Grey/white government portal presentation, six shared office accounts, and read-only commissioner access.

## Run locally

Requires Node 22.12+ and npm. The default development backend is `https://anchal-backend-staging.onrender.com`; override it with `RMC_BACKEND_URL` when needed.

```sh
npm ci --legacy-peer-deps
npm run build
RMC_BACKEND_URL=https://anchal-backend-staging.onrender.com npm run dev
```

Open http://127.0.0.1:5173/anchal/. Usernames are `anchal1` through `anchal6` and `commissioner`; use credentials provisioned by the backend. Office setup asks for a start date and all 25 initial balance triplets before reporting. Confirm zero balances explicitly when applicable.

The Vite proxy forwards `/v1/api/anchal` requests to `RMC_BACKEND_URL`, preserves the backend origin header, and rewrites the API cookie path for the local portal. The backend owns persistence, accounts, and deployment.

## Demo flow

1. Sign in as an Anchal office. On first use, set one reporting-start date and the opening service, complaint and field-task balances for all 25 services. Confirm zero balances where applicable. This setup is locked after the first save.
2. Use **Today’s Entry** for the current IST date. Enter one row per service and day, including the Ward number/name. Submit zero activity deliberately where there was no work.
3. Use **Backdate Entry** for a service date from the reporting-start date through yesterday. A new backdated row requires a delayed-reporting reason; its registration date and time are recorded automatically when submitted.
4. In a separate browser profile/incognito session, sign in as commissioner. Use Refresh when needed; the portal also polls for dashboard updates.
5. Saved rows remain read-only until Edit; every correction requires a reason. The backend retains audit history, but this first frontend iteration does not expose a Change History screen. Later balances are derived from corrected movements.
6. Switch English/Hindi and review daily, date-range, monthly, office and service filters.

Browser acceptance tests may exercise an approved staging test office. Use a dedicated test office and synthetic data; never point mutating tests at operational records.

## Verification

```sh
npm run typecheck
npm run test:domain
npm run build
```

Browser tests require a Vite server, provisioned test accounts, and Chromium (`npx playwright install chromium` if missing). Provide credentials only through `RMC_CREDENTIALS_FILE` (a private JSON username-to-password map) or `RMC_TEST_PASSWORD`; no password is stored in the repository. For the staging-backed local portal, run `RMC_TEST_URL=http://127.0.0.1:5173 RMC_TEST_LOCAL=1 RMC_CREDENTIALS_FILE=/private/path/credentials.json RMC_TEST_OFFICE=6 npm run test:browser`.

The browser suite includes mocked UI coverage and staging-backed checks. Treat staging mutations as operational test data; use an approved test office and remove local credential files after the run.

## Deployment

This repository produces the React frontend. Build it with `npm run build`, then deploy the generated static assets under the `/anchal/` base path to the approved frontend host. Configure that host to route `/v1/api/anchal` to the Anchal backend with cookies and the required origin policy intact.

The backend repository owns API deployment, database migrations, credentials, and live-update infrastructure. Local verification is not proof of a production deployment.

Before a release, verify login, office isolation, cross-session/dashboard refresh behavior, persistence, and the deployed frontend's API/cookie policy. Shared logins attribute history to the office rather than an individual staff member.

## Business rules

- Opening setup is required once per Anchal and cannot be edited after saving. All entry reads and writes require completed setup.
- An office has separate **Today’s Entry** and **Backdate Entry** routes. Today accepts only the current Asia/Kolkata date. Backdate accepts the configured reporting-start date through yesterday; earlier dates are rejected and do not change the start date or baseline. Audit history remains a backend capability and is not presented as a frontend route.
- Unique report key: office + service + service date; Ward number/name is descriptive input. Today has no service-date selector; Backdate selects a date within its permitted range. Reporting/registration date and exact registered time are recorded automatically on first submission and preserved through corrections. Dashboard periods and balances use the service date.
- New backdated reports require a delayed-reporting reason. Every correction requires a correction reason, and saved reports stay read-only until Edit is selected.
- Leaving an office entry page with unsaved changes asks before discarding them. An open Today form advances with IST midnight; an unsaved previous-day draft can continue in Backdate Entry.
- Three balances = configured opening + earlier received − earlier completed/resolved.
- Dates without submissions carry recorded balances forward but remain missing reports.
- Historical corrections are rejected if any later closing balance becomes negative.
- Counts are nonnegative integers; money is integer paise; within-SLA completions cannot exceed completed work.
- Period received/completed/collection figures are summed; pending figures are closing balances at the end of the period.
- Disposal percentage uses received as denominator and can exceed 100% when clearing backlog; zero denominators display “—”.
- Review thresholds come from the workbook, not independent verification of official service standards.

Source workbook: `RMC Anchal Office Monitoring.xlsx`, Daily Entry and Service Master. Individual grievance management, photos/evidence, staff/infrastructure and commissioner-direction modules are outside this iteration.
