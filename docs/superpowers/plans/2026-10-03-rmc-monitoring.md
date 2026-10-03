# RMC Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver a working bilingual Anchal reporting portal with persistent Cloudflare storage, correct carry-forward balances, audit history, and live commissioner review.

**Architecture:** React screens call a same-origin Workers API. D1 stores the ledger and audit events; one Durable Object per office serializes writes, and a separate hub notifies commissioner browsers after commits.

**Tech Stack:** React, Vite, TypeScript, Cloudflare Workers, D1, Durable Objects, Wrangler, Vitest, Cloudflare Workers test pool, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-03-rmc-monitoring-design.md`

## Global Constraints

- One shared login per each of six offices; commissioner access is read-only.
- One row per office/service/reporting date for all 25 services, including explicit zero-activity entries.
- Ward is required descriptive input, not part of uniqueness or carry-forward identity.
- All three pending balances carry forward; historical corrections cannot make later balances negative.
- English/Hindi interface; grey and white backgrounds, black text, minimal motion.
- Audit timestamps in UTC; reporting dates and displayed timestamps in Asia/Kolkata.
- No public registration, approval workflow, case-level grievances, evidence uploads, or staff module.
- No external Cloudflare resources or deployment until credentials are available; verify local and remote operation separately.

## Review Focus

1. Two tabs correcting the same entry must receive a conflict rather than lose a correction (Task 4).
2. Retried requests after a lost response must return the original result without another audit event (Task 4).
3. Missing reports and dates before onboarding must not be counted as zero activity or expected reports respectively (Task 5).
4. An earlier correction that invalidates later balances must fail without partial persistence (Task 4).
5. A disconnected commissioner browser must recover missed changes on reconnection (Task 6).

## File map and shared interfaces

- `src/shared/types.ts`: domain and API contracts.
- `src/domain/{validation,ledger,metrics}.ts`: pure business rules.
- `src/worker/{index,auth,api,repository,office-coordinator,dashboard-hub}.ts`: transport, identity, persistence, serialization, notifications.
- `src/client/{main,App,api,i18n,styles}.tsx` (styles uses `.css`, API and translations use `.ts`): application shell and shared presentation.
- `src/client/pages/{Login,InitialBalances,DailyEntry,Dashboard,ChangeHistory}.tsx`: role-specific screens.
- `src/client/components/{Field,ServiceChecklist,EntryForm,MonitoringTable,ConnectionStatus}.tsx`: focused reusable controls.
- `migrations/0001_initial.sql`, `scripts/{extract-services,provision-demo}.ts`: schema and deliberate seed/provisioning.
- `tests/{domain,worker,browser}/`: arithmetic, D1/API, and browser behavior.
- `package.json`, `tsconfig.json`, `vite.config.ts`, `wrangler.jsonc`, test configs, `.gitignore`, `.env.example`, `README.md`: development and deployment setup.

Contracts in `types.ts`:

- `Role = 'office' | 'commissioner'`; `UserSession = {userId, role, officeId: number | null, expiresAt}`.
- `Balances = {service: number, complaints: number, field: number}`.
- `Activity = {received, completed, slaWithinTime, amountPaise, complaintsReceived, complaintsResolved, fieldReceived, fieldCompleted}` (all integer numbers).
- `EntryInput = Activity & {serviceId, reportingDate, ward, avgDisposalDays: number | null, remarks}`.
- `StoredEntry = EntryInput & {id, officeId, version, createdAt, updatedAt}`.
- `EntryView = StoredEntry & {opening: Balances, closing: Balances}`.
- `SaveCommand = {requestId: string, expectedVersion: number | null, input: EntryInput, reason: string | null}`.
- `InitialSetupCommand = {requestId, expectedVersion, startDate, balances: Array<{serviceId, opening: Balances}>, reason}`.
- `ApiError = {code, message, fieldErrors?, conflictDate?, serviceId?}`; response statuses: validation 422, unauthorized 401, forbidden 403, stale conflict 409.
- `PeriodFilter = {from: string, to: string, officeId?: number, serviceId?: number}`.
- `MonitoringRow = {officeId, received, completed, pending, disposalPct: number | null, slaPct: number | null, amountPaise, complaintsPending, fieldPending, submitted, expected, reviewReasons: string[]}`.
- `RevisionEvent = {type: 'invalidate', officeId: number, revision: number}`.

## Task 1: Establish the domain and service catalog

**Files:** shared types, domain validation/ledger, service extraction script, `src/shared/services.json`, domain tests, package/TypeScript/Vitest setup.

**Interfaces:** Produce `validateEntry(input: EntryInput, today: string): ApiError | null`, `applyActivity(opening: Balances, activity: Activity): Balances`, and `deriveEntryViews(initial: Balances, entries: StoredEntry[]): EntryView[]`. Later tasks reuse these functions.

- [ ] Create test dependencies/configuration and write failing tests: opening `{service:10,complaints:3,field:5}` with movements received 2/completed 4, complaints 1/resolved 2, field 0/completed 1 closes at `{service:8,complaints:2,field:4}`. A skipped day changes nothing; SLA above completed, fractional counts, future dates, invalid calendar dates, and negative money are rejected.
- [ ] Run `npm run test:domain`; confirm failures identify missing rules rather than unrelated setup errors.
- [ ] Implement the contracts and pure rules. Reject unsafe integer counts and money; parse rupee input exactly to paise at the API/UI boundary. Derive views chronologically without mutating stored input.
- [ ] Extract all 25 source service rows read-only, retaining numbers, names, categories, monitoring units and suggested SLA text. Add English/Hindi display names without replacing source names. Do not seed the workbook's example entry.
- [ ] Run domain tests, including catalog assertions for IDs 1–25 and Community Hall Booking at 25; verify corrected earlier movement changes later opening balances.
- [ ] If a Git repository exists, commit only this task's files; otherwise defer Git initialization to execution setup and report it accurately.

## Task 2: Build D1 schema and repository

**Files:** migration, repository, worker environment types, Wrangler config, Workers test setup, `tests/worker/repository.test.ts`.

**Interfaces:** Produce `Repository` methods `getServices()`, `getSetup(officeId)`, `getEntries(officeId, serviceId?)`, `getEntry(id)`, `getAudit(filter)`, and `commitMutation(mutation)`. Typed mutation includes entry/setup change, actor, audit snapshots, requestId, response snapshot, and new revision.

- [ ] Write integration tests proving office/service/date uniqueness, persisted initial balances, ordered audit snapshots, and rollback of a deliberately invalid batch.
- [ ] Run `npm run test:worker -- repository`; confirm schema/repository tests fail before implementation.
- [ ] Create tables: offices, users, sessions, services, office_setup, initial_balances, daily_entries, audit_events, office_revisions, mutation_receipts. Add foreign keys, numeric checks, unique entry key, setup version, request uniqueness per office, and indexes for office/date/service and audit browsing. Store timestamps explicitly and amounts in paise.
- [ ] Implement parameterized D1 queries and atomic batches for mutation + audit + revision + receipt. Audit snapshots include the domain state before/after; receipts support safe retries. Coordinator-owned writes cannot be called from public routes directly.
- [ ] Configure local D1, assets and Durable Object bindings. Use currently documented Wrangler configuration and Workers test pool APIs; consult Cloudflare/Context7 documentation at execution time before selecting package versions.
- [ ] Run repository integration tests and type checking; verify migrated empty database and service seed.
- [ ] Commit scoped changes if Git is initialized.

## Task 3: Implement office and commissioner authentication

**Files:** auth, API routing skeleton, provisioning script, auth tests, environment example.

**Interfaces:** Produce `authenticate(request: Request, env: Env): Promise<UserSession | null>` and `requireRole(session, role): void`; endpoints `POST /api/login`, `POST /api/logout`, `GET /api/session`, `GET /api/services`.

- [ ] Write failing tests for valid login, invalid login, cookie flags, expiry/logout invalidation, rate limiting, cross-origin mutations, office identity tampering, and commissioner mutation denial.
- [ ] Run auth tests and confirm failure before implementation.
- [ ] Implement Workers-compatible salted password derivation, random opaque session tokens with stored hashes, bounded session expiry, HttpOnly/SameSite cookies, deployment Secure flag, and constant-time verification. Apply same-origin checks and platform-compatible login rate limiting; never log passwords or tokens.
- [ ] Provision exactly six office users and one commissioner from environment-provided credentials. Document provisioning; exclude secrets from Git. Keep any generated demo data visibly labelled.
- [ ] Run auth tests and verify office sessions cannot access another office's data. Return public errors without internal database details.
- [ ] Commit scoped changes.

## Task 4: Implement initial setup, entries, and audited corrections

**Files:** office coordinator, entry/setup API, repository extensions, mutation integration tests.

**Interfaces:** `OfficeCoordinator.saveEntry(session: UserSession, command: SaveCommand): Promise<EntryView>` and `.saveSetup(session, command: InitialSetupCommand)`; endpoints `GET/PUT /api/office/setup`, `GET /api/office/entries?date=`, `POST /api/office/entries`, `PUT /api/office/entries/:id`, `GET /api/history`. Worker injects trusted actor identity and routes mutations to the logged-in office's object.

- [ ] Write failing tests: missing setup blocks reporting; setup requires all 25 service balances; zero activity is submitted; Ward edits retain row identity; stale version returns 409; correction without reason returns 422; duplicate request returns original response with one audit event.
- [ ] Add a historical correction test: initial balance 10, first day received 0/completed 4, next day completed 6. Changing first-day completed to 5 must fail and leave entries, revision, and audit unchanged. Add concurrent saves and initial-balance correction variants.
- [ ] Run mutation tests and confirm failures.
- [ ] Serialize all office mutations inside the Durable Object across awaited operations. Validate against uncached primary D1 reads and all affected later balances; reject dates before start and future dates. Use expectedVersion plus atomic commit receipts. Distinguish new submission from correction.
- [ ] Return derived opening/closing balances; record full before/after snapshots and office actor. Audit initial setup and corrections too. Do not implement deletion.
- [ ] Run domain and mutation tests, including network retry and invalid subsequent balance assertions.
- [ ] Commit scoped changes.

## Task 5: Implement period metrics and read-only commissioner API

**Files:** metrics, dashboard API/repository queries, metrics and dashboard tests.

**Interfaces:** `summarizePeriod(setups, entries, filter: PeriodFilter, today: string): MonitoringRow[]`; `GET /api/dashboard?from=&to=&officeId=&serviceId=`, `GET /api/dashboard/entries` and authorized history browsing.

- [ ] Write failing tests: received 2/completed 4 yields 200% disposal; zero denominator returns null; SLA totals use summed numerators; two closing balances 8 then 6 produce ending pending 6, never 14; pre-period backlog is retained.
- [ ] Add thresholds tests for strict >10 pending, <90% disposal/SLA with applicable denominator, >5 complaints and >10 field tasks. Missing report stays missing; onboarding halfway through a range excludes earlier dates from expected service-days. Unconfigured office shows setup missing rather than confirmed zero.
- [ ] Run metrics/API tests and confirm failures.
- [ ] Implement inclusive period filtering and closing balance calculations from the full prior ledger. Return six office rows and totals, underlying details, review reasons, reporting completeness and revision. Validate date ranges and filter identifiers.
- [ ] Run tests proving commissioner has read-only access and offices cannot use commissioner routes. Verify all ten workbook dashboard columns and 16 detail fields exist in returned contracts.
- [ ] Commit scoped changes.

## Task 6: Implement authenticated live notifications

**Files:** dashboard hub, notification integration, `src/client/live.ts`, connection tests.

**Interfaces:** `DashboardHub.publish(event: RevisionEvent): Promise<void>`; authenticated `GET /api/live` upgrades; `subscribeToUpdates(onEvent, onStatus): () => void` refetches through normal authorized APIs.

- [ ] Write failing tests: unauthenticated/office upgrade rejected; successful commit publishes revision; failed commit does not; duplicate retry creates no second mutation; missed revision is recovered after reconnect.
- [ ] Run connection tests and confirm failures.
- [ ] Implement the hub and post-commit notification path. A hub outage cannot turn a committed save into an apparent failed save. Send invalidation metadata only, authenticate subscriptions, and handle expiry for established connections.
- [ ] Implement heartbeat, bounded reconnect backoff, refetch on reconnect/focus, and 15-second fallback refresh while visible. Connection state and last successful update remain explicit; prevent old responses from replacing newer filter results.
- [ ] Verify a saved entry appears in a second commissioner session within two seconds under normal local conditions; simulate interruption and verify recovery.
- [ ] Commit scoped changes.

## Task 7: Build the bilingual government portal interface

**Files:** client shell, pages/components/styles, i18n, API client, browser tests, Vite assets setup.

**Interfaces:** pages consume the endpoints and shared contracts above; API client normalizes ApiError and exposes typed request functions. Language preference is persisted locally; authentication is cookie-based.

- [ ] Write browser scenarios for login by role, onboarding, submission progress, zero activity, validation retaining input, correction reason/history, commissioner filters, language switching, and stale edit reload.
- [ ] Run browser checks against an initial shell and confirm the expected missing flows.
- [ ] Build a formal text header, grey navigation, white content panels, black text, clear borders and visible keyboard focus. Use readable Devanagari-capable font fallbacks, responsive labelled controls, and horizontally scrollable tables on narrow screens.
- [ ] Build initial balance setup with explicit confirmation for all 25 services. Daily Entry shows date, service checklist and submitted count; computed fields are read-only, Ward remains manual, and drafts do not count as submissions.
- [ ] Build commissioner summary indicators, all workbook columns, period/office/service filters, reasons for review, missing reporting, details and history. Display null percentages as not applicable and label seeded examples if present. Display shared-office audit identity accurately.
- [ ] Wire live refetch and connection status; protect unsaved form input from background refresh. Show successful save, actionable validation errors and version conflicts.
- [ ] Run browser flows in English/Hindi and review desktop/mobile screenshots, field labels, keyboard navigation and table readability.
- [ ] Commit scoped changes.

## Task 8: Verify and package the first iteration

**Files:** README, scripts/config refinements, deployment checklist, final browser tests.

**Interfaces:** commands `npm run dev`, `npm run db:migrate:local`, `npm run provision:local`, `npm run typecheck`, `npm run test:domain`, `npm run test:worker`, `npm run test:browser`, `npm run build`, `npm run deploy`.

- [ ] Document local runtime requirements, database migration, credential provisioning, initial balances, demo steps, tests, and remote Cloudflare bindings/secrets. Explain first-review scope and shared-login attribution.
- [ ] Run type checking, consequential domain tests, Workers integration tests, production build, and browser acceptance scenarios. Fix failures with their owning task's tests; record concrete outputs.
- [ ] Demonstrate office submission → commissioner update → correction → audited history → later carry-forward adjustment. Verify persistence through runtime restart.
- [ ] Perform a whole-change review for scope, authentication, transactional writes, retry behavior, metrics, translations and workbook coverage. Use independent review only when the execution method or applicable skill calls for it.
- [ ] If Cloudflare account access is available, create remote bindings, migrate/provision deliberately, deploy, and repeat key cross-session checks on the actual URL. Otherwise deliver the verified local app and document that remote deployment requires account access.
- [ ] Commit completed source and documentation if Git is initialized; report verified behavior, runnable location, and any remaining deployment limitation. Do not claim a hosted application from a local build.

## Self-review outcome

The plan covers scope, initial balances, all entry columns, all service names, carry-forward, corrected history, live recovery, role isolation, bilingual presentation and local/remote verification. The five review-focus failures each have explicit tests in their owning task. Shared interfaces are defined once and reused. Execution has not begun.
