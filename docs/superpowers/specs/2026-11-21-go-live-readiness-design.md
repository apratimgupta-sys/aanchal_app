# Go-live readiness — design

**Date:** 21 November 2026
**Scope:** Stage 0 of the implementation plan — the work that must land before six Anchal
offices start filing for real.

## Intent

The portal goes live next week. Nothing is in production use yet, so no entry has ever been
filed. That makes this the last moment when certain changes are code changes; afterwards the
same changes become data migrations over records a municipal corporation depends on.

Stage 0 contains only work of that kind, plus the two operational checks that decide whether
a failure is noticed. Nothing cosmetic is in scope. Officers will be trained on the current
interface, which is acceptable for one week.

## Goals

- No path in the product can silently destroy a figure an office has already filed.
- Ward values are constrained from the first entry onward, so ward-level accounting is
  possible later without cleaning free text.
- Nothing is stored on a field visit that RMC did not ask for.
- An outage is noticed by us, not reported by an officer.

## Non-goals

- Any visual change. The redesign is Stage 2 onward.
- Any performance work. The read-path fix is Stage 1 and touches no screen.
- Photographs, exports, ward reporting, the role-manager account. All later, all by decision.

## Anti-goals

- A schema-version fork. Stored entries carry `schemaVersion` 1 and reads reject anything
  else. Nothing in Stage 0 may change the shape of a stored snapshot.
- A migration run against production during go-live week.
- Any change that requires officers to be re-trained after training.

## Decisions

### D1 — Ward stays a string, constrained by format rather than by a list

`EntryInput.Ward` is `string` today and stored snapshots carry values like `"Ward 11"`.
Changing it to an integer would change the snapshot shape and force a version fork, which the
anti-goals forbid.

So the type does not change. The **canonical format becomes `Ward N`, N from 1 to 53**, and
both sides validate the format rather than holding a copied list of names:

- Server: reject anything not matching `Ward <n>` with 1 ≤ n ≤ 53.
- Client: render a `<select>` whose 53 options are generated from the same range.

Neither repo holds a hand-written ward list, so the two cannot drift — the failure mode that
already exists for the service-shape lists and is deliberately not repeated here.

Labels are the bare number only: `Ward 11`, not `Ward 11 — Konka`. The ward master's
localities are not used in the picker.

Field visits already store ward as an integer 1–53. The two remain reconcilable by parsing
the number out of the daily entry's string, which is why the format is fixed rather than free.

### D2 — "Verified on site" is removed, the column is not

The flag is computed from thresholds invented during development — 100 metres of accuracy and
a 30-minute capture window — that RMC never agreed to. It is a policy decision wearing a
technical costume, and an unverified visit carries no consequence anywhere in the product.

It stops being computed and stops being returned. The database column stays, unused: dropping
it needs a migration, and the anti-goals forbid one this week. It can be dropped later with
anything else that needs a migration.

In its place the register shows the stored coordinates and a link that opens them in a map.

### D3 — The map link format

`https://maps.google.com/?q=<latitude>,<longitude>`, opening in a new tab. Coordinates are
already stored and already returned; this is presentation only.

### D4 — "Figures as of" needs no backend work

The dashboard payload already carries `updatedAt` and `retrievedAt`, added by the HTTP
adapter. The client has never read either. Rendering the time is a frontend change alone.

### D5 — The health endpoint already exists

`/health` is wired with a database check and is excluded from the monitoring middleware. No
code is needed. What is missing is something watching it, which is operational
configuration rather than development work, and is recorded as a checklist item.

### D6 — The phone header names all three roles

The phone header chooses between two labels, both hardcoded English, so a field officer on a
phone is told they are in the Commissioner Dashboard. Officers are the role most likely to be
on a phone, so this is the common case rather than an edge one.

It is in Stage 0 rather than in the redesign because it is minutes of work, it is visible to
every officer from the first day, and officers are being trained next week on the interface
that contains it.

### D7 — "Set zero activity" writes only what the shape collects

Today the button rebuilds the entry from blank and writes explicit zeros into every figure,
including the six the form no longer displays. It must write zeros only to the fields the
service's shape actually collects, and leave the rest exactly as loaded — which is what every
other path in the product already does.

## Constraints

- No migration. No change to `schemaVersion`. No change to the shape of a stored snapshot.
- Both repos: frontend `CommissionerDashboard`, backend `backend-anchal`.
- Every user-visible string added needs English and Hindi. Server messages are translated on
  the client by exact match, falling back silently to English, so a new server literal without
  a Hindi key is a defect.
- The existing suites stay green: backend 309, frontend 230, `tsc` clean, the live Playwright
  gate 10/10.

## Left to the builder

- How the ward select is composed — the 53 options are generated, not listed.
- Where the coordinates and map link sit within the existing register row.
- Test names and fixture values, beyond the exact assertions the plan pins.
