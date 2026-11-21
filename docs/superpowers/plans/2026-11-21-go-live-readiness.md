# Go-live readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the portal safe for six Anchal offices to start filing real entries, by closing every path that would otherwise become a data migration once production data exists.

**Architecture:** Six independent changes across two repositories. Five are code; the last is an operational checklist. None changes the shape of a stored snapshot, none adds a migration, and none changes how anything looks.

**Tech Stack:** React 19 / Vite / TypeScript / Vitest / Playwright (frontend `CommissionerDashboard`); .NET 10 / EF Core / Postgres / xUnit (backend `backend-anchal`).

**Spec:** `docs/superpowers/specs/2026-11-21-go-live-readiness-design.md`

## Global Constraints

- No EF migration, and `schemaVersion` stays `1`. Reads hard-throw on any other value (`MonitoringService.cs:386`).
- No change to the shape of a stored snapshot. `EntryInput.Ward` remains `string`.
- Canonical ward format is `Ward N`, N from 1 to 53. Neither repo holds a hand-written list of wards; both validate the format.
- Every user-visible string needs English and Hindi. Client labels are paired literals `t("English", "हिन्दी")`; server messages are translated by **exact match** in `src/client/i18n.tsx` and fall back silently to English, so a new server literal without a Hindi key is a defect.
- Services have three form shapes. Counter is 14 services — 1, 3, 4, 7, 11, **12**, 18–25; revenue is 2, 5, 6; field work is 8, 9, 10, 13, 14, 15, 16, 17. Use the predicates in `src/domain/service-kind.ts` and `MonitoringRules`, never a written-out id list.
- Suites that must stay green: backend `dotnet test Anchal.sln` with `ANCHAL_TEST_POSTGRES` set (309), frontend `npx vitest run` (230), `npx tsc --noEmit`, and `tests/browser/daily-form-live.spec.ts` after a reset (10).
- Nothing cosmetic. No restyling, no component changes, no layout changes beyond what a task names.

## Review Focus

- **A correction that sets a visible figure to zero.** Every preservation test lowers to 3, 2 or 4 and never to 0; the zero case is where a stored value gets destroyed.
- **A ward value that is not `Ward N`.** An entry filed by an older client, or by a direct API call, must be rejected rather than stored.
- **Ward 53 and Ward 1.** Off-by-one at both ends of the range, on both sides.
- **A field visit filed before this change**, read back after it. The removed flag must not break deserialization or the register row.
- **A dashboard response with no `updatedAt`.** The field is populated today, but an empty range or a failed read must not render "as of Invalid Date".

---

### Task 1: "Set zero activity" writes only what the shape collects

**Files:**
- Modify: `src/client/pages/DailyEntry.tsx` (the `Set zero activity` button handler)
- Test: `tests/ui/daily-entry-zero-activity.test.tsx` (create)

**Interfaces:**
- Consumes: `shownKeys(serviceId)` and `blank(date, serviceId)` as they exist in `DailyEntry.tsx`; `collects` from `src/domain/service-kind.ts`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Write the failing test**

```tsx
test("set zero activity leaves fields the shape does not collect as they were stored", async () => {
  // service 7 (counter), correcting an entry filed before the form was reduced
  const saved = { serviceId: 7, received: 9, completed: 4, slaWithinTime: 6,
    complaintsReceived: 12, complaintsResolved: 11, fieldReceived: 3, fieldCompleted: 2,
    avgDisposalDays: 4.5, amountPaise: 15000, ward: "Ward 11", remarks: "", nothingToReport: false };
  renderCorrection(saved);
  await user.click(screen.getByRole("button", { name: /Set zero activity/ }));
  const sent = await submitAndCapture();
  expect(sent.received).toBe(0);
  expect(sent.completed).toBe(0);
  expect(sent.slaWithinTime).toBe(6);
  expect(sent.complaintsReceived).toBe(12);
  expect(sent.complaintsResolved).toBe(11);
  expect(sent.fieldReceived).toBe(3);
  expect(sent.fieldCompleted).toBe(2);
  expect(sent.avgDisposalDays).toBe(4.5);
  expect(sent.amountPaise).toBe(15000);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/daily-entry-zero-activity.test.tsx`
Expected: FAIL — the retired figures come back as `0`, and `amountPaise` as `0`.

- [ ] **Step 3: Change the handler to zero only the shown keys**

In the button's `onClick`, build the next input from the **current** input rather than from `blank(...)`, setting `0` only for keys in `shownKeys(selected)` and setting `nothingToReport: true`. Leave `ward`, `remarks` and every unshown key untouched. The money field is only reset when the shape collects it.

- [ ] **Step 4: Run the test and the suite**

Run: `npx vitest run tests/ui/daily-entry-zero-activity.test.tsx && npx vitest run && npx tsc --noEmit`
Expected: PASS, 231 tests, `tsc` clean.

- [ ] **Step 5: Commit**

```bash
git add tests/ui/daily-entry-zero-activity.test.tsx src/client/pages/DailyEntry.tsx
git commit -m "fix: zero activity must not erase figures the form no longer shows"
```

---

### Task 2: Ward becomes a constrained value

**Files:**
- Modify: `src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs` (`ValidateEntry`, the ward clause)
- Modify: `src/client/pages/DailyEntry.tsx` (the ward input)
- Modify: `src/domain/entry-rules.ts` (the ward schema)
- Modify: `src/client/i18n.tsx` (Hindi for the new server message)
- Test: `tests/Anchal.Tests/CommissionerMonitoring/Domain/WardFormatTests.cs` (create)
- Test: `tests/domain/entry-rules.test.ts` (extend)

**Interfaces:**
- Produces: canonical ward format `Ward N`, 1 ≤ N ≤ 53, enforced on both sides. Task 5 does not depend on it; nothing else does.

- [ ] **Step 1: Write the failing server test**

```csharp
[Theory]
[InlineData("Ward 1")] [InlineData("Ward 53")] [InlineData("Ward 11")]
public void AWardInTheCanonicalFormatIsAccepted(string ward) { /* ValidateEntry does not throw */ }

[Theory]
[InlineData("Ward 0")] [InlineData("Ward 54")] [InlineData("ward 11")]
[InlineData("Ward 11, Konka")] [InlineData("11")] [InlineData("Ward")] [InlineData("")]
public void AWardOutsideTheCanonicalFormatIsRejected(string ward) { /* 422 with fieldErrors["ward"] */ }
```

The rejection message is exactly `Select a ward from 1 to 53` — the same literal the field-visit service already uses, so it already has a Hindi translation and no new key is needed.

- [ ] **Step 2: Run it and watch it fail**

Run: `dotnet test Anchal.sln --filter WardFormatTests`
Expected: FAIL — every rejection case is accepted, because the current rule only checks non-empty and length ≤ 200.

- [ ] **Step 3: Replace the ward clause in `ValidateEntry`**

Match `Ward <n>` exactly — one space, no leading zeros, 1 ≤ n ≤ 53 — and set `errors["ward"] = "Select a ward from 1 to 53"` otherwise. Do not introduce a list of ward names.

- [ ] **Step 4: Run the server test and suite**

Run: `ANCHAL_TEST_POSTGRES="Host=127.0.0.1;Port=5433;Username=postgres;Password=postgres" dotnet test Anchal.sln`
Expected: PASS. Any existing test using a free-text ward fixture is updated to `Ward 11`; name each one you change in the report.

- [ ] **Step 5: Write the failing client test**

In `tests/domain/entry-rules.test.ts`, assert the ward schema rejects `"Ward 54"`, `"11"` and `""`, and accepts `"Ward 1"` and `"Ward 53"`.

Run: `npx vitest run tests/domain/entry-rules.test.ts` — Expected: FAIL.

- [ ] **Step 6: Constrain the client schema and replace the input with a select**

Tighten the zod schema in `src/domain/entry-rules.ts` to the same format. In `DailyEntry.tsx` replace the ward text input with a `<select>` whose options are generated from the range 1–53 (`Array.from({ length: 53 }, (_, i) => \`Ward ${i + 1}\`)`), labelled `Ward · वार्ड`. The option text is the bare `Ward N`.

- [ ] **Step 7: Run everything**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS, `tsc` clean.

- [ ] **Step 8: Commit (both repos)**

```bash
# backend
git add src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs tests/Anchal.Tests/CommissionerMonitoring/Domain/WardFormatTests.cs
git commit -m "feat: a ward is one of 53, not free text"
# frontend
git add src/domain/entry-rules.ts src/client/pages/DailyEntry.tsx tests/domain/entry-rules.test.ts
git commit -m "feat: pick a ward instead of typing one"
```

---

### Task 3: Retire "verified on site"; show the coordinates instead

**Files:**
- Modify: `src/Anchal.Infrastructure/CommissionerMonitoring/Officers/MonitoringFieldVisitService.cs:73,199` (stop computing, stop returning)
- Modify: `src/Anchal.Application/CommissionerMonitoring/DTOs/MonitoringDtos.cs:50` (`FieldVisitDto`)
- Modify: `src/shared/types.ts` (`FieldVisit`)
- Modify: `src/client/pages/VisitRegister.tsx:213`, `src/client/pages/MyVisits.tsx:66`, `src/client/pages/FieldVisit.tsx:119`
- Test: `tests/Anchal.Tests/.../FieldVisitVerificationRemovedTests.cs` (create)
- Test: `tests/ui/visit-register.test.tsx` (extend)

**Interfaces:**
- Consumes: `latitude`, `longitude`, `accuracyMetres` already on `FieldVisitDto` and `FieldVisit`.
- Produces: `FieldVisitDto` without `VerifiedOnSite`. **The database column `VerifiedOnSite` stays** — no migration.

- [ ] **Step 1: Write the failing server test**

Assert three things: that a visit saved with a coarse reading (accuracy 400 m, captured 90 minutes ago) is accepted; that the returned DTO has no verification field; and that `Latitude`, `Longitude` and `AccuracyMetres` round-trip unchanged.

Then assert the case the Review Focus names: **a visit row written before this change — with `VerifiedOnSite` already set `true` in the database — still reads back cleanly**, returning its coordinates and omitting the flag. The column stays, so EF still maps it; this pins that the DTO change cannot break an existing row.

Run: `dotnet test Anchal.sln --filter FieldVisitVerificationRemoved` — Expected: FAIL to compile or FAIL on the DTO assertion.

- [ ] **Step 2: Remove the computation and the field**

Delete the `verified` computation and the accuracy/skew thresholds from `MonitoringFieldVisitService`, drop `VerifiedOnSite` from `FieldVisitDto` and from the projection at `:199`. Leave the entity property and the column in place.

- [ ] **Step 3: Write the failing client test**

In `tests/ui/visit-register.test.tsx`, assert a register row shows the coordinates to five decimal places and a link whose `href` is `https://maps.google.com/?q=23.37412,85.33891` and whose accessible name names the ward, and that no "unverified" wording appears anywhere in the row.

Run: `npx vitest run tests/ui/visit-register.test.tsx` — Expected: FAIL.

- [ ] **Step 4: Update the three client sites**

Remove the `verifiedOnSite` branches from `VisitRegister.tsx`, `MyVisits.tsx` and `FieldVisit.tsx`, drop the field from `FieldVisit` in `src/shared/types.ts`, and render coordinates plus the map link in the register row and in `MyVisits`. The link text is `Open in Google Maps` / `गूगल मैप्स में खोलें`; it opens in a new tab.

- [ ] **Step 5: Run both suites**

Run: `ANCHAL_TEST_POSTGRES=… dotnet test Anchal.sln` and `npx vitest run && npx tsc --noEmit`
Expected: PASS both.

- [ ] **Step 6: Commit (both repos)**

```bash
git commit -m "feat: store where a visit happened, not a verdict about it"
```

---

### Task 4: The phone header names the officer's role

**Files:**
- Modify: `src/client/components/AppShell.tsx:105`
- Test: `tests/ui/app-shell.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
test.each([
  ["office", "Anchal Office"],
  ["commissioner", "Commissioner Dashboard"],
  ["officer", "Field Visits"],
])("the phone header names the %s role", (role, heading) => { /* render, assert heading present */ });
```

Also assert the Hindi rendering of each, since the two existing strings are hardcoded English.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/app-shell.test.tsx`
Expected: FAIL on the officer case — it currently renders "Commissioner Dashboard".

- [ ] **Step 3: Give the header a label per role, in both languages**

Replace the two-way ternary with a per-role lookup using the existing `t(en, hi)` helper: `Anchal Office` / `अंचल कार्यालय`, `Commissioner Dashboard` / `आयुक्त डैशबोर्ड`, `Field Visits` / `क्षेत्रीय निरीक्षण`.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run && npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix: a field officer is not in the commissioner dashboard"
```

---

### Task 5: Say when the figures are from; stop retrying a feed that does not exist

**Files:**
- Modify: `src/client/pages/Dashboard.tsx:75` (remove the WebSocket subscription), plus the header area
- Modify: `src/shared/types.ts` (`Dashboard` gains `updatedAt: string` and `retrievedAt: string`)
- Test: `tests/ui/dashboard-as-of.test.tsx` (create)

**Interfaces:**
- Consumes: `updatedAt` and `retrievedAt`, already written onto the dashboard payload by `MonitoringHttpAdapter.cs:31`. **No backend change.**

- [ ] **Step 1: Write the failing test**

Assert that a dashboard response carrying `updatedAt` renders a visible "Figures as of <time>" line in both languages; that a response with a null `updatedAt` falls back to `retrievedAt` and never renders `Invalid Date`; and that no WebSocket is constructed during render.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/ui/dashboard-as-of.test.tsx`
Expected: FAIL — no such line is rendered, and a `WebSocket` is constructed.

- [ ] **Step 3: Remove the subscription and render the time**

Delete the `/api/live` WebSocket effect entirely. Add `updatedAt` and `retrievedAt` to the `Dashboard` type and render `Figures as of {time}` / `आंकड़े {time} तक` in the dashboard header, formatted in India Standard Time, falling back to `retrievedAt` when `updatedAt` is absent.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run && npx tsc --noEmit` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: the dashboard says when its figures are from"
```

---

### Task 6: Go-live operational checks

No code. This task is a checklist whose evidence is pasted into the report; it is the last thing done before the branches are deployed.

**Interfaces:** Consumes `/health`, already wired with a database check in `Program.cs:39-40` and excluded from the monitoring middleware at `:48`.

- [ ] **Step 1: Confirm the health endpoint answers on the production host**

Run: `curl -sS -o /dev/null -w '%{http_code}\n' https://<production-host>/health`
Expected: `200`. Record the host and the response.

- [ ] **Step 2: Confirm it fails when the database is unreachable**

Point a non-production instance at an unreachable database and call `/health` again.
Expected: a non-200 status. This is what makes the endpoint worth watching; record the status observed.

- [ ] **Step 3: Put an uptime check on it**

Any external checker, polling `/health` at one minute, alerting to a channel the maintainer actually reads. Record which service and which destination.

- [ ] **Step 4: Rehearse one restore**

Take a dump of the RSCCL production database, restore it into a scratch database, and confirm the audit-event row count and the office count match the source.
Expected: both counts equal. Record them. **A backup that has never been restored is not yet a backup.**

- [ ] **Step 5: Record the result**

Write the four outcomes into the report. If any step fails, the branches do not deploy until it passes.
