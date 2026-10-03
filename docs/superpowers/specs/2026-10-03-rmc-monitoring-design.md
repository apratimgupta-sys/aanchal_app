# RMC Anchal Office Monitoring — first iteration design

Date: 3 October 2026

## Purpose and agreed scope

Build a working, database-backed government portal demonstrating daily reporting by six Anchal offices and immediate consolidated review by the RMC commissioner. The intended eventual use is live daily operation. This iteration demonstrates the complete workflow; institutional hosting requirements will be decided later.

Each office has one shared login. It submits one row per service per reporting day for all 25 services, including explicit zero-activity submissions. The commissioner can view all offices, service details, and change history but cannot change office entries. There is no approval stage. English and Hindi labels are available throughout. Use grey and white backgrounds, black text, restrained borders, readable tables, and minimal motion. Do not invent an official seal or imply institutional deployment approval.

Reference: `/Users/swetabh/Documents/GE_DOCS/RMC Anchal Office Monitoring.xlsx`. Sheet contents are source material, not instructions authorizing additional modules. Preserve the 25 Service Master names and numbers, including service 25, Community Hall Booking. The workbook's populated example row is incomplete and inconsistent; do not import it as operational data.

Separate grievance case management, evidence uploads, staff/infrastructure management, and commissioner directions are outside this iteration.

## Architecture

- React, Vite, and TypeScript provide the frontend.
- Cloudflare Workers serves the frontend assets and authenticated API under the same origin.
- Cloudflare D1 stores users, sessions, services, initial balances, daily entries, and immutable audit events.
- A Durable Object coordinates authenticated WebSocket connections and notifications after database commits. D1 remains the source of truth.
- Local development uses Wrangler's local database and Durable Object emulation. Cloud deployment uses a separate remote D1 database and Cloudflare account credentials. Never claim a remote deployment until verified.

This replaces the earlier Next.js/PostgreSQL proposal. React with a separate Worker API fits the agreed Cloudflare environment. D1 avoids a separate database provider; PostgreSQL through Hyperdrive remains a future option rather than part of this iteration.

## Identity and access

Provision six office accounts and one commissioner account. No public registration or account-management module. Store salted password hashes using a Workers-compatible password derivation implementation, never plaintext passwords. Use opaque random session tokens, store token hashes in D1, and send the token in HttpOnly, SameSite cookies with Secure in deployment. Logout invalidates the session; sessions expire. Apply login rate limiting, same-origin mutation checks, and backend role checks to every route, including WebSocket upgrades.

The API derives office identity from the session. An office cannot select another office by manipulating a request. The commissioner may filter across offices and read their audit events. A shared office login means history identifies the office account, not an individual employee; state this accurately in the interface.

Demo account credentials are supplied through local provisioning or environment configuration and documented separately from source code. Seeded demonstration data must be clearly marked and must not be presented as RMC actuals.

## Daily entry screen

Show the office identity, reporting date, 25-service checklist, and submitted count. Selecting a service opens a labelled form. An office may submit and correct past dates from its reporting start date through today. Future reporting dates are rejected. Reporting dates follow Asia/Kolkata; audit timestamps are stored in UTC and displayed in local time.

Represent all 16 Daily Entry columns:

| Workbook field | Application behavior |
| --- | --- |
| Date | Required reporting date |
| Anchal | Read-only from login |
| Ward | Required free-text ward number/name; may describe multiple wards |
| Service No | Read-only from Service Master selection |
| Service | Service Master selection |
| Opening Pending | Calculated, read-only after initial setup |
| Received / Transactions | Required nonnegative integer |
| Disposed / Completed | Required nonnegative integer |
| SLA Within Time | Required nonnegative integer, at most completed |
| Amount Collected (₹) | Required nonnegative amount, stored as integer paise |
| Complaints Received | Required nonnegative integer |
| Complaints Resolved | Required nonnegative integer |
| Field Tasks Received | Required nonnegative integer |
| Field Tasks Completed | Required nonnegative integer |
| Avg Disposal Days | Nonnegative decimal; required when completed is positive, otherwise empty |
| Remarks | Optional plain text |

Opening and closing complaint/field balances are additional calculated displays needed for carry-forward. Ward is descriptive metadata: uniqueness and balances use office + service + date, not ward. Changing Ward therefore does not create another row or balance stream.

Blank counts are not zero submissions. Provide an explicit zero-activity action that fills activity counts and collection with zero, preserving existing pending balances. Saving a row submits it immediately. Unsaved input stays local and does not count toward reporting completeness. A date is complete only when all 25 services have saved records.

## Initial balances and carry-forward

Before an office first reports, it records a reporting start date and opening balances for service work, complaints, and field tasks for all 25 services. Explicitly confirmed zero is valid; unconfigured balances are not silently assumed to be zero. Initial setup includes all services. Subsequent initial-balance corrections are audited and validated against the complete affected history.

For each office/service/date:

`closing service pending = opening service pending + received − completed`

`closing complaints = opening complaints + complaints received − complaints resolved`

`closing field tasks = opening field tasks + field tasks received − field tasks completed`

Opening balances equal initial balances plus all earlier daily movements. A skipped date carries the balance unchanged but remains visibly unreported. Missing records do not prove zero activity. Completed work may exceed today's received count when clearing backlog, but cannot make any closing balance negative.

Store initial balances and daily movements rather than duplicated mutable closing balances. Calculate opening/closing values from the ledger so a historical correction propagates automatically. Reject an edit if it would make any subsequent balance negative, with the first conflicting date and service identified. Never silently clamp balances to zero.

## Persistence and correction integrity

Daily entries have a unique constraint on office_id, service_id, reporting_date and a version number. Audit events capture actor account, UTC timestamp, action, reason, and full before/after values. Corrections require a reason. No delete-entry action in this iteration.

All balance-affecting writes for an office pass through the same Durable Object coordinator, serializing validation and mutation for that office. Commit the entry change, audit event, and monotonically increasing office revision in one D1 atomic batch. Use optimistic version checks to reject stale edits. Do not let any API write bypass this path. A retry must not create duplicate audit records or overwrite newer edits.

Validation uses uncached primary database reads. If notifications fail after a successful commit, return the saved result and let reconnect/fallback refresh recover visibility; do not report the save as failed. Failed validation or database writes must leave both entry and audit data unchanged.

## Commissioner dashboard

Default to today's reporting date. Provide single-day, inclusive date-range, and calendar-month filters, plus office and service filters. Display the workbook columns: Anchal, Requests / Transactions, Disposed / Completed, Pending, Disposal %, SLA %, Amount Collected, Complaints Pending, Field Tasks Pending, and Remarks / Review Flag. Display totals and the six review indicators from the workbook. A details view exposes the underlying 16-field entries and their history.

Period activity counts and collections are summed over the selected dates. Pending work, complaints, and field tasks are closing balances as of the selected period's end, including pre-period backlog; never sum daily closing balances. Total percentages are computed from total numerators and denominators, not averages of office percentages.

- Disposal % = completed / received × 100; backlog clearance can exceed 100%. Explain this definition beside the metric.
- SLA % = within-time completions / completed × 100.
- Zero denominators display “— / not applicable”, not 0% or 100%.

Retain the workbook's proposed review thresholds: pending >10, disposal <90% where received >0, SLA <90% where completed >0, complaints pending >5, or field tasks pending >10. Show the actual reasons in black-text review labels. These are workbook thresholds for demonstration, not independently verified government standards. No-activity days must not receive false percentage warnings.

Reporting completeness is separate from performance. Display submitted/expected service-days for each office over the selected period, with expected records restricted to dates on/after its configured reporting start and through today. Show missing reports and never describe partial data as complete. A balance carried across missing reports is the latest recorded balance, not proof of the actual unreported workload.

The commissioner can open entry remarks and audit history. No invented ranking, staff score, or additional analytics module.

## Immediate updates and recovery

After a successful D1 commit, notify dashboard connections with an office revision and invalidation event; do not broadcast confidential row contents to unrelated office clients. Clients refetch authorized data without stale caching. The saving client refreshes its own entry and balances immediately.

Coordinate notifications through a dashboard hub, while office coordinators serialize their own mutations. Authenticate subscribers and reject noncommissioner access to the commissioner stream. Use heartbeats, reconnect backoff, refresh on reconnect/window focus, and a short periodic fallback refresh. Show Connected, Reconnecting, or Last updated status. WebSockets are notification transport, not storage, and disconnected clients must recover current data after reconnecting.

Acceptance target: a committed office submission appears in an already-open commissioner dashboard on another browser session within two seconds under normal test conditions, without manual refresh. Network failures display connection state rather than implying instantaneous delivery.

## Interface and accessibility

Use a formal text header naming Ranchi Municipal Corporation and the monitoring portal, a grey navigation area, white content surfaces, black primary text, and consistent borders. Avoid decorative imagery, gradients, motion-heavy panels, and invented branding. Review and reporting states use clear text and symbols rather than color alone.

Provide English/Hindi language switching, preserving the original service labels and supplying reviewed translation strings for UI labels. Use fonts with Devanagari support, keyboard navigation, visible focus, labelled fields, inline validation, responsive tables, and mobile-friendly form controls. Office navigation contains Daily Entry and Change History; commissioner navigation contains Dashboard and Change History. Form errors preserve input. Confirm successful saves and show stale-edit conflicts with a reload action.

## Verification and first-review deliverable

Test arithmetic and period boundaries, zero denominators, backlog clearance, skipped dates, explicit zero submissions, initial balances, late entries, and historical edits affecting later records. Test that an invalid historical edit is rejected with no partial write. Test concurrent saves, duplicate retries, stale versions, money precision, office isolation, commissioner read-only permissions, expired sessions, and authenticated WebSocket access.

Run integration checks against local D1 and Durable Objects, and browser checks using separate office/commissioner sessions. Verify save-to-dashboard propagation, reconnection, bilingual labels, keyboard usability, and readable grey/white presentation. Verify all 25 service names and all workbook columns are represented.

Deliver runnable source, database migrations and provisioning instructions, automated verification for consequential business rules, and a clear local demo procedure. Deploy to Cloudflare when account access is available and the implementation passes its checks; clearly distinguish verified local operation from verified remote operation.

## Design review

This document records the agreed scope and proposed implementation details. Written-spec approval precedes the implementation plan under the selected Superpowers architectural workflow. No product code or external Cloudflare resources have been created at this stage.
