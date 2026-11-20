# Daily Form — Service-Specific Shapes

**Date:** 2026-11-20
**Project:** RMC Anchal Office Monitoring Portal (`CommissionerDashboard`, `backend-anchal`)
**Status:** Design, awaiting approval
**Extends:** `2026-10-05-anchal-entry-workflow-design.md`
**Revision:** third draft. Draft 1 was wrong about the storage model, about where a
work-done figure could live, and about revenue services. Draft 2 fixed those and was wrong
about two more things, both verified against the code: dropping Avg Disposal Days would have
made every counter entry fail validation, and service 12 is classified `grievance` by the
code this design says to use, not `counter`. Each draft was checked by a fresh implementer
who had not seen the conversation.

---

## 1. Intent and why

The daily entry form asks the same nine numbers for all 25 services, and most do not apply:
grass cutting is asked how much money it collected, holding tax payment how many field
tasks it completed. Offices answer with zeros or invented figures, and the register fills
with numbers nobody can act on.

The portal records **work officers did**. That one sentence decides most of what follows:
anything that tracks a citizen's complaint through to resolution belongs to a grievance
system, not here.

Two rules that made honest field entries impossible were fixed first, on 2026-11-20:
`c7cb7f4` and `780887e` on the backend, `be4cb60` and `6a7c87f` on the frontend. The second
pair matters to this design — field work no longer moves the pending balance, which is what
makes §7.2 possible without a migration.

## 2. Goals

- An office sees only the questions that make sense for the service it is reporting.
- Two numbers per service instead of nine; about 42 a day instead of 225.
- The grouping comes from the Service Master, not a list kept by hand.
- An office can say "nothing happened today" without typing zeros that read as data.
- No stored entry *input* changes. Derived balances are recomputed on read, so some
  historical closing figures for revenue and field work will change where an office did not
  type received = completed (§10).
- No database migration and no audit snapshot version bump.

## 3. Non-goals

- Grievance tracking. It leaves this form (§7.4).
- Changing the field visit module. It stays proof-of-visit and counts no output.
- Per-service SLA measurement. The fields go (§7.3); measuring timeliness is a later
  question if RMC ever supplies the standards.
- Retiring service 12 from the portal, re-opening a locked setup, or changing the Anchal,
  ward, date, backdating or correction paths.
- Re-entering history under the new shapes.

## 4. Anti-goals

- Fewer fields, but the same fabricated numbers in the ones that remain.
- A form that varies so much between services that an office cannot learn it.
- History that silently changes meaning.
- The same work counted both here and in the field visit module.
- A change that needs the six locked office setups to be redone.

## 5. Constraints

Checked against the code, not assumed:

- **Entries are versioned JSON snapshots.** The source of truth is
  `monitoring_audit_events.AfterJson`, read back by deserializing `EntryDto`
  (`MonitoringService.cs:340-342`, written at `:368-373`). `Snapshot()` hard-throws on any
  `SchemaVersion` other than 1 (`:379`), and every read — form, dashboard, register — goes
  through it. There is **no wide nine-column entry table**.
- **`monitoring_report_entries` is a projection**, up to three rows per entry discriminated
  by `Kind` (Service / Complaint / FieldTask), carrying only ReceivedCount, DisposedCount
  and ClosingBalance (`MonitoringEntities.cs:11`, mapping at `MonitoringService.cs:138-154`,
  `:357-366`). `AmountPaise`, `AvgDisposalDays`, `Remarks` and `Ward` have no relational
  columns at all.
- **Check constraints** `ck_monitoring_received_nonnegative`, `ck_monitoring_disposed_nonnegative`
  and `ck_monitoring_closing_nonnegative` (`CommissionerMonitoringDbContext.cs:146-148`).
- **`Balances` is a triple** `(Service, Complaints, Field)`, carried forward per service and
  persisted as locked opening balances.
- **Opening balances are locked.** `MonitoringOfficeSetup` is one-time per office;
  `SaveSetupAsync` demands exactly 25 balances and `ToDto` does `group.Single(x => x.Kind == Complaint)`
  and `== FieldTask`, throwing if either row is absent (`MonitoringService.cs:66-70`, `:333-338`).
  The frontend requires 25 three-part rows (`InitialBalances.tsx:35`).
- **The backend does have a service catalog** — `monitoring_catalog_items`, with Key, Name,
  SortOrder and `IsActive` (`MonitoringEntities.cs:7`), seeded from `ServiceNames` and served
  by `GetServicesAsync`. It has **no `unit` column**, so the shape cannot be derived there.
- **`services.json` is indexed positionally** in the commissioner's register
  (`Dashboard.tsx:483-484`, `services[e.serviceId - 1]`). Removing a row relabels every
  service above it.
- **`expected` is hardcoded 25** in five places: `DailyEntry.tsx:301,304,310`,
  `ledger.ts:143`, `MonitoringService.cs:239`, and is computed from the current constant for
  any period, past ones included. Service 12 staying (§7.1) means none of these change.
- **Most of `ledger.ts` is test-only.** `summarizePeriod`, `deriveEntryViews` and
  `validateEntry` are imported by no page; `DailyEntry.tsx:12` takes only `todayIST`,
  `parseMoney` and `applyActivity`, and `Dashboard.tsx` consumes the API. Rules duplicated
  there still have to be changed for the suite to pass, but changing them changes no
  behaviour.
- `src/domain/service-kind.ts` already classifies all 25 services from the `unit` column.

## 6. Approaches considered

**A. One record, fields shown per service — chosen.** The stored snapshot keeps its shape;
the form shows only the fields that service uses; the fields it does not use arrive as zero.
No migration, no `SchemaVersion` bump, no setup change, and old entries keep every value they
were filed with. Cost: the snapshot carries fields that most services always leave at zero,
and two of the three balances become permanently frozen rather than removed (§7.5).

**B. A record shape per kind.** Three snapshot shapes or a discriminated payload. Cleanest
model, worst cost: `SchemaVersion` must bump, every historical snapshot needs reading under
both versions, the projection's `Kind` discriminator changes, and `SaveSetupAsync` / `ToDto`
break for the six locked offices. Rejected — the data model is not what hurts; the form is.

**C. Keep nine fields, mark the irrelevant ones optional.** Rejected: the complaint was that
the fields are *there*, not that they are required.

The first draft of this design assumed a wide table and priced B against it. With the real
storage model, A costs almost nothing and B costs a migration of every entry ever filed.

## 7. Decisions

Settled with the client unless marked *[builder call]*.

### 7.1 Kind, shape, and balance are three different questions

`serviceKind()` already classifies all 25 services from the unit column, and it returns
**four** kinds, not three: `counter` 13, `revenue` 3, `fieldwork` 8, `grievance` 1 (service
12, whose unit is "Complaints"). `src/domain/service-kind.ts:22` maps it that way and
`tests/domain/service-kind.test.ts:19-27` pins it.

Draft 2 wrote a 14-service counter row and claimed it came from `serviceKind()`. It does
not, and the two cannot be reconciled by renaming: the kind says what a service *is*, which
is worth keeping, while the form needs to know which *shape* to draw. So this design adds
two derived predicates rather than changing the kinds *[builder call]*:

- `formShape(serviceId)` → `counter | revenue | fieldwork`, mapping `grievance → counter`
- `movesPendingBalance(serviceId)` → `formShape(serviceId) === "counter"`

| Shape | Kinds | Services | Fields shown | Moves pending balance |
|---|---|---|---|---|
| **Counter** | counter + grievance | 1, 3, 4, 7, 11, **12**, 18, 19, 20, 21, 22, 23, 24, 25 (14) | Received, Disposed | Yes |
| **Revenue** | revenue | 2, 5, 6 (3) | Payments, Amount ₹ | No |
| **Field work** | fieldwork | 8, 9, 10, 13, 14, 15, 16, 17 (8) | Work done | No |

**14 × 2 + 3 × 2 + 8 × 1 = 42 numbers a day**, against 225 today.

Service 12 (जन शिकायत) **stays in the form** on the counter shape: complaints received and
disposed read naturally as Received and Disposed, and it keeps moving the pending balance as
it does today. It keeps its id and its row in `services.json`, so `expected` stays 25, the
positional index at `Dashboard.tsx:483-484` is untouched, and history stays addressable and
correctable. Whether a grievance module later takes it over is out of scope (§9 OI-2).

Getting this wrong in either direction is costly: a predicate keyed on `kind === "counter"`
would take service 12 out of the balance math and silently re-derive its whole history,
because `Derive` runs at read time (`MonitoringService.cs:344-350`).

Opening Pending shows on the counter shape only in the form, non-editable, as today — but see
§7.6 for the register, which shows it for all 25.

Remarks stays on all three shapes and is optional to the user, but `ValidateEntry` rejects a
null (`MonitoringRules.cs:25`), so the client always sends `""`, never omits it.

### 7.2 Only counter work has a queue

Revenue and field work no longer move the pending balance. A payment is instant; grass is
cut. Neither is a case that waits.

This generalises the fix already made for field work (`780887e`, `6a7c87f`) to revenue, and
it is load-bearing: without it, `Payments` mapped onto `received` with no `completed` would
add to the pending balance on **every transaction**, permanently. The *Total pending* tile
would grow with collections, the "Pending > 10" review flag (`MonitoringService.cs:241`)
would fire for all three revenue services forever, and *Disposal %* (`:236`) would be diluted
by payments that complete nothing. Today this is masked only because offices type
received = completed.

One predicate decides it, in both repos: `movesPendingBalance()` from §7.1 — the counter
*shape*, which includes service 12, not the counter *kind*, which excludes it.

The backend has no revenue notion today; `MonitoringRules.cs:21` knows only
`FieldWorkServices`. It needs the same three-way split the frontend has, and the two must not
be allowed to drift (§8).

### 7.3 What leaves the form

Six fields stop being collected:

| Field | Why |
|---|---|
| Complaints Received | Grievance handling, not officer work |
| Complaints Resolved | Same |
| Field Tasks Received | Field output belongs on the 8 field-work services as Work done, not spread thinly across all 25 |
| Field Tasks Completed | Same |
| SLA Within Time | No per-service standard exists to measure against; all 25 rows of the Service Master read "as per notified service standard" |
| Avg Disposal Days | Same — nothing to compare an average to |

**Nothing is removed from the snapshot.** The fields stay in `EntryDto` and keep their stored
values on old entries. `SchemaVersion` stays 1 *[builder call: no field changes meaning and
none is removed, so a bump would buy nothing and would send every historical read through a
second path]*.

Two mechanical points that draft 2 got wrong:

- **The five count fields must be sent as `0`, never `null`.** The request body is read with
  `JsonNumberHandling.Strict` (`MonitoringHttpAdapter.cs:19,54-57`), so `null` into a `long`
  is a 422. Only `avgDisposalDays` is nullable. `blank()` seeds every count `NaN` today
  (`DailyEntry.tsx:50-59`), deliberately, so inputs render empty — and `NaN` serializes to
  JSON `null`. So `blank()` must seed `0` for any field the shape hides, and
  `entryClientSchema` (`DailyEntry.tsx:19-30`) must become shape-dependent: it currently
  requires all nine, so hiding a field without changing the schema produces "Please correct
  the highlighted fields" with nothing highlighted, because the error span renders inside a
  Field that no longer exists.
- **The Avg Disposal Days rule must be deleted, not exempted.** `ValidateEntry` currently
  fails any entry with `Completed > 0 && AvgDisposalDays is null` for a non-field-work
  service (`MonitoringRules.cs:25`). The counter shape has no avg-days input, so **every
  counter entry with a disposal would be rejected**. Verified: service 1 with Received 5,
  Disposed 3, AvgDisposalDays null throws today. The rule goes from three places —
  `MonitoringRules.cs:25`, `ledger.ts:67` (which has no field-work exemption at all and is
  already inconsistent with the server), and `entry-rules.ts:34-36` with its JSX in
  `DailyEntry.tsx:244,565-587`.

**Correcting a pre-cutover entry leaves hidden fields as they were stored** *[builder call]*.
The correction path loads the saved entry into form state and resends it whole
(`DailyEntry.tsx:193,445`), so the alternative — forcing the shape's defaults — would rewrite
a historical field-work entry's Received to 0 and change the register and the Disposal %
denominator. Only a new entry seeds `0` for hidden fields.

Dropping SLA Within Time and Avg Disposal Days was the client's call on 2026-11-20, against
the recommendation to keep them and chase RMC. The consequence is in §10.

### 7.4 Work done

`Work done` is the existing `completed` field, for field-work services only. No new column
and no migration — this is possible only because §7.2 takes those services out of the
balance math, which is what previously drove `completed` with no `received` to a negative
balance and a 422.

`received` is not shown for field-work services and is stored as `0` on new entries. On a
correction to an entry filed before the cutover it keeps whatever was stored (§7.3).

The label varies by service, the field does not *[builder call]*:

| Label | Services |
|---|---|
| Trips | 8 door-to-door vehicle |
| Routes | 9 fogging, 17 water bodies |
| Repairs | 13 street lighting |
| Works | 14 road and drain |
| Sites | 15 grass cutting, 16 tree pruning |
| Animals picked up | 10 street dog |

This is a hand-kept list, not derived — six of the eight do not match their unit word. It is
the one place this design keeps a list by hand, and it is wording rather than behaviour.
Service 10's label was settled with the client on 2026-11-20 as **Animals picked up**, since
no unit word fits dog control.

Field work records **work done only**. No requests field, on any of the eight, including
service 8 ("Requests / Trips") and 14 ("Works / Complaints") where the sheet names requests
— client decision, 2026-11-20. A request that produced no work is therefore not visible in
this form.

`Payments` on the revenue shape is the existing `received` field relabelled.

### 7.5 Balances and setup

`Balances` **stays a triple**. The Complaints and Field components stop being fed by anything
and freeze at their current values *[builder call: collapsing the triple to one number would
break `SaveSetupAsync`, `ToDto` and `InitialBalances.tsx` for the six offices whose setup is
already locked, which is a larger change than this one and buys only tidiness]*.

The projection keeps writing its Complaint and FieldTask rows, now always zero-delta, so the
`Kind` discriminator and every reader of it are untouched.

Locked opening balances keep their complaint and field rows, ignored. No office is asked to
set up again. The `InitialBalances` page still collects three kinds for 25 services; making
it collect one is a follow-up, not part of this.

A third thing freezes that draft 2 missed: the **Service** opening balance of the 11 revenue
and field-work services. It stops moving under §7.2 and keeps feeding the per-office pending
sum (`MonitoringService.cs:234`) until that loop is filtered to the counter shape — which is
why §7.6 lists *Total pending* as a server change rather than a label change.

### 7.6 The commissioner's dashboard

Every surface reading a dropped field changes, and all of them change for **every period,
past ones included**, so one dashboard means one thing (client decision, 2026-11-20).

Four of these are server-side — the figures are computed in `GetDashboardAsync`, not in the
page — and one needs a new field on the wire. Draft 2 listed them as if they were all UI:

| Surface | Change | Where |
|---|---|---|
| *Complaints pending* tile | Removed | client |
| *Within SLA* tile | Removed | client |
| *Field tasks pending* tile | Becomes **Work done this period** — a flow, not a closing balance | **new field on `MonitoringRowDto` and `MonitoringRow`**; neither carries one today |
| *Total pending* | Counter shape only | **server** — summed over all 25 balances at `MonitoringService.cs:229-235` |
| *Disposal %* | Counter shape only | **server** — `:225-226,236`. Not merely diluted: with §7.4 field work contributes `completed` against `received` 0, so the ratio can exceed 100% until the sums are split |
| Anchal-wise table: Complaints Pending, Field Tasks Pending, **SLA %** columns | Removed | client `Dashboard.tsx:338,340-341,360,362-363,393-394`, totals at `:115,129,141-143` |
| Entry register: **six** dropped-field columns — SLA Within Time (`:457/489`), Avg Days (`:463/495`) and the four complaint/field ones (`:459-462/491-494`) | Removed | client |
| Register *Opening Pending* column (`:454/486`) | Shows a frozen, meaningless figure for the 11 non-counter services; must be blank for them | client |
| Register and table column labels — "Received"/"Completed" (`:455-456`), "Requests / Transactions"/"Disposed / Completed" (`:334-335`) | Now mix payments, work done and disposals in one column; need per-shape or neutral wording | client |
| Review reasons "Complaints pending > 5", "Field tasks pending > 10", **"SLA < 90%"** | Removed | **server** `MonitoringService.cs:243-245`, mirrored `ledger.ts:169-175`, Hindi `i18n.tsx:21-25` |
| Review reason "Pending > 10" | Counter shape only | **server** `:241` |
| Service filter label "All 25 services" (`:278`) | Unchanged — service 12 stays | — |
| Correction-history labels for all six fields (`src/client/audit.ts:10-16`) | **Kept** — old entries keep their values and their corrections must stay readable | client |
| `DailyEntry` closing strip (`:619-633`) | Renders all three closing balances; same treatment as the opening strip | client |

**Review-reason strings are an undocumented cross-repo contract.** They travel as English
literals from `MonitoringService.cs:241-245` and are translated by exact key match in
`i18n.tsx:21-25`, falling back silently to English. Rewording "Pending > 10" to signal
counter-only breaks the Hindi translation without any error.

A dated line on the dashboard states when the form changed *[builder call: without it, the
drop in reported figures looks like a drop in work]*.

### 7.7 Nothing to report

The form **already has** a per-service "Set zero activity" button (`DailyEntry.tsx:658-679`),
and a zero-activity entry already counts toward the progress indicator, which counts stored
entries (`:300-304`). Draft 2 proposed a day-level action without knowing this, and justified
it with `MonitoringReport.IsZeroActivity` — which is derived at write time
(`MonitoringService.cs:157-158`), read nowhere in `src/`, and cannot tell an explicit "nothing
to report" from typed zeros. Both the premise and the justification were wrong.

So the only real gap is **distinguishability**, and the decision shrinks to one thing: the
existing per-service action records an explicit flag, so a deliberate "nothing happened" is
separable from an office typing zeros into every box.

The flag is a new **optional field appended to the snapshot record** *[builder call]*, absent
on every historical entry and read as false. Two constraints the implementer cannot guess:

- It must be **appended** to the positional record (`MonitoringRules.cs:4`), because
  reordering breaks every positional `new EntryInput(...)` in the test suite.
- It must **not** be named `isZeroActivity`. `MonitoringHttpAdapter.cs:40` explicitly skips a
  key of that name when flattening `input` onto the entry, so a field so named would be
  silently stripped from every response. Note also that the existing computed
  `EntryInput.IsZeroActivity` (`:5`) is taken over the eight counts, so once six of them are
  always zero it degenerates to `Received == 0 && Completed == 0 && AmountPaise == 0` while
  still feeding `MonitoringService.cs:158`.

A day-level "nothing to report for the whole office" is **deferred**, not designed here: every
entry requires a non-empty ward (`MonitoringRules.cs:25`), and a day-level filing has no
ward to send. Worth revisiting once the form is quieter and it is clear whether offices still
want it.

## 8. What is left to the builder

- Where the shape predicate lives so the two repos cannot disagree. Today each repo asserts
  the same literal in its own test with nothing linking them; §5's first draft claimed a
  cross-repo pin that does not exist. Options include generating the backend set from
  `services.json` at build time, or serving the kind from `GetServicesAsync` and having the
  frontend stop deriving it.
- How the form behaves when the office switches service mid-draft and the shape changes.
- The name and position of the explicit zero-activity field, within §7.7's two constraints.
- Whether `MonitoringRow` and the register keep typechecking under TS strict once members
  are removed, including the test-only literal at `ledger.ts:117-132`.
- Hindi for Trips, Routes, Repairs, Works, Sites, Payments, Work done, and removal of the
  Hindi strings for the retired validation messages (`i18n.tsx`).
- What the balance strip shows per shape — it currently renders all three openings for every
  service (`DailyEntry.tsx:372-391`) and a closing figure from `applyActivity` (`:243`).
- How *Work done this period* is aggregated and labelled.
- Test coverage consistent with the existing suite, including a browser test of each shape
  against a real backend — the stubbed and unit layers have twice now passed while the path
  an office walks was broken.

## 9. Open issues

| ID | Issue | Needed from | Blocks |
|---|---|---|---|
| OI-1 | **Whether service 12 eventually leaves the portal** for a grievance module, and whether the Grievance Monitoring sheet becomes one. | Client | Nothing here |
| OI-2 | **Per-service SLA standards**, if timeliness measurement is ever wanted again. The fields are being removed; restoring them later is cheap, the standards are what is missing. | RMC | Nothing here |

## 10. Risks

- **Some historical balances are recomputed, not just future ones.** `Derive` runs on every
  read (`MonitoringService.cs:344-350`) and the projection rows for a service's whole ledger
  are rewritten on its next save (`:138-156`). So taking revenue and field work out of the
  balance math changes their historical closing figures wherever an office did not type
  received = completed. Stored inputs are untouched; derived figures are not. Worth a query
  against the live data before cutover to see how many entries that affects.
- **Reported figures will fall sharply at the cutover**, because fabricated zeros and invented
  counts stop arriving, and because the SLA and average-days numbers disappear entirely.
  That is the intent, but across a trend line it reads as a fall in performance. §7.6's dated
  note is the mitigation; say it in the handover too.
- **Timeliness becomes unmeasurable.** Dropping Within SLA and Avg days removes the only
  signal the commissioner had about whether work is done on time. The numbers were
  unverifiable, so little is lost in accuracy — but nothing replaces them, and if RMC asks for
  timeliness reporting the answer is OI-3.
- **Two copies of the shape list.** Correcting this is §8's first item; until it is done, the
  backend set and `services.json` can diverge if someone edits a unit string and updates only
  the failing test.
- **Frozen balances are a trap for the next builder.** The Complaints and Field components of
  every balance, and the complaint and field rows of six locked setups, will sit there holding
  values nothing updates. Anyone building a re-setup path or reading balances must know.
- **Offices have learned the current form.** All three SOPs in `docs/sop/` and the 35
  screenshots describe the nine-field form and will need reissuing.
- **No trunk branch.** Neither repo has `main` on origin and the deployed branch is the feature
  branch, so this lands directly on what six offices use daily. The client accepted this on
  2026-11-20; it is recorded because it raises the cost of a mistake in this change
  specifically.
