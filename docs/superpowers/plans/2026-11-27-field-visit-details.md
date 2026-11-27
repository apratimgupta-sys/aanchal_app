# Per-service field visit details — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The eight field-work services each ask for their own fields on the field visit form, stored in one versioned JSON column.

**Architecture:** Per-service field definitions live in shared data, mirrored to the backend and guarded by the golden-fixture byte-identity mechanism built this week. `monitoring_field_visits` gains one nullable `DetailsJson` column carrying `{"v":1, …}`; the server validates the object against the definition and rejects unknown keys. A reader meeting an unknown version renders what it can and does **not** throw.

**Tech Stack:** React 19 / TS strict / Vitest / Tailwind (`/home/claude/work`); .NET 10 / EF Core / xUnit (`/home/claude/backend`).

**Spec:** `docs/superpowers/specs/2026-11-27-field-visit-details-design.md`

## Global Constraints

- **The definitions are a hand-maintained twin — the third in this project, after the shape tables and the service names, both of which diverged.** Mirror them into the backend and guard them with the existing golden-fixture mechanism: each repo asserts its own copy, so a one-sided edit reddens a test **in the repo where the edit was made**.
- **`DetailsJson` carries `{"v":1, …}` and an unknown version must never throw.** The daily entry's `Snapshot()` hard-throws on `SchemaVersion != 1`, which takes the screen down instead of degrading. Do not repeat it.
- **Every new field is optional.** Date, ward, geo-location and description stay required as they are today.
- **Photographs stay disabled.** No photo field is added or re-enabled.
- **Phone-first.** Field officers fill this form in the street: every new field works at 390px in both scripts, 44px touch targets, no horizontal page scroll.
- **Tailwind utilities only, no hand-written CSS rules.** `src/client/index.css` has zero rules; `theme.css` is token definitions only.
- Every user-visible string is a paired literal `t(en, hi)`; server strings match by exact string with a silent English fallback. All new Hindi is **drafted, not settled**.
- No new dependencies. Suites stay green: frontend 494, backend 426.
- The daily entry, the dashboard, voiding and idempotency (`RequestId`, `Fingerprint`) are untouched.

## Review Focus

- **A visit filed before this change has `DetailsJson` null.** It must open for viewing, appear in the register, and render without throwing. *(Task 2)*
- **A stored details object of an unknown version.** Must render what it can and be ignored beyond that — never throw. This is the explicit anti-lesson from the entry snapshot. *(Task 2)*
- **The service is switched after details are typed.** Stale values from the previous service must not be submitted. The daily entry shipped exactly this bug once — "files against the service on screen, not the one typed into first" is its regression test. *(Task 3)*
- **A server 422 naming a details key.** It must put a visible message on that field, never page-level with nothing highlighted. This project has shipped that dead end twice. *(Task 3)*
- **Unknown keys in a submitted details object.** Rejected server-side with an error that lands somewhere a person can see. *(Task 2)*

---

### Task 1: The field definitions, shared and guarded

**Files:**
- Create: `src/shared/field-visit-fields.json`
- Create: `src/domain/field-visit-fields.ts`
- Create: the backend mirror under `src/Anchal.Domain/CommissionerMonitoring/Rules/` and its copy of the fixture
- Test: `tests/domain/field-visit-fields.test.ts`, `tests/domain/shape-twin.test.ts` (extend), and the backend's twin test

**Interfaces:**
- Produces: `fieldsFor(serviceId: number): readonly VisitField[]` where `VisitField = { key: string; type: "text" | "textarea" | "number" | "select"; en: string; hi: string; options?: readonly { value: string; en: string; hi: string }[] }`. Returns `[]` for a service with no extra fields. Backend mirror exposes the same per-service key set and types for validation.

- [ ] **Step 1: Write the failing tests**

Assert `fieldsFor` returns, in order, the keys the spec's table lists for ids 8, 9, 10, 13, 14, 15, 16, 17; returns `[]` for a counter service such as 1 and for an unknown id; that every `select` field carries at least two options; that service 8's waste-type options are exactly `wet`, `dry`, `mixed`; that service 13's work-type options are exactly `repair`, `replace`, `shift`; that service 14's structure-type options are exactly `road`, `drain`; and that every field across all services has a non-empty `en` and `hi`.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/domain/field-visit-fields.test.ts`
Expected: FAIL — the module does not exist.

- [ ] **Step 3: Write the definitions and the reader**

Create `field-visit-fields.json` with the eight services' fields exactly as the spec's table lists them, units in the English and Hindi labels (`Area cut (sq metres)`, `Length (metres)`, `Quantity (kg)`). Draft Hindi for every label and option; report all of it as unsettled. Implement `fieldsFor` in `src/domain/field-visit-fields.ts`.

- [ ] **Step 4: Mirror to the backend and guard both copies**

Copy the definitions into the backend and extend the golden-fixture guard so each repo asserts its own copy against the fixture, as `serviceNames` already does. Reuse that mechanism; do not invent a second one.

- [ ] **Step 5: Mutation check**

Change one field key on one side only; confirm a test reddens **in that repo**. Change one option value; confirm a test reddens. Revert each, one at a time, and confirm the tree is clean. **Bound any mutation loop so it cannot outlive your belief about it** — one such loop already got a bad mutation committed this week.

- [ ] **Step 6: Run both suites and commit (one commit per repo)**

```
feat: per-service field definitions for the field visit form
```

---

### Task 2: Storage and validation

**Files:**
- Create: a migration adding `DetailsJson` to `monitoring_field_visits`
- Modify: `src/Anchal.Domain/CommissionerMonitoring/MonitoringEntities.cs`, `.../Persistence/CommissionerMonitoringDbContext.cs`, `.../Officers/MonitoringFieldVisitService.cs` (validation near line 164, persistence near line 70), the visit DTOs
- Modify: `src/shared/types.ts` — `FieldVisitInput` gains `details`
- Test: the backend's field-visit test suite

**Interfaces:**
- Consumes: Task 1's backend definitions.
- Produces: `FieldVisitInput.details: Record<string, string | number> | null`; stored as `{"v":1, …}`; returned on `StoredFieldVisit`/`FieldVisitView` as the same shape, or `null` for a row without details.

- [ ] **Step 1: Write the failing tests**

A visit on service 8 with valid details round-trips: stored with `"v":1` and read back with every key. A visit with **no** details is accepted and reads back `null` — covering both a new filing and every row that predates this column. A details object with a key the service does not define is **rejected** with a field error naming that key. A number field sent as a non-numeric string is rejected. A `select` field sent a value outside its options is rejected. A stored row whose JSON says `"v":2` is **read without throwing**, returning what it can. A visit on a service with no extra fields rejects a non-empty details object.

- [ ] **Step 2: Run and watch fail**

Run: `/home/claude/.dotnet/dotnet test` (from `/home/claude/backend`)
Expected: FAIL — no `DetailsJson`, no validation.

- [ ] **Step 3: Add the column**

Add `DetailsJson` as a nullable string on `MonitoringFieldVisit`, configure it in the context, and generate the migration. **This is the first migration in a while — check the two existing field-visit migrations for the established naming and style.** Do not alter any existing column.

- [ ] **Step 4: Validate against the definition**

In `MonitoringFieldVisitService`, validate the submitted details against Task 1's per-service definition: unknown keys rejected, `number` fields parsed as numbers within the same bounds the entry figures use, `select` values checked against their options, text lengths bounded. Field errors key on the field's own key so the form can show them. Persist as `{"v":1, …}`. On read, parse defensively: an unknown `v`, malformed JSON or an unexpected type yields what can be read and never throws.

- [ ] **Step 5: Run the suite, mutation-check, commit**

Mutation: accept an unknown key; confirm a test reddens. Make the reader throw on `"v":2`; confirm a test reddens. Revert each.

```
feat: a field visit stores its service's own details
```

---

### Task 3: The form asks for the service's own fields

**Files:**
- Modify: `src/client/pages/FieldVisit.tsx`
- Test: `tests/ui/field-visit.test.tsx`

**Interfaces:**
- Consumes: `fieldsFor` from Task 1; `FieldVisitInput.details` from Task 2.

- [ ] **Step 1: Write the failing tests**

Selecting service 8 renders its four fields with the right control types, and the waste-type select offers exactly wet/dry/mixed. Selecting service 1 renders no extra fields. The date label and the description label change per service (Pickup date / Work description for 8; Activity date / Outcome description for 10; Inspection date / Inspection description for 14). Filing sends `details` carrying only that service's keys. **Switching service after typing sends only the new service's keys** — the stale-value case from Review Focus. A server 422 naming a details key puts a **visible message on that field**, not page-level. Every new control is at least 44px and reachable by keyboard with visible focus.

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/ui/field-visit.test.tsx`
Expected: FAIL — no per-service fields rendered.

- [ ] **Step 3: Render the fields**

Render `fieldsFor(serviceId)` between the existing ward field and the description. Reset details state when the service changes — that reset is what the stale-value test pins. Give every field an error slot wired through `aria-describedby` and `aria-invalid`, the way the existing fields do. Add the per-service date and description labels in the style of the daily entry's work-done label table.

- [ ] **Step 4: Measure it at phone width**

Run real Chromium against the dev server at 390px and 320px, in English and Hindi, on the service with the most fields (8 or 16, both four fields plus the commons). Confirm no horizontal page scroll, no clipped label, no control under 44px, and that Devanagari matras and descenders are not cut. Report the measurements, not an impression.

- [ ] **Step 5: Run the suite and type check, mutation-check, commit**

Mutation: remove the service-change reset; confirm the stale-value test reddens. Remove a field's error slot; confirm the 422 test reddens. Revert each.

```
feat: the visit form asks each service for its own details
```

---

### Task 4: The register and the officer's list show the details

**Files:**
- Modify: `src/client/pages/VisitRegister.tsx`, `src/client/pages/MyVisits.tsx`
- Test: `tests/ui/visit-register.test.tsx`, `tests/ui/my-visits.test.tsx`

**Interfaces:**
- Consumes: `FieldVisitView.details` from Task 2; `fieldsFor` from Task 1.

- [ ] **Step 1: Write the failing tests**

A visit on service 8 shows its details, labelled, in both surfaces. A visit with `details: null` renders with no empty section and no placeholder clutter — the pre-change row from Review Focus. A details object holding a key the service no longer defines is shown rather than silently dropped, or dropped with a stated reason; assert whichever the implementation chooses. The register's existing columns, the officer filter and voiding are unchanged.

- [ ] **Step 2: Run and watch fail**

Run: `npx vitest run tests/ui/visit-register.test.tsx tests/ui/my-visits.test.tsx`
Expected: FAIL — details are not rendered.

- [ ] **Step 3: Render them**

Show the details as labelled values, using Task 1's definitions for the labels and order so a stored key and its label cannot drift apart. A row with no details shows nothing extra.

- [ ] **Step 4: Run the suite and type check, commit**

```
feat: a visit's own details show in the register and the officer's list
```
