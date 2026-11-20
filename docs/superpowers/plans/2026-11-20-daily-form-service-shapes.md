# Daily Form Service Shapes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each of the 25 services shows only the fields that make sense for it — 42 numbers a day instead of 225 — with no database migration and no audit snapshot version bump.

**Architecture:** Three form shapes derived from the Service Master's unit column. Only the counter shape participates in the pending balance. Six fields stop being collected but stay in the stored snapshot, so history is readable and corrections to pre-cutover entries still work.

**Tech Stack:** Frontend React 19 + Vite + TypeScript strict, zod 4, Vitest, Playwright. Backend .NET 10, EF Core 10 + Npgsql, xUnit.

**Spec:** `docs/superpowers/specs/2026-11-20-daily-form-service-shapes-design.md` (frontend repo)

**Repos:** frontend `CommissionerDashboard` branch `field-visit-module`; backend `backend-anchal` branch `field-visit-backend`. Neither repo has a trunk; these branches are what is deployed.

## Global Constraints

- `SchemaVersion` stays **1**. No field is removed from the snapshot and none changes meaning.
- No database migration. No change to `SaveSetupAsync`, `ToDto`, `InitialBalances.tsx`, or any locked office setup.
- The five count fields (`received`, `completed`, `slaWithinTime`, `complaintsReceived`, `complaintsResolved`, `fieldReceived`, `fieldCompleted`, `amountPaise`) must be sent as `0`, never `null` — the body is parsed with `JsonNumberHandling.Strict`. Only `avgDisposalDays` is nullable.
- `remarks` is always sent, as `""` when empty. `ValidateEntry` rejects null.
- No row is removed from `src/shared/services.json`. The commissioner's register indexes it positionally (`services[e.serviceId - 1]`).
- `expected` stays **25** in all five places. Service 12 remains in the form.
- The new zero-activity field is **appended** to `EntryInput` / `EntryDto` and is **not** named `isZeroActivity` (`MonitoringHttpAdapter.cs:40` strips a key of that name).
- `Balances` stays a triple. Its Complaints and Field components freeze; they are not removed.
- Service 12's kind is `grievance` and it takes the **counter shape** and **does** move the pending balance.

## Review Focus

1. A counter entry with a disposal and no avg-days value — rejected today by `MonitoringRules.cs:25`; must be accepted.
2. A revenue service filed every day for a month — the pending balance must not grow at all, and `Pending > 10` must never fire for services 2, 5, 6.
3. A correction to a field-work or revenue entry filed **before** the cutover — fields the new shape hides must keep their stored values, not be zeroed.
4. A hidden count field reaching the API as `null` — must be impossible; `blank()` seeds `NaN` today and `NaN` serializes to `null`.
5. Service 12 — must still move the pending balance after the change, or its whole history re-derives on the next read.

---

### Task 1: Shape predicates, agreeing across both repos

**Files:**
- Modify: `src/domain/service-kind.ts` (frontend)
- Modify: `src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs` (backend)
- Test: `tests/domain/service-kind.test.ts`, `tests/Anchal.Tests/CommissionerMonitoring/Domain/FieldWorkEntryRulesTests.cs`

**Interfaces:**
- Produces (frontend): `formShape(serviceId: number): "counter" | "revenue" | "fieldwork"` mapping `grievance → "counter"`; `movesPendingBalance(serviceId: number): boolean` equal to `formShape(id) === "counter"`
- Produces (backend): `MonitoringRules.FormShape(int serviceId)` returning an enum `MonitoringFormShape { Counter, Revenue, FieldWork }`; `MonitoringRules.MovesPendingBalance(int serviceId)`. `IsFieldWork` stays, expressed as `FormShape(id) == FieldWork`.

- [ ] **Step 1: Write the failing tests**

```ts
it("puts the grievance service on the counter shape", () => {
  expect(formShape(12)).toBe("counter");
  expect(movesPendingBalance(12)).toBe(true);
});
it("gives counter 14, revenue 3, fieldwork 8", () => {
  const n = (s: string) => services.filter((x) => formShape(x.id) === s).length;
  expect([n("counter"), n("revenue"), n("fieldwork")]).toEqual([14, 3, 8]);
});
it("moves the balance for exactly the counter shape", () => {
  expect(services.map((s) => s.id).filter(movesPendingBalance)).toEqual(
    [1, 3, 4, 7, 11, 12, 18, 19, 20, 21, 22, 23, 24, 25]);
});
```

```csharp
[Fact] public void GrievanceServiceTakesTheCounterShapeAndMovesTheBalance() {
    Assert.Equal(MonitoringFormShape.Counter, MonitoringRules.FormShape(12));
    Assert.True(MonitoringRules.MovesPendingBalance(12)); }

[Fact] public void ShapesCoverAllTwentyFiveServicesWithTheExpectedCounts() {
    var byShape = Enumerable.Range(1, 25).GroupBy(MonitoringRules.FormShape)
        .ToDictionary(g => g.Key, g => g.Count());
    Assert.Equal(14, byShape[MonitoringFormShape.Counter]);
    Assert.Equal(3, byShape[MonitoringFormShape.Revenue]);
    Assert.Equal(8, byShape[MonitoringFormShape.FieldWork]); }

[Fact] public void RevenueIsExactlyTheThreePaymentServices() =>
    Assert.Equal(new[] { 2, 5, 6 },
        Enumerable.Range(1, 25).Where(x => MonitoringRules.FormShape(x) == MonitoringFormShape.Revenue));
```

- [ ] **Step 2: Run both to verify they fail**

Run: `npx vitest run tests/domain/service-kind.test.ts` and `dotnet test Anchal.sln --filter "FieldWorkEntryRulesTests"`
Expected: FAIL — `formShape` and `FormShape` are not defined.

- [ ] **Step 3: Implement the frontend predicates in `src/domain/service-kind.ts`**

`formShape` maps the existing `ServiceKind` to the three shapes, `grievance → "counter"`. Keep `serviceKind` and `isFieldWork` exported; `isFieldWork` becomes `formShape(id) === "fieldwork"`.

- [ ] **Step 4: Implement the backend split in `MonitoringRules.cs`**

Replace the `FieldWorkServices` set with three sets, or one `Dictionary<int, MonitoringFormShape>`. Revenue is `[2, 5, 6]`; field work is the existing eight; everything else is counter. Add a comment naming `services.json` as the source and the drift risk.

- [ ] **Step 5: Run both to verify they pass**

Expected: PASS. Then `dotnet test Anchal.sln` and `npx vitest run` both fully green.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: three form shapes derived from the service master"
```

---

### Task 2: Delete the average-disposal-days rule

**Files:**
- Modify: `src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs:25`
- Modify: `src/domain/ledger.ts:67`, `src/domain/entry-rules.ts:34-36`
- Modify: `src/client/pages/DailyEntry.tsx` — remove the Avg Disposal Days field and its `required`/`*` markers
- Test: `FieldWorkEntryRulesTests.cs`, `tests/domain/entry-rules.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `avgDisposalDaysRequired` is **deleted**. Any caller must be removed in this task.

- [ ] **Step 1: Write the failing test**

```csharp
[Theory] [InlineData(1)] [InlineData(12)] [InlineData(25)]
public void ACounterEntryWithNoAverageDaysIsAccepted(int serviceId) {
    var entry = new EntryInput(serviceId, Today, "24", 5, 3, 0, 0, 0, 0, 0, 0, null, "");
    MonitoringRules.ValidateEntry(entry, Today); }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `dotnet test Anchal.sln --filter "ACounterEntryWithNoAverageDaysIsAccepted"`
Expected: FAIL with `MonitoringRuleException: Please correct the highlighted fields` — this is the blocker the second builder check found.

- [ ] **Step 3: Delete the rule in all three places**

Backend: remove the `input.Completed > 0 && input.AvgDisposalDays is null` clause, keeping the finite-and-in-range check for a value that *is* supplied (old entries and corrections still carry one). Frontend: the same clause in `ledger.ts`, and `avgDisposalDaysRequired` and its two JSX uses.

- [ ] **Step 4: Run the suites to verify they pass**

Expected: PASS, both suites fully green. Existing tests asserting the old rule must be deleted, not weakened — note each deletion in the commit body.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: stop requiring average disposal days, which no shape collects"
```

---

### Task 3: Revenue leaves the pending balance

**Files:**
- Modify: `src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs` (`Derive`)
- Modify: `src/domain/ledger.ts` (`applyActivity`)
- Test: `FieldWorkEntryRulesTests.cs`, `tests/domain/entry-rules.test.ts`

**Interfaces:**
- Consumes: `MovesPendingBalance` / `movesPendingBalance` from Task 1.

- [ ] **Step 1: Write the failing tests**

```csharp
[Theory] [InlineData(2)] [InlineData(5)] [InlineData(6)]
public void AMonthOfPaymentsDoesNotGrowThePendingBalance(int serviceId) {
    var entries = Enumerable.Range(1, 30).Select(d =>
        new EntryInput(serviceId, new(2026, 11, d), "24", 40, 0, 0, 500_00, 0, 0, 0, 0, null, ""));
    var derived = MonitoringRules.Derive(new Balances(0, 0, 0), entries);
    Assert.Equal(0, derived[^1].Closing.Service); }

[Fact] public void TheGrievanceServiceStillMovesTheBalance() {
    var entry = new EntryInput(12, Today, "24", 5, 2, 0, 0, 0, 0, 0, 0, null, "");
    Assert.Equal(3, Assert.Single(MonitoringRules.Derive(new Balances(0, 0, 0), [entry])).Closing.Service); }
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL — the first with a closing balance of 1200, the pending figure that would have grown forever.

- [ ] **Step 3: Replace the field-work check with the shape predicate**

`Derive` and `applyActivity` currently special-case field work. Both become `MovesPendingBalance(serviceId) ? received - completed : 0`.

- [ ] **Step 4: Run the suites to verify they pass**

Expected: PASS, both suites green.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: only counter work has a queue"
```

---

### Task 4: An explicit nothing-to-report flag

**Files:**
- Modify: `src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs` (`EntryInput`)
- Modify: `src/Anchal.Application/CommissionerMonitoring/DTOs/MonitoringDtos.cs` (`EntryDto`)
- Modify: `src/shared/types.ts` (`EntryInput`), `src/client/pages/DailyEntry.tsx` (the existing "Set zero activity" button at `:658-679`)
- Test: new `tests/Anchal.Tests/CommissionerMonitoring/Domain/NothingToReportTests.cs`, `tests/ui/daily-entry.test.tsx`

**Interfaces:**
- Produces: a field named `NothingToReport` / `nothingToReport`, **appended last** to both positional records, `bool` defaulting to `false`.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public void AnEntryFiledBeforeThisFieldExistedReadsAsFalse() {
    // A snapshot written by the old code: no nothingToReport property at all.
    var json = """{"serviceId":1,"serviceDate":"2026-11-01","ward":"24","received":0,"completed":0,
        "slaWithinTime":0,"amountPaise":0,"complaintsReceived":0,"complaintsResolved":0,
        "fieldReceived":0,"fieldCompleted":0,"avgDisposalDays":null,"remarks":""}""";
    var dto = JsonSerializer.Deserialize<EntryDto>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    Assert.False(dto.NothingToReport); }

[Fact] public void TheFlagSurvivesARoundTripThroughTheSnapshot() { /* save with true, read back true */ }
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL — `NothingToReport` is not a member.

- [ ] **Step 3: Append the field to both records and persist it**

Append to `EntryInput` and `EntryDto` so positional construction in the existing suite keeps compiling. Confirm the name is not `isZeroActivity` and that `MonitoringHttpAdapter` does not strip it.

- [ ] **Step 4: Wire the existing per-service button to set it**

The button already files a zero-activity entry; it now sets the flag too.

- [ ] **Step 5: Run the suites to verify they pass**

Expected: PASS, both suites green.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: record nothing-to-report as intent rather than inferring it from zeros"
```

---

### Task 5: The daily form draws three shapes

**Files:**
- Modify: `src/client/pages/DailyEntry.tsx`
- Modify: `src/client/i18n.tsx`
- Test: `tests/ui/daily-entry-shapes.test.tsx`

**Interfaces:**
- Consumes: `formShape` from Task 1.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing tests**

One test per shape, asserting the exact field set is present and the others are absent:

```tsx
it("shows a counter service two numbers", () => {
  renderFor(1);
  expect(labels()).toEqual(["Ward", "Received", "Disposed", "Remarks"]);
});
it("shows a revenue service payments and money", () => {
  renderFor(2);
  expect(labels()).toEqual(["Ward", "Payments", "Amount Collected (₹)", "Remarks"]);
});
it("labels work done per service", () => {
  renderFor(15); expect(labels()).toContain("Sites");
  renderFor(10); expect(labels()).toContain("Animals picked up");
});
it("sends zero, never null, for a field the shape hides", async () => {
  // submit a field-work entry; assert the request body has received: 0
});
// Review Focus 3. The correction path loads a saved entry into form state and
// resends it whole, so a hidden field must survive the round trip untouched.
it("keeps a pre-cutover entry's hidden values when correcting it", async () => {
  // saved field-work entry with received 7, completed 5, complaintsReceived 2
  renderFor(15, { saved: preCutoverEntry });
  await correctAndSubmit({ completed: 6 });
  expect(lastRequestBody().input).toMatchObject({
    received: 7, complaintsReceived: 2, completed: 6,
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL — all nine fields render for every service.

- [ ] **Step 3: Make the schema and the defaults shape-dependent**

`entryClientSchema` is built per shape, `blank()` seeds `0` for every field the shape hides (not `NaN`), and the `numeric` list is filtered by shape. Work-done labels: Trips 8, Animals picked up 10, Routes 9/17, Repairs 13, Works 14, Sites 15/16. `Payments` relabels `received` on the revenue shape. The opening and closing balance strips (`:372-391`, `:619-633`) show the service balance on the counter shape and nothing on the other two.

- [ ] **Step 4: Add the Hindi for every new label in `i18n.tsx`, and remove the retired validation strings**

- [ ] **Step 5: Run the suite and the typechecker**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: daily form shows only the fields its service uses"
```

---

### Task 6: Dashboard figures, server side

**Files:**
- Modify: `src/Anchal.Application/CommissionerMonitoring/Services/MonitoringService.cs` (`GetDashboardAsync`, review reasons)
- Modify: `src/Anchal.Application/CommissionerMonitoring/DTOs/MonitoringDtos.cs` (`MonitoringRowDto`)
- Test: `tests/Anchal.Tests/CommissionerMonitoring/Api/DashboardShapeTests.cs`

**Interfaces:**
- Consumes: `MovesPendingBalance`, `FormShape` from Task 1.
- Produces: `MonitoringRowDto.WorkDone` (long) — the sum of `completed` over field-work services in the filtered range. Task 7 consumes it.

- [ ] **Step 1: Write the failing tests**

```csharp
[Fact] public void PendingCountsOnlyTheCounterShape() { /* file revenue + field work + counter; assert pending is the counter figure alone */ }
[Fact] public void DisposalPercentageNeverExceedsOneHundred() { /* field work with received 0 must not inflate it */ }
[Fact] public void WorkDoneSumsTheFieldWorkServicesOnly() { }
[Fact] public void RetiredReviewReasonsNoLongerFire() { /* complaints pending, field tasks pending, SLA < 90% */ }
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL — pending includes all 25 services, and `WorkDone` does not exist.

- [ ] **Step 3: Filter the sums and the review reasons, and add `WorkDone`**

The `pending`, `received` and `completed` sums (`:225-235`) take counter-shape services only. Remove the three retired review reasons (`:243-245`) and scope `Pending > 10` (`:241`) to the counter shape. Leave the English literals of the surviving reasons byte-identical — `i18n.tsx` matches them exactly and falls back to English silently.

- [ ] **Step 4: Run the suite to verify it passes**

Run: `dotnet test Anchal.sln`
Expected: PASS, fully green.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: dashboard figures count only the shapes that have them"
```

---

### Task 7: Dashboard surfaces, client side

**Files:**
- Modify: `src/client/pages/Dashboard.tsx`, `src/shared/types.ts` (`MonitoringRow`), `src/client/i18n.tsx`
- Modify: `src/domain/ledger.ts` (the test-only `summarizePeriod` and its literal at `:117-132`, for the suite to typecheck)
- Test: `tests/ui/dashboard-shapes.test.tsx`

**Interfaces:**
- Consumes: `MonitoringRowDto.WorkDone` from Task 6, as `MonitoringRow.workDone`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("has no complaints, field-task or SLA tile", () => { /* assert absent */ });
it("shows work done for the period", () => { /* assert the tile and its value */ });
it("leaves opening pending blank for a revenue service in the register", () => { });
it("keeps the correction history labels for the retired fields", () => { /* audit.ts must still render an old entry's complaint correction */ });
it("states the date the form changed", () => { /* spec 7.6 */ });
```

- [ ] **Step 2: Run them to verify they fail**

Expected: FAIL — the three tiles are present and `workDone` is not a member.

- [ ] **Step 3: Add the dated line stating when the form changed**

Spec §7.6. One line on the dashboard, so that the drop in reported figures across the
cutover is explicable rather than looking like a drop in work. The date is the day this ships;
put it in one place both the English and Hindi strings read from.

- [ ] **Step 4: Remove the retired surfaces and add Work done**

Per the spec's §7.6 table: three tiles, three Anchal-table columns, six register columns. Column labels become per-shape. Register *Opening Pending* is blank for the 11 non-counter services. `src/client/audit.ts` is **unchanged** — old corrections must stay readable.

- [ ] **Step 5: Run the suite and the typechecker**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS and clean.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: dashboard drops the fields the form no longer collects"
```

---

### Task 8: All three shapes against a real backend

**Files:**
- Modify: `tests/browser/field-visit-live.spec.ts` (or a sibling `daily-form-live.spec.ts`)

**Interfaces:**
- Consumes: everything above.

Twice in this project a green unit suite has sat on top of a broken path — the 204 password response and the field-work balance rule — because the tests exercised the layer that changed rather than the path an office walks. This task is the gate against a third.

- [ ] **Step 1: Write the spec**

Behind `RMC_LIVE_BACKEND=1`, signed in as an office account, against a migrated database: file a counter entry with no avg days; file a revenue entry and assert pending does not move; file a field-work entry with no requests; use *Nothing to report* on a fourth service; then sign in as commissioner and assert the dashboard shows Work done and none of the retired tiles.

- [ ] **Step 2: Run it against the live stack and watch each assertion**

Run: Postgres, migrations, API on HTTPS (the session cookie is `SameSite=None`, so a plain-HTTP backend signs nobody in), Vite proxying to it, then
`RMC_LIVE_BACKEND=1 npx playwright test tests/browser/daily-form-live.spec.ts`
Expected: PASS. A pass on the first attempt is a finding about the spec — sabotage one rule, confirm RED, revert.

- [ ] **Step 3: Commit**

```bash
git commit -m "test: all three daily form shapes against a real backend"
```

## Done when

- `dotnet test Anchal.sln` and `npx vitest run` are green; `npx tsc --noEmit` is clean.
- The live spec passes against a migrated database.
- A counter entry files with no average-days value; a month of revenue entries leaves pending at its opening figure; a field-work entry files with no requests; service 12 still moves the balance.
- No migration was written and `SchemaVersion` is still 1.
