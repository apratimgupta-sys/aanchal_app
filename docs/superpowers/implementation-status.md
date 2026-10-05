# First iteration verification

3 October 2026. Implemented React/Vite frontend, Cloudflare Workers API, persistent D1 ledger and authenticated Durable Object notifications. Local preview: http://localhost:8787.

Verification: type checking; 12 domain tests; 11 Workers/D1 integration tests; 4 Chromium browser scenarios; production build. Desktop and mobile screenshots inspected. Independent review completed; important findings corrected. Browser acceptance verifies submission propagation within two seconds, correction history, full-month selection, preserved detail view, deliberate zero activity and recovery without reloading.

Decisions: initialized a new feature branch in the otherwise empty project; RPC errors use envelopes because custom prototypes do not cross RPC; Workers tests override compatibility date to the supported 2026-08-22 while application config remains 2026-10-03. Source and setup instructions are kept in place. No remote push, merge, or deployment.

Cloudflare authentication is expired and cannot refresh non-interactively. Remote deployment requires a new Wrangler login and a real D1 binding ID. Do not confuse local Cloudflare emulation with a hosted deployment.

Minor limitation: raw audit JSON property names are English, with bilingual surrounding labels. Shared logins identify an office, not an individual staff member.

## Hosted demonstration — 3 October 2026

Cloudflare OAuth login completed with user assistance. Deployed Worker `rmc-monitoring` at https://rmc-monitoring.nick900684.workers.dev with dedicated D1 database `e4cd14c1-9fbf-48ca-9a7e-5a823ffcda1a` and both Durable Object classes. Version: `bd347ede-e753-4ead-86cf-386596a23d63`.

All four Chromium acceptance scenarios passed against the remote deployment. Remote logins use separate generated passwords per account stored only in the Git-ignored private file `.wrangler/remote-demo-credentials.json`. Browser acceptance created demonstration balances and one service entry for Anchal 1; the portal marks itself as a demonstration. No workbook example rows or actual RMC operational records were imported.

Live timing is measured after the successful save response, with a newly changed collection amount to prove a fresh update. The earlier click-to-update timing included the save network round trip and did not measure the specified commit-to-dashboard target.

## Separate service and registration dates — 3 October 2026

User approved a bounded change: service date can be backdated, while reporting date records the actual first-registration date. Added a per-service Service date control and read-only Reporting / registration date with exact timestamp. Dashboard service register exposes both dates and the timestamp. Ledger, period filters and row identity use service date. Corrections preserve reporting date and createdAt; clients cannot forge either.

Existing entries are normalized on read: old reportingDate is retained as serviceDate, and registration date is derived from the existing createdAt in Asia/Kolkata. No schema/data rewrite required. The legacy SQL reporting_date column remains the service-date uniqueness key. Existing audit snapshots stay unchanged.

Independent review found no important persistence/date-calculation defects. Selecting another service date loads that date's service entry; it does not move an already-submitted entry to another date. This preserves the existing unique daily-record identity.

Deployed date update as Cloudflare version `5f1cd373-b59c-49aa-9bea-1fc1d306dbba`. Type checking, 12 domain tests, 13 Workers integration tests and all 5 local browser scenarios passed before deployment.

Final deployed version: `f587746c-d3e3-4d89-b762-7aa2b845f74c`. All five hosted Chromium scenarios passed, including back-entry, correction history, commit-to-dashboard propagation within two seconds, and reconnect recovery. Setup reads now use one D1 join rather than sequential queries per configured office. Hosted verification uses Anchal 6 to avoid altering Anchal 1's existing demonstration entries.

## UX4G navy redesign — 3 October 2026

Branch `feature/ux4g-design` integrates the supplied UX4G skill with the official pinned npm package. Government navy primary actions, white/grey surfaces and neutral text are applied through root theme tokens. Forms, cards, lists, tables, navigation, progress and feedback use verified UX4G classes. Eight local browser scenarios, type checking and production build pass. New accessibility tests cover light/dark contrast, four responsive modes, keyboard skip/focus, 44px targets and canceled draft selection. Detailed component/token/custom-CSS inventory and package limitations are recorded in `docs/ux4g-integration.md`. No backend or database changes; deployment and push remain pending.

## Office entry refinements — 3 October 2026

Removed the duplicate View service date control and the two explanatory paragraphs identified by the user. A single Service date selector navigates records outside the submitted form. Saved values are read-only until Edit entry; Cancel editing restores persisted values. Corrections continue to require reasons and preserve first registration.

This behavior was superseded on 5 October 2026 by the approved routed workflow below. The configured reporting start is now a fixed boundary; earlier service dates are rejected without changing setup or opening balances.

## Routed Anchal entry workflow — 5 October 2026

Anchal offices now use /office/today, /office/backdate and /office/history. An office without setup is redirected to a dedicated first-login screen to save one reporting-start date and 25 opening-balance triplets. The setup is locked after its first successful save and is hidden from normal office navigation. Existing configured offices pass the gate without re-entering their baseline.

Today accepts only the current Asia/Kolkata date. Backdate accepts the configured start date through yesterday and requires a delayed-reporting reason on new rows. Each row retains its server-recorded registration date/time. Saved rows remain read-only until Edit; corrections require a reason. The Worker enforces the setup gate, date ranges, immutable setup and office-scoped audit history. Commissioner history and dashboard balance calculations remain organisation-wide.

Verification on the isolated codex/anchal-entry-workflow branch: TypeScript checking, 16 domain tests, 19 Worker integration tests, 11 local browser scenarios and production build pass. Local browser tests use only the local Wrangler Worker and local D1 database. No remote Cloudflare deployment or shared-branch push was performed.

Final review fixes protect dirty office forms when using tabs or browser history, and advance a clean Today form at IST midnight. A dirty previous-day draft can continue on the Backdate route. Final verification: 13 local Chromium scenarios pass, including both recovery cases.
