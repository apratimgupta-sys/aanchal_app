# RMC Anchal Office Monitoring

Working first iteration: bilingual React portal, Cloudflare Workers API, D1 relational ledger, and Durable Object WebSocket notifications. Grey/white government portal presentation. Six shared office accounts and read-only commissioner access.

## Run locally

Requires Node 22.12+ and npm.

```sh
npm ci --legacy-peer-deps
npm run build
npm run db:migrate:local
# Set RMC_DEMO_PASSWORD through your shell/environment (12+ characters).
npm run provision:local
npm run dev:worker
```

Open http://localhost:8787. Usernames are `anchal1` through `anchal6` and `commissioner`; use the password supplied at provisioning. Provisioning preserves existing passwords. This provisions accounts and the source service catalog only, not real RMC records. Office setup asks for start date and all 25 initial balance triplets before reporting. Confirm zero balances explicitly when applicable.

For frontend development, run `npm run dev` alongside the Worker server. The Vite proxy forwards API calls to port 8787. For a unified production-like demo use the built assets and Worker URL above. Local D1 data persists in `.wrangler/state`; do not delete it to restart the server.

## Demo flow

1. Sign in as an Anchal office. On first use, set one reporting-start date and the opening service, complaint and field-task balances for all 25 services. Confirm zero balances where applicable. This setup is locked after the first save.
2. Use **Today’s Entry** for the current IST date. Enter one row per service and day, including the Ward number/name. Submit zero activity deliberately where there was no work.
3. Use **Backdate Entry** for a service date from the reporting-start date through yesterday. A new backdated row requires a delayed-reporting reason; its registration date and time are recorded automatically when submitted.
4. In a separate browser profile/incognito session, sign in as commissioner. Submissions update the open dashboard automatically.
5. Use **Change History** to review office changes. Saved rows remain read-only until Edit; every correction requires a reason. Later balances are derived from corrected movements.
6. Switch English/Hindi and review daily, date-range, monthly, office and service filters.

Browser acceptance tests create clearly synthetic entries in the local demonstration database. Use a separate database for real operational data.

## Verification

```sh
npm run typecheck
npm run test:domain
npm run test:worker
npm run build
npm run test:browser
```

Browser tests require the server on port 8787, provisioned demo accounts, and Chromium (`npx playwright install chromium` if missing). They use a known **local test-only** password set in `tests/browser/portal.spec.ts`; do not use this password for remote deployment. Tests verify office/commissioner isolation, historical balance validation, atomic writes, retries, stale versions, session expiry, WebSockets and cross-session dashboard updates.

The Workers test pool currently supports compatibility date 2026-08-22, so its config overrides that date only for tests. The application Wrangler configuration uses 2026-10-03.

## Cloudflare deployment

The application is ready for Cloudflare bindings but local verification is not proof of remote deployment. Hosted first iteration: https://rmc-monitoring.nick900684.workers.dev. Separate account credentials are stored locally in `.wrangler/remote-demo-credentials.json` (ignored by Git). This is a demonstration environment.

For a new deployment, a Cloudflare account must be authenticated (`npx wrangler login` / configured API token).

1. Create a D1 database with `npx wrangler d1 create rmc-monitoring`.
2. Replace the local placeholder `database_id` in `wrangler.jsonc` with the returned real ID.
3. Apply migrations using `npx wrangler d1 migrations apply rmc-monitoring --remote`.
4. Supply separate per-account passwords via `RMC_CREDENTIALS_FILE` pointing to a private JSON map of username to password, and run `node scripts/provision-demo.mjs --remote`. Alternatively set `RMC_DEMO_PASSWORD` for a temporary local demonstration. This iteration has no password-management UI. Provision individual account passwords operationally before real use; invalidate existing sessions when rotating credentials.
5. Run `npm run deploy`; Durable Object classes are created through the configured migration.
6. Verify login, office isolation, cross-session updates and persistence on the deployed URL. Decide institutional hosting and data policy before live rollout.

No PostgreSQL server, external identity provider, or Cloudflare KV is required. WebSockets broadcast invalidation metadata after D1 commits; disconnected dashboards recover by reconnect/focus and a 15-second refresh fallback. Shared logins attribute history to the office rather than a staff member.

## Business rules

- Opening setup is required once per Anchal and cannot be edited after saving. All entry reads and writes require completed setup.
- An office has separate **Today’s Entry**, **Backdate Entry** and **Change History** routes. Today accepts only the current Asia/Kolkata date. Backdate accepts the configured reporting-start date through yesterday; earlier dates are rejected and do not change the start date or baseline.
- Unique report key: office + service + service date; Ward number/name is descriptive input. Today has no service-date selector; Backdate selects a date within its permitted range. Reporting/registration date and exact registered time are recorded automatically on first submission and preserved through corrections. Dashboard periods and balances use the service date.
- New backdated reports require a delayed-reporting reason. Every correction requires a correction reason, and saved reports stay read-only until Edit is selected.
- Three balances = configured opening + earlier received − earlier completed/resolved.
- Dates without submissions carry recorded balances forward but remain missing reports.
- Historical corrections are rejected if any later closing balance becomes negative.
- Counts are nonnegative integers; money is integer paise; within-SLA completions cannot exceed completed work.
- Period received/completed/collection figures are summed; pending figures are closing balances at the end of the period.
- Disposal percentage uses received as denominator and can exceed 100% when clearing backlog; zero denominators display “—”.
- Review thresholds come from the workbook, not independent verification of official service standards.

Source workbook: `RMC Anchal Office Monitoring.xlsx`, Daily Entry and Service Master. Individual grievance management, photos/evidence, staff/infrastructure and commissioner-direction modules are outside this iteration.
