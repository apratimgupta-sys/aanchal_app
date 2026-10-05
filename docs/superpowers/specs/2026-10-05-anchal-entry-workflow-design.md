# Anchal entry workflow — confirmed design

Date: 5 October 2026

## Purpose

Make the Anchal workflow easy to understand while preserving the one-time opening baseline needed to calculate pending work. Officers must complete the baseline before they can report. Once saved, it is permanently locked and removed from their ordinary interface.

## Confirmed routes and navigation

An authenticated Anchal office uses these routes:

| Route | Tab | Service dates permitted |
| --- | --- | --- |
| `/office/today` | Today’s Entry | Today in Asia/Kolkata only |
| `/office/backdate` | Backdate Entry | Reporting-start date through yesterday in Asia/Kolkata |
| `/office/history` | Change History | Not applicable |

After a completed setup, login lands on `/office/today`. The tabs are visible only to office users. The commissioner keeps its dashboard and organisation-wide history routes.

The Today and Backdate pages share the existing service list, activity fields, zero-activity action, save behavior and read-only-until-Edit behavior. A record appears on the page determined by its service date. A user cannot choose dates in the Today page. The Backdate page cannot choose today, a future date, or a date before the reporting-start date.

## One-time opening balance setup

An office without a setup is redirected to a dedicated opening-balance setup page regardless of which office route it requested. It cannot read or write entry data until the setup succeeds.

The setup requires:

- one reporting-start date;
- a non-negative service, complaint and field-task opening balance for each of the 25 services; and
- explicit confirmation that zero balances are intentional where applicable.

Saving this setup records an audit event and permanently locks it. The UI never offers Anchal users a way to reopen or alter it. The server rejects every later setup mutation, including a request made directly against the API. Existing offices that already have a setup pass the gate without any migration or re-entry.

Opening and closing balances remain calculated from this locked baseline and daily activity. The commissioner dashboard retains its current pending and closing-balance reporting.

## Backdated reporting and corrections

A new Backdate Entry must include a non-empty **Reason for delayed reporting**. This reason becomes part of the audit event.

When a saved entry is changed, the form requires a non-empty **Reason for correction**, whether the record belongs to Today’s Entry or Backdate Entry. Change history preserves prior and updated business values, actor account, registration timestamp, action and reason. The Anchal history page is limited by server authorization to that Anchal’s own records and setup events; the commissioner history remains organisation-wide.

The server sets registration date and exact registration time on the first save. They do not change when an entry is corrected. Backdated activity continues to affect later calculated balances; edits that would create a negative later balance remain rejected.

## API and data rules

- Entry endpoints derive the office from the authenticated session.
- A setup check occurs before every office-entry read and write operation that depends on reporting data.
- Initial setup is insert-only. A pre-existing `office_setup` row is authoritative and cannot be updated through the office API.
- Every entry save validates the route's date rule at the server, not only in the browser.
- Existing opening-balance rows and audit events are retained. No destructive migration is needed.

## Error handling

- An incomplete opening setup remains on the setup page and shows field-level validation.
- A direct attempt to access an office tab before setup returns the setup gate.
- A direct API attempt to change an existing baseline returns a clear conflict error.
- A date outside the allowed Today/Backdate range returns a clear validation error.
- A blank late-reporting or correction reason returns a field-level validation error without saving any values.

## Verification

Automated checks will prove:

1. A new office cannot enter activity until all 25 opening balances are saved.
2. Setup succeeds once and every second setup request is rejected without changing the original baseline.
3. Today’s Entry permits only today; Backdate Entry permits only the configured range.
4. New backdated entries require a delayed-reporting reason; corrections require a correction reason.
5. Anchal history contains only its own events, while commissioner history remains organisation-wide.
6. Opening/closing balance calculations and rejection of invalid later balances continue to work.
7. Direct URLs, keyboard navigation, mobile layout and light/dark UX4G checks work for the three tabs and the setup gate.

## Scope boundary

This iteration does not add commissioner baseline correction, individual staff accounts, approval steps or a period-closing/reopen process. Those are future controlled workflows.
