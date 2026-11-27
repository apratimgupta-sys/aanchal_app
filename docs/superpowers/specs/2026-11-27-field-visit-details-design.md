# Per-service field visit details — design

**Date:** 27 November 2026
**Requested by:** the client, as eight numbered field lists for the field-work services.
**Scope:** piece 1 of three. Piece 2 (per-service reporting) and piece 3 (dropping field work from
the daily entry) are separate and come after, by the client's decision — reporting last, "when we
have more clarity".

## What already exists

Checked before designing. The field visit form and `monitoring_field_visits` already carry, for
every service, most of what each of the eight lists asks for:

| asked for | already there |
|---|---|
| Pickup / Fogging / Activity / Work / Inspection date | `VisitDate` — one field, per-service **label** only |
| Ward | `Ward` (int), required, 1–53 |
| Geo-location | `Latitude`, `Longitude`, `AccuracyMetres`, `GpsCapturedAt`, with a map link |
| Work / fault / outcome / pruning / inspection description | `IssueAction` (20–4000 chars), required |
| Photo | `PhotoOneKey`, `PhotoTwoKey` — **stay disabled**, as the client confirmed |

So the per-service date labels and the per-service description labels are relabelling, not new
fields — the same mechanism as the daily entry's per-service work-done labels.

**What is genuinely new** is the middle of each form: street/lane, team/labour/vehicle details, two
dropdowns, and the quantities. None of these have anywhere to live, so **this needs the first
database migration in some time.**

## Storage: one JSON column, not ten nullable ones

`monitoring_field_visits` gains a single nullable `DetailsJson` column. The service-specific fields
live in it as a flat object.

Ten typed columns would be mostly null on any given row, and RMC has already revised these field
lists twice. With JSON the next revision costs no migration.

**The JSON carries its own version** (`{"v":1, …}`), and a reader that meets an unknown version
**renders what it can and ignores the rest — it does not throw.** This is the explicit lesson from
the daily entry's audit snapshot, where `Snapshot()` hard-throws on `SchemaVersion != 1`: that
decision means a stored row of the wrong version takes down the screen rather than degrading. Do
not repeat it here.

Validation is **not** relaxed by using JSON: the server validates the details object against the
per-service definition below and rejects unknown keys, so the column is not a free-for-all.

## The field definitions live in shared data, guarded

Per-service field definitions go in `src/shared/field-visit-fields.json`: for each service id, an
ordered list of `{ key, type, label (en/hi), options?, integer? }`, where `type` is one of
`text`, `textarea`, `number`, `select`.

This is the **third** hand-maintained twin in this project — after the shape tables and the service
names, both of which diverged. So the definitions are mirrored into the backend and guarded by the
**golden-fixture byte-identity mechanism built and proven this week**: each repo asserts its own
copy, so a one-sided edit reddens a test in the repo where the edit was made.

## The eight forms

Common to all: date (labelled per service), ward, geo-location, description (labelled per service),
photos disabled. Only the service-specific fields are listed.

| id | service | new fields |
|---|---|---|
| 8 | Waste Vehicle Service | vehicle & labour (text) · street / lane (text) · waste type (**select**: wet / dry / mixed) · quantity (number, kg) |
| 9 | Fogging | team details (text) · vehicle number (text) · street / lane (text) · route / area covered (text) |
| 10 | Street Dog Service | team / labour (text) · dogs picked (number) · dogs neutered & released (number) · location of action (text) |
| 13 | Street Light Service | technician / labour (text) · street (text) · pole number (text) · work type (**select**: repair / replace / shift) |
| 14 | Road & Drain Construction | street / lane (text) · structure type (**select**: road / drain) · length (number, metres) |
| 15 | Grass Cutting | reporting officer (text) · area cut (number, sq metres) |
| 16 | Tree Pruning | vehicle (text) · team details (text) · street / lane (text) · number of trees (number) |
| 17 | Water Body Cleaning | team details (text) |

### Rulings on the client's lists, confirmed with them

- Grass Cutting listed geo-location twice; it appears once.
- Water Body's "Ward / nearby lane SUPERVISOR DASHBOARD / REPORTS" was a paste artifact. The client
  confirmed: **ward only**, no lane field.
- Tree Pruning's duplicate "3." was a numbering slip, not a missing field.
- Street Dog's list omitted geo-location. The client agreed to **keep it**: GPS is how a visit is
  verified as genuinely made, and excusing one service opens a hole. "Location of action" remains as
  its own text field.
- "Wet-dry quantity" became a **dropdown (wet / dry / mixed) plus a quantity number**, on the
  client's instruction for the dropdown and their approval of numbers-with-units.

### Units are a guess and are labelled as such

Waste in **kg**, area cut in **sq metres**, road/drain length in **metres**. The client has not
confirmed these with RMC. The unit is in the **key** as well as the label: `quantityKg`,
`lengthMetres`, `areaCutSqMetres`.

**A unit change is a new key, never a label edit.** A label is read from today's definition for
every row ever filed, and the stored version is deliberately ignored by the reader. Edit "Quantity
(kg)" to "Quantity (tonnes)" and every figure already filed in kilograms is shown as tonnes, with
nothing to say so. So when RMC corrects a unit: add a new key (`quantityTonnes`) with the new label,
and retire the old one. Rows filed under the old key keep it and are shown under it (the register
and the officer's list display a stored key the service no longer defines, under its raw key), so a
figure is never read in a unit it was not entered in. A test requires every labelled unit to appear
at the end of its key. What cannot be undone cheaply is storing free text where a number belonged,
which is why these are numbers.

### Required-ness

Every new field is **optional**. Date, ward, geo-location and description stay required as they are
today. A field officer standing in a street with partial information must still be able to file;
forcing a number invites an invented one. The consequence, stated plainly for piece 2: per-service
reporting will have holes wherever officers leave fields blank, and that is the better failure.
There is no `required` flag in the definitions: one was carried through both repos and the fixture
and honoured by neither the form nor the server, so it was removed. A field that must one day be
required needs the form and the server to enforce it in the same change.

## Non-goals

- **Photographs stay off.** Unchanged, at the client's instruction.
- **No reporting surface.** The dashboard's work-done tile and column are untouched by this piece;
  the client deferred that decision until officers are filing real visits.
- **The daily entry is untouched.** Dropping the eight field-work services from it is piece 3, on
  its own branch, so the client controls when it ships.
- No change to voiding, the visit register's existing columns, idempotency (`RequestId`,
  `Fingerprint`) or the officer's own visit list, beyond showing the new details.

## A sequencing risk that belongs in the handover, not the code

Piece 3 removes field work from the Anchal clerk's daily entry, moving it entirely to field
officers. As of this writing the client has not confirmed that RMC has supplied the officer roster,
and field officers could not log in to production at all because of the Vercel alias. **Shipping
piece 3 before officers are provisioned and able to log in means nobody reports field work: not the
clerk, not the officer.** The build is safe; the deploy is a decision with a precondition.

## Constraints that still hold

- Tailwind utilities only; no hand-written CSS rules.
- Every user-visible string is a paired literal `t(en, hi)`. Server strings match by exact string
  with a silent English fallback, so a new server message without a Hindi key renders in English
  with no error and no failing test.
- Hindi for the new labels, options and messages is **drafted, not settled** — it joins the twenty
  strings already waiting on RMC's reviewer.
- The visit form is **phone-first**: field officers use it in the street. Every new field must work
  at 390px in both scripts, with 44px touch targets.
- No new dependencies. Suites stay green: frontend 494, backend 426.
