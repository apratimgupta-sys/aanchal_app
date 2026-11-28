# Daily entry trim, visit scope and collection renames — implementation plan

> **For the executor:** work through the tasks in order, one at a time, using the subagent-driven-development or executing-plans workflow. Steps use checkbox (`- [ ]`) syntax. This plan is written to be followed without any knowledge of earlier conversations: everything you need is in this file. Where it gives exact text, use it exactly. Where reality does not match what a step says (a search string is missing, a number comes out different), **stop and report — do not improvise and do not change an expected value to make a test pass.**

**Goal:** Five client changes: (1) the field visit form offers only field-work services; (2) six services are hidden from the daily entry; (3) Community Hall Booking is removed from the daily entry; (4) the three collection services gain "Reporting" in their names; (5) the collections' "Payments" field is renamed "Number of Payments".

**Architecture:** Which services the clerk's daily entry collects is one predicate per repo (`dailyEntryCollects` / `MonitoringRules.DailyEntryCollects`). Today it means "not field work", derived from the form shape. This plan narrows it with a small named list of services withdrawn *by decision* (there is no property to derive them from), kept as data in exactly one place per repo and bound together by the golden twin fixture. Everything downstream — the entry list, its numbering, the dashboard filter, the expected-reports count — already derives from the predicate and follows automatically. The visit form gets the mirror-image predicate ("is field work").

**Tech stack:** Frontend: React 19, TypeScript strict, Vitest, Tailwind. Backend: .NET 10, EF Core, xUnit.

**Spec:** there is no separate spec. The section "Decisions already made" below is the specification.

---

## Read this first: the ground you are standing on

### The two repositories

| | Frontend | Backend |
|---|---|---|
| Path | `/home/claude/work` | `/home/claude/backend` |
| Branch | `ui-rebuild` | `role-manager` |
| Starting commit | `05e4b3a` | `115f9c5` |
| Starting test count | 671 passing | 556 passing |
| Run tests | `npx vitest run` (about 1 minute) | see below (about 7 minutes) |
| Type check | `npx tsc --noEmit` (silent = pass) | part of the build |

**Running the backend suite.** `dotnet` is not on PATH. The run takes 6–8 minutes and prints nothing until the end, so run it in the background and read the tail of a log file:

```bash
cd /home/claude/backend && /home/claude/.dotnet/dotnet test > /tmp/backend-test.log 2>&1; tail -3 /tmp/backend-test.log
```

Run that with the shell tool's background option (not a foreground call with a short timeout, and never a `sleep` loop). The line you want reads `Passed!  - Failed: 0, Passed: NNN`.

### The services (id, English name, form shape)

| id | name today | shape | on the daily entry after this plan? |
|---|---|---|---|
| 1 | New Holding Application Reporting (SAF) | counterRevenue | yes |
| 2 | Holding tax payment | revenue (a "collection") | yes, renamed |
| 3 | Municipal Trade Licence Application Reporting | counterRevenue | yes |
| 4 | New Water Connection Application Reporting | counterRevenue | yes |
| 5 | Water user charge payment | revenue (a "collection") | yes, renamed |
| 6 | Waste user charge payment | revenue (a "collection") | yes, renamed |
| 7 | Data Correction Application Reporting | counterRevenue | yes |
| 8, 9, 10, 13, 14, 15, 16, 17 | the eight field-work services | fieldwork | no (already off; they are filed as field visits) |
| 11 | Birth and Death Registration Reporting | counter | yes |
| 12 | Public Grievance Application Reporting | counter | yes |
| 18 | Pradhan Mantri Awas Yojana | counter | **no — hidden by this plan** |
| 19 | SSG Group | counter | **no — hidden** |
| 20 | Vendor licence | counter | **no — hidden** |
| 21 | PM SVANidhi licence | counter | **no — hidden** |
| 22 | Revolving fund | counter | **no — hidden** |
| 23 | Self employment programme | counter | **no — hidden** |
| 24 | Lodge/Hostel/Banquet Hall licence | counter | yes |
| 25 | Community hall booking | counter | **no — removed by this plan** |

After this plan the daily entry lists **10** services, in this order and numbering: counter work `01`=1, `02`=3, `03`=4, `04`=7, `05`=11, `06`=12, `07`=24; collections `08`=2, `09`=5, `10`=6.

### The golden twin fixture (the rule that has bitten this project three times)

Some facts must be identical in both repos. They are held in one JSON file committed **byte-identically** in both:

- `/home/claude/work/tests/domain/shape-twin.fixture.json`
- `/home/claude/backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json`

Each repo's tests compare its own source against its copy, and each repo also compares the two copies byte for byte when the other repo is checked out beside it (it is, here). So:

- **Always edit the frontend copy, then copy it over, then verify:**
  ```bash
  cp /home/claude/work/tests/domain/shape-twin.fixture.json /home/claude/backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json
  cmp /home/claude/work/tests/domain/shape-twin.fixture.json /home/claude/backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json && echo IDENTICAL
  ```
- Never hand-edit the backend copy.
- After any fixture edit, check it still parses: `python3 -c "import json;json.load(open('/home/claude/work/tests/domain/shape-twin.fixture.json'))" && echo VALID`.
- A service **name** lives in three places that must agree: `src/shared/services.json` (`name`, the Hindi name), the backend's `ServiceNames` array in `MonitoringProvisioner.cs`, and `serviceNames` in the fixture.

### Guards that will fail if you take a shortcut

- **Frontend `tests/domain/derive-dont-list.test.ts`** scans every `.ts`/`.tsx` under `src/` and fails if three or more of the service ids 8–25 appear as number literals near each other. **Do not write service ids as numbers in any file under `src/`.** Ids belong in JSON data files (not scanned) and in tests (not scanned).
- **Frontend `tests/domain/service-kind.test.ts`** fails if the body of `dailyEntryCollects` contains a digit or stops calling `formShape(`.
- **Backend `DailyEntryCollectsTests`** scans `src/**/*.cs` and fails if any statement other than two named ones lists four or more of the eight field-work ids.
- **Backend** has a test that fails if the expected-reports line in `MonitoringService.cs` (the one containing `? 1 : 0) : DailyEntryServiceCount`) contains a number literal. **Do not touch that line.**
- **Hindi keys.** A message the server sends is translated in the frontend by exact string match, with a silent fall-back to English. Every new server message in this plan gets a key in `src/client/i18n.tsx` *and* a row in the hand-kept list in `tests/ui/password-reset-midsession.test.tsx` (the `describe("the Hindi for server messages")` block).

### Rules for every task

- **Test first.** Write or change the test, run it, see it fail for the reason the step predicts, then change the code. If a new test passes before you change any code, say so in your report instead of presenting it as red-then-green.
- **Styling is Tailwind utility classes only.** Never add a CSS rule. `src/client/index.css` must keep zero rules.
- **Every user-visible string is a pair**: English and Hindi, as `t("English", "हिंदी")` or `text(...)`, matching the file you are in.
- **All Hindi in this plan is a draft awaiting the client's reviewer.** Use the exact strings given; in your final report list every Hindi string you added.
- **No new dependencies.** No database migration is needed anywhere in this plan; if you find yourself writing one, stop.
- **Commits:** one per task per repo, message exactly as the task gives. End each commit message with the attribution lines your session's system reminder gives at the time you commit; do not copy trailer lines from older commits. Run `git status` immediately before each commit and commit only files this plan told you to change.
- **Do not run mutation loops.** If you want to prove a test bites, break one thing by hand, run the one test file, restore it, and confirm with `git status` that the tree is clean before continuing.
- **Do not deploy anything.** This work is delivered as patches (Task 8); shipping is the user's decision.

---

## Decisions already made (do not re-decide; report disagreement instead)

1. **"Hidden" (18–23) and "removed" (25) behave identically in the product.** Neither is offered on the daily entry, the server refuses a daily entry for either, and neither feeds the dashboard's filter, counts or totals. They are kept as two separately named lists only so that un-hiding a hidden service later is a one-line data edit, while Community Hall Booking is recorded as gone for good.
2. **Withdrawn services stay in the service master.** Ids 1–25 remain valid everywhere (a database constraint depends on it), entries already filed against them stay stored, and their form shape does not change. An entry already filed for a withdrawn service can no longer be corrected by a clerk — the same rule already in force for field work.
3. **A list is correct here.** Field work is *derived* from the form shape. The withdrawn services have no shared property to derive from — they are a business decision — so they are listed, once per repo, in data, bound by the fixture.
4. **"Field work shows only field-work services" covers three things:** the visit form's Activity dropdown, the visit register's Activity filter, and the server, which refuses a *new* visit for any other service. Visits already filed for other services (one exists on staging, for service 1) stay stored and stay listed in the register.
5. **The two visit dropdowns are numbered 01–08 in list order**, not by service id. The client's earlier instruction for the daily entry was that numbers are not tied to service ids; showing `08, 09, 10, 13 …` would repeat the thing they asked to have removed.
6. **Collection names take Title Case with "Reporting" appended**, matching the six names renamed earlier: `Holding Tax Payment Reporting`, `Water User Charge Payment Reporting`, `Waste User Charge Payment Reporting`.
7. **The payments label is exactly `Number of Payments`.**
8. **Dashboard totals count only what the daily entry collects** when no service is pinned. Without this, the opening pending balance of a hidden service would sit inside "Total pending" forever, because nobody can file against it any more.
9. **Out of scope, on purpose:** the opening-balances screen still lists all 25 services, and photographs stay disabled. Do not change either.

---

## Review focus

The five conditions most likely to hurt a real user that are easy to miss. Each has a test in the task named.

- **A hidden service's opening balance inside "Total pending".** Unpinned totals must exclude it; pinned to that service its own history must still show. *(Task 2)*
- **An office that filed all ten remaining services** must read as fully filed (10 of 10), not 10 of 17. *(Task 2, Task 3)*
- **A daily entry POSTed directly for a hidden or removed service** (stale page, replayed request) must be refused by the server with a message naming only the service. *(Task 2)*
- **A visit already filed for a non-field-work service** must still appear in the register after the form stops offering that service. *(Task 4, Task 5)*
- **A rename landing on one side only.** The three collection names must change in `services.json`, in `ServiceNames`, and in the fixture in both repos, in one task. *(Task 6)*

---

### Task 0: Pre-flight

- [ ] **Step 1: Confirm both repos are where this plan expects**

```bash
cd /home/claude/work && git status --short && git log --oneline -1
cd /home/claude/backend && git status --short && git log --oneline -1
```

Expected: both working trees clean; frontend at `05e4b3a`, backend at `115f9c5`. If either differs, stop and report.

- [ ] **Step 2: Confirm both suites are green before you change anything**

Run `npx vitest run` and `npx tsc --noEmit` in the frontend (expect 671 passing, tsc silent) and the backend suite as described above (expect 556 passing). If either is not green, stop and report.

---

### Task 1: The fixture learns which services are withdrawn (both repos, data only)

**Files:**
- Modify: `/home/claude/work/tests/domain/shape-twin.fixture.json`
- Modify (by copying): `/home/claude/backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json`

**Produces:** fixture key `dailyEntryWithdrawn` = `{"hidden": [18, 19, 20, 21, 22, 23], "removed": [25]}`, which Tasks 2 and 3 assert against.

- [ ] **Step 1: Add the key to the frontend copy with this script** (it refuses to run if the file is not as expected)

```bash
cd /home/claude/work && python3 - <<'PY'
import pathlib
p = pathlib.Path('tests/domain/shape-twin.fixture.json')
t = p.read_text(encoding='utf-8')
anchor = '  "fieldVisitBounds"'
assert t.count(anchor) == 1, 'anchor not found exactly once'
assert 'dailyEntryWithdrawn' not in t, 'already added'
t = t.replace(anchor, '  "dailyEntryWithdrawn": {"hidden": [18, 19, 20, 21, 22, 23], "removed": [25]},\n' + anchor)
tail = 'the backend asserts MonitoringFieldVisitService.Details* against it."'
assert t.count(tail) == 1, 'comment tail not found exactly once'
t = t.replace(tail, 'the backend asserts MonitoringFieldVisitService.Details* against it. dailyEntryWithdrawn lists the services taken off the daily entry by decision rather than by shape (hidden ones may return, the removed one will not): the frontend asserts src/shared/daily-entry-withdrawn.json against it, the backend asserts MonitoringRules.HiddenFromDailyEntry and MonitoringRules.RemovedFromDailyEntry."')
p.write_text(t, encoding='utf-8')
print('ok')
PY
```

- [ ] **Step 2: Copy to the backend and verify** using the three commands in "The golden twin fixture" above. Expected: `IDENTICAL` and `VALID`.

- [ ] **Step 3: Run the frontend suite** — `npx vitest run`. Expected: still 671 passing (nothing reads the new key yet).

- [ ] **Step 4: Commit in each repo**

Frontend and backend, same message:

```
test: the golden fixture lists the services withdrawn from the daily entry
```

---

### Task 2: The server withdraws seven services from the daily entry (backend)

**Files:**
- Modify: `src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs`
- Modify: `src/Anchal.Application/CommissionerMonitoring/Services/MonitoringService.cs`
- Create: `tests/Anchal.Tests/CommissionerMonitoring/Domain/DailyEntryWithdrawnTests.cs`
- Modify: `tests/Anchal.Tests/CommissionerMonitoring/Application/DailyEntryFieldWorkTests.cs` and the existing tests listed in Step 6

**Produces:** `MonitoringRules.HiddenFromDailyEntry`, `MonitoringRules.RemovedFromDailyEntry` (public, read-only sets); `DailyEntryCollects` false for 18–23 and 25; `DailyEntryServiceCount` = 10; server message `This service is not reported on the daily entry`.

- [ ] **Step 1: Write the new rule tests**

Create `tests/Anchal.Tests/CommissionerMonitoring/Domain/DailyEntryWithdrawnTests.cs`. Copy the `using` lines and the `namespace` line from `DailyEntryCollectsTests.cs` in the same folder, add `using System.Text.Json;` if it is not there, then:

```csharp
/// Services 18-23 are hidden from the clerk's daily entry and 25 is removed from it. That is a decision,
/// not something derivable from a form shape, so it is a list: one in MonitoringRules, one in the frontend's
/// src/shared/daily-entry-withdrawn.json, both asserted against "dailyEntryWithdrawn" in the golden fixture.
public sealed class DailyEntryWithdrawnTests
{
    private static readonly DateOnly Today = new(2026, 11, 28);

    private static EntryInput Entry(int serviceId) =>
        new(serviceId, Today, "Ward 24", 0, 0, 0, 0, 0, 0, 0, 0, null, "");

    public static TheoryData<int> Withdrawn => new(18, 19, 20, 21, 22, 23, 25);

    [Theory]
    [MemberData(nameof(Withdrawn))]
    public void AnEntryForAWithdrawnServiceIsRefusedOnTheServiceAlone(int serviceId)
    {
        var error = Assert.Throws<MonitoringRuleException>(
            () => MonitoringRules.ValidateEntry(Entry(serviceId) with { Received = 5, Completed = 2 }, Today));

        Assert.Equal(422, error.Status);
        var only = Assert.Single(error.Error.FieldErrors!);
        Assert.Equal("serviceId", only.Key);
        Assert.Equal("This service is not reported on the daily entry", only.Value);
    }

    [Fact]
    public void AFieldWorkServiceKeepsItsOwnMessage()
    {
        var error = Assert.Throws<MonitoringRuleException>(
            () => MonitoringRules.ValidateEntry(Entry(8) with { Completed = 5 }, Today));

        Assert.Equal("Field work is reported by field officers, not on the daily entry",
            error.Error.FieldErrors!["serviceId"]);
    }

    [Fact]
    public void TheDailyEntryCollectsExactlyTheTen()
    {
        var collected = Enumerable.Range(1, MonitoringRules.ServiceCount)
            .Where(MonitoringRules.DailyEntryCollects).ToArray();

        Assert.Equal(new[] { 1, 2, 3, 4, 5, 6, 7, 11, 12, 24 }, collected);
        Assert.Equal(10, MonitoringRules.DailyEntryServiceCount);
    }

    [Theory]
    [MemberData(nameof(Withdrawn))]
    public void AWithdrawnServiceKeepsItsCounterShape(int serviceId)
    {
        Assert.Equal(MonitoringFormShape.Counter, MonitoringRules.FormShape(serviceId));
        Assert.True(MonitoringRules.MovesPendingBalance(serviceId));
    }

    [Fact]
    public void TheWithdrawnSetsMatchTheGoldenTwinFixture()
    {
        using var doc = JsonDocument.Parse(
            File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "shape-twin.fixture.json")));
        var golden = doc.RootElement.GetProperty("dailyEntryWithdrawn");
        int[] Ids(string key) => golden.GetProperty(key).EnumerateArray().Select(x => x.GetInt32()).ToArray();

        Assert.Equal(Ids("hidden"), MonitoringRules.HiddenFromDailyEntry.Order().ToArray());
        Assert.Equal(Ids("removed"), MonitoringRules.RemovedFromDailyEntry.Order().ToArray());
    }
}
```

- [ ] **Step 2: Write the dashboard tests**

In `tests/Anchal.Tests/CommissionerMonitoring/Application/DailyEntryFieldWorkTests.cs`:

(a) Give the nested `Fixture.Create` an optional opening balance. Change its signature from `public static async Task<Fixture> Create()` to `public static async Task<Fixture> Create(Func<int, long>? opening = null)`, and inside it change `new OpeningBalanceDto(x, new(0, 0, 0))` to `new OpeningBalanceDto(x, new(opening?.Invoke(x) ?? 0, 0, 0))`.

(b) Add these two tests to the class (anywhere above the `Fixture` class):

```csharp
    /// A hidden service still has an opening balance and may have old entries. Nobody can file against it any
    /// more, so if they stayed in the unpinned figures they would sit in "Total pending" forever.
    [Fact]
    public async Task AWithdrawnServicesHistoryAndOpeningBalanceStayOutOfTheUnpinnedFigures()
    {
        await using var f = await Fixture.Create(opening: id => id == 20 ? 40 : 0);
        f.SeedPreCutover(Input(20, Day1, received: 6, completed: 1));
        await f.Db.SaveChangesAsync();
        Assert.True((await f.Save(Input(11, Day1, received: 5, completed: 2))).IsSuccess);

        var row = (await f.Service.GetDashboardAsync(f.Commissioner, new PeriodFilter(Day1, Day1))).Value!.Data.Rows.Single();

        Assert.Equal(5, row.Received);
        Assert.Equal(2, row.Completed);
        Assert.Equal(3, row.Pending);
        Assert.Equal(1, row.Submitted);
        Assert.Equal(10, row.Expected);
    }

    /// Pinned to the hidden service, its own history is still shown and nothing is due for it.
    [Fact]
    public async Task PinnedToAWithdrawnServiceItsOwnHistoryShowsAndNothingIsDue()
    {
        await using var f = await Fixture.Create(opening: id => id == 20 ? 40 : 0);
        f.SeedPreCutover(Input(20, Day1, received: 6, completed: 1));
        await f.Db.SaveChangesAsync();

        var row = (await f.Service.GetDashboardAsync(f.Commissioner, new PeriodFilter(Day1, Day1, null, 20))).Value!.Data.Rows.Single();

        Assert.Equal(6, row.Received);
        Assert.Equal(1, row.Completed);
        Assert.Equal(45, row.Pending);
        Assert.Equal(1, row.Submitted);
        Assert.Equal(0, row.Expected);
    }
```

(The row type is `MonitoringRowDto`; its properties are `Received`, `Completed`, `Pending`, `Submitted`, `Expected`. `45` is the opening 40 plus 6 received minus 1 completed.)

- [ ] **Step 3: Run the backend suite and watch the new tests fail**

Expected: the build fails first, because `HiddenFromDailyEntry` and `RemovedFromDailyEntry` do not exist. That is the predicted failure.

- [ ] **Step 4: Change the rule** in `MonitoringRules.cs` with this script

```bash
cd /home/claude/backend && python3 - <<'PY'
import pathlib
p = pathlib.Path('src/Anchal.Domain/CommissionerMonitoring/Rules/MonitoringRules.cs')
t = p.read_text(encoding='utf-8')

a = 'public const int ServiceCount = 25;'
assert t.count(a) == 1
t = t.replace(a, a + '''

    // Services taken off the clerk's daily entry by decision, not by shape. A hidden one may return: delete its
    // id here, in the frontend's src/shared/daily-entry-withdrawn.json and in the golden fixture, together. The
    // removed one will not. They stay in the Service Master (ids 1 to ServiceCount remain valid everywhere) and
    // keep their counter shape, so entries already filed against them stay readable.
    // TWIN: src/shared/daily-entry-withdrawn.json in the frontend repo. Both sides are asserted against
    // "dailyEntryWithdrawn" in shape-twin.fixture.json.
    public static readonly IReadOnlySet<int> HiddenFromDailyEntry = new HashSet<int> { 18, 19, 20, 21, 22, 23 };
    public static readonly IReadOnlySet<int> RemovedFromDailyEntry = new HashSet<int> { 25 };''')

b = 'public static bool DailyEntryCollects(int serviceId) => !IsFieldWork(serviceId);'
assert t.count(b) == 1
t = t.replace(b, '''public static bool DailyEntryCollects(int serviceId) =>
        !IsFieldWork(serviceId) && !HiddenFromDailyEntry.Contains(serviceId) && !RemovedFromDailyEntry.Contains(serviceId);''')

c = 'else if (!DailyEntryCollects(input.ServiceId)) errors["serviceId"] = "Field work is reported by field officers, not on the daily entry";'
assert t.count(c) == 1
t = t.replace(c, 'else if (IsFieldWork(input.ServiceId)) errors["serviceId"] = "Field work is reported by field officers, not on the daily entry"; else if (!DailyEntryCollects(input.ServiceId)) errors["serviceId"] = "This service is not reported on the daily entry";')

p.write_text(t, encoding='utf-8')
print('ok')
PY
```

Then, by hand, update the comment directly above `DailyEntryCollects` so it is true: it currently says the rule is "derived from the form shape, never listed". Make it say that field work is derived from the shape and that the withdrawn services are the two sets above.

- [ ] **Step 5: Change the dashboard roll-up** in `MonitoringService.cs` with this script

```bash
cd /home/claude/backend && python3 - <<'PY'
import pathlib
p = pathlib.Path('src/Anchal.Application/CommissionerMonitoring/Services/MonitoringService.cs')
t = p.read_text(encoding='utf-8')

a = 'var counter = period.Where(x => MonitoringRules.MovesPendingBalance(x.Input.ServiceId)).ToArray();'
assert t.count(a) == 1
t = t.replace(a, '''// Unpinned, a figure covers only what the daily entry collects: a withdrawn service's old entries and
            // opening balance would otherwise sit in the totals forever, with nobody able to file against them.
            // Pinned to one service, that service's own history is shown whatever it is.
            bool Counts(int serviceId) => filter.ServiceId.HasValue || MonitoringRules.DailyEntryCollects(serviceId);
            var counter = period.Where(x => MonitoringRules.MovesPendingBalance(x.Input.ServiceId) && Counts(x.Input.ServiceId)).ToArray();''')

b = 'if (MonitoringRules.MovesPendingBalance(balance.ServiceId)) pending += closing.Service;'
assert t.count(b) == 1
t = t.replace(b, 'if (MonitoringRules.MovesPendingBalance(balance.ServiceId) && Counts(balance.ServiceId)) pending += closing.Service;')

c = 'period.Sum(x => x.Input.AmountPaise), complaints, field, period.Count(x => filter.ServiceId.HasValue || DailyEntryCollects(x.Input.ServiceId)), expected, true, reasons, workDone));'
assert t.count(c) == 1
t = t.replace(c, 'period.Where(x => Counts(x.Input.ServiceId)).Sum(x => x.Input.AmountPaise), complaints, field, period.Count(x => Counts(x.Input.ServiceId)), expected, true, reasons, workDone));')

p.write_text(t, encoding='utf-8')
print('ok')
PY
```

Do not touch the line that computes `expected`.

- [ ] **Step 6: Update the existing tests that encode the old count of 17**

These are known to need changing. For each, change only what is listed.

| File | Around line | Change |
|---|---|---|
| `Domain/DailyEntryCollectsTests.cs` | 16 | `Collected` becomes `new(1, 2, 3, 4, 5, 6, 7, 11, 12, 24)` |
| `Domain/DailyEntryCollectsTests.cs` | 48–55 | in `TheDailyEntryCollectsExactlyTheServicesThatAreNotFieldWork`: rename it `TheDailyEntryCollectsNoFieldWorkAndNoWithdrawnService`, change the expected array to `{ 1, 2, 3, 4, 5, 6, 7, 11, 12, 24 }`, keep the `Assert.All` line |
| `Domain/DailyEntryCollectsTests.cs` | 58–60 | rename `TheCountIsSeventeenAndIsTheCountOfThePredicate` to `TheCountIsTenAndIsTheCountOfThePredicate`; `17` → `10` |
| `Domain/DailyEntryCollectsTests.cs` | 6–7 | the class comment says the rule is "never listed … every service that is not field work"; make it say field work is derived and the withdrawn services are listed in `MonitoringRules` |
| `Application/DailyEntryFieldWorkTests.cs` | 42 | `[InlineData(20)]` → `[InlineData(24)]` |
| `Application/DailyEntryFieldWorkTests.cs` | 120–127 | rename to `UnpinnedExpectedIsTenReportsPerDayAndPinnedIsOne`; `3 * 17` → `3 * 10` |
| `Application/MonitoringServiceTests.cs` | 457 | `3 * 17` → `3 * 10` |

Then run the suite. Any further failure will be a test that validates or saves a daily entry for service 18, 19, 20, 21, 22, 23 or 25 and expects it to be accepted (known places: `Domain/FieldWorkEntryRulesTests.cs` around lines 24, 58 and 179; `Domain/HiddenFieldCrossRuleTests.cs` around line 101). Fix each by this rule and no other:

- a single id 18–23 or 25 used as "a plain counter service" → use **24** (same shape, still on the daily entry);
- a list of ids that includes them → remove 18, 19, 20, 21, 22, 23 and 25 from the list;
- a comment that says "17" or "seventeen" about the daily entry → make it say ten.

Do not weaken any assertion. If a failure does not fit this rule, stop and report it.

- [ ] **Step 7: Run the full backend suite**

Expected: all passing, 0 failed. The count will be higher than 556 by the tests you added (the new file contributes 17 cases; the two dashboard tests add 2).

If `PinnedToAWithdrawnServiceItsOwnHistoryShowsAndNothingIsDue` reports a pending other than 45, or the unpinned test reports figures other than 5 / 2 / 3 / 1 / 10, **stop and report the actual numbers.** Do not edit the expectation.

- [ ] **Step 8: Commit** (backend)

```
feat: six services are hidden from the daily entry and community hall is removed
```

---

### Task 3: The frontend withdraws the same seven services

**Files:**
- Create: `src/shared/daily-entry-withdrawn.json`
- Modify: `src/domain/service-kind.ts`
- Modify: `src/client/pages/Dashboard.tsx` (one line)
- Modify: `src/client/i18n.tsx`
- Modify tests: `tests/domain/service-kind.test.ts`, `tests/domain/shape-twin.test.ts`, `tests/ui/service-position.ts`, `tests/ui/daily-entry-groups.test.tsx`, `tests/ui/dashboard-shapes.test.tsx`, `tests/ui/password-reset-midsession.test.tsx`

**Consumes:** fixture key `dailyEntryWithdrawn` (Task 1); server message from Task 2.
**Produces:** `dailyEntryCollects(id)` false for 18–23 and 25. `DailyEntry.tsx` and the dashboard filter need **no edit**: both build their lists from `dailyEntryCollects` already.

- [ ] **Step 1: Update the hand-written oracle** `tests/ui/service-position.ts`

Replace the `POSITION` table, and the two exported lists, with:

```ts
const POSITION: Record<number, number> = {
  1: 1, 3: 2, 4: 3, 7: 4, 11: 5, 12: 6, 24: 7,
  2: 8, 5: 9, 6: 10,
};
```

```ts
export const OFFERED_IDS: readonly number[] = [1, 3, 4, 7, 11, 12, 24, 2, 5, 6];
// The eight that are reported as visits instead.
export const FIELD_WORK_IDS: readonly number[] = [8, 9, 10, 13, 14, 15, 16, 17];
// Hidden from the daily entry (18-23) or removed from it (25), by the client's decision.
export const WITHDRAWN_IDS: readonly number[] = [18, 19, 20, 21, 22, 23, 25];
```

Update the comments in that file that say "01 to 17" to say "01 to 10". This file is written by hand on purpose: type these numbers from this plan, do not generate them from the app.

- [ ] **Step 2: Update the tests**

`tests/domain/service-kind.test.ts`, in `describe("which services the daily entry collects")`, replace the first test (`collects the seventeen that are not field work`) with these three:

```ts
  it("collects the ten left on the daily entry", () => {
    const found = services.map((s) => s.id).filter(dailyEntryCollects);
    expect(found).toEqual([1, 2, 3, 4, 5, 6, 7, 11, 12, 24]);
  });

  it("does not collect the six hidden services or the removed one", () => {
    for (const id of [18, 19, 20, 21, 22, 23, 25]) expect(dailyEntryCollects(id), `service ${id}`).toBe(false);
  });

  it("leaves a withdrawn service its counter shape, so a filed entry stays readable", () => {
    for (const id of [18, 19, 20, 21, 22, 23, 25]) {
      expect(formShape(id)).toBe("counter");
      expect(collectedFields(id)).toEqual(["received", "completed"]);
    }
  });
```

`tests/domain/shape-twin.test.ts`: add the import `import withdrawn from "../../src/shared/daily-entry-withdrawn.json";` beside the other JSON imports, and add this test inside `describe("the shape tables against the golden twin table")`:

```ts
  it("holds the services withdrawn from the daily entry exactly as daily-entry-withdrawn.json does", () => {
    expect(withdrawn).toEqual(fixture.dailyEntryWithdrawn);
  });
```

`tests/ui/daily-entry-groups.test.tsx`:
- the test `numbers the list 01 to 17…`: title → `01 to 10`, `length: 17` → `length: 10`;
- the test `offers exactly the seventeen services…`: title → `the ten services`;
- the test `states the register's size as 17`: title and regex → `10` (`/10$/`);
- the test `shows service 2 as 15…`: title → `as 08`; `/^15(?!\d)/` → `/^08(?!\d)/`; `/^SERVICE 15 ·/` → `/^SERVICE 08 ·/`. Leave the heading name and the payments label alone; Task 6 changes those.
- add, after `offers none of the eight field-work services` (import `WITHDRAWN_IDS` from `./service-position` alongside the existing imports):

```ts
  it("offers none of the hidden or removed services", async () => {
    await renderForm();
    const shown = rows().map((b) => b.textContent!);
    for (const id of WITHDRAWN_IDS) {
      const name = services.find((s) => s.id === id)!.en;
      expect(shown.some((t) => t.includes(name)), `service ${id}`).toBe(false);
    }
  });
```

`tests/ui/dashboard-shapes.test.tsx`:
- around line 342: `"across 14 services with a pending balance"` → `"across 7 services with a pending balance"` (line 343, `7 services that collect an amount`, stays);
- around lines 372–392: `seventeen` → `ten` in the title, `toHaveLength(17)` → `toHaveLength(10)`, `"All 17 services"` → `"All 10 services"`, `"सभी 17 सेवाएँ"` → `"सभी 10 सेवाएँ"`;
- around lines 399–457: these rows are mocked server values. Change `17` to `10` wherever it means the daily entry's size (`submitted: 17, expected: 17` → `10`, `"17 / 17"` → `"10 / 10"`, and in comments `17 a day = 68` → `10 a day = 40` with the matching numbers in that test's mock and assertions).

`tests/ui/password-reset-midsession.test.tsx`: in the `it.each([...])` list under `describe("the Hindi for server messages")`, add the row `"This service is not reported on the daily entry",`.

- [ ] **Step 3: Run and watch them fail**

Run: `npx vitest run`
Expected failures: the import of `daily-entry-withdrawn.json` does not resolve; the ten-services assertions find seventeen; the Hindi key is missing.

- [ ] **Step 4: Add the data file** `src/shared/daily-entry-withdrawn.json`, exactly:

```json
{"hidden": [18, 19, 20, 21, 22, 23], "removed": [25]}
```

- [ ] **Step 5: Narrow the predicate** in `src/domain/service-kind.ts`

Add this import directly under the existing first line (the `services.json` import). The `with { type: "json" }` part is required:

```ts
import withdrawn from "../shared/daily-entry-withdrawn.json" with { type: "json" };
```

Replace the whole `dailyEntryCollects` function **and the comment block above it** with:

```ts
// Services taken off the daily entry by the client's decision rather than by
// shape: six hidden (they may return) and one removed. There is nothing to
// derive them from, so they are data, kept in one file and never spelled out in
// code. Mirrors MonitoringRules.HiddenFromDailyEntry / RemovedFromDailyEntry on
// the server; both sides are asserted against "dailyEntryWithdrawn" in
// tests/domain/shape-twin.fixture.json.
const WITHDRAWN: ReadonlySet<number> = new Set<number>([...withdrawn.hidden, ...withdrawn.removed]);

// Whether the daily entry collects this service at all. The field-work services
// are reported by field officers as visits (derived from the shape, never from
// a list of ids), and the withdrawn services above are off the entry by
// decision. Mirrors MonitoringRules.DailyEntryCollects on the server. Every
// service stays in the master and keeps its shape, so entries already filed
// stay readable; this narrows what the entry form offers and nothing else.
export function dailyEntryCollects(serviceId: number): boolean {
  return formShape(serviceId) !== "fieldwork" && !WITHDRAWN.has(serviceId);
}
```

There must be no digit inside the function body and no service id written as a number anywhere in this file.

- [ ] **Step 6: Make the dashboard's "across N services" notes count only offered services**

In `src/client/pages/Dashboard.tsx`, find the line

```ts
  const serviceCount = (feeds: (id: number) => boolean) => services.filter((x) => feeds(x.id)).length;
```

and change `services.filter` to `OFFERED.filter` (`OFFERED` is already defined near the top of that file).

- [ ] **Step 7: Add the Hindi key** in `src/client/i18n.tsx`, directly after the entry for `"Field work is reported by field officers, not on the daily entry"`:

```ts
  // MonitoringRules.ValidateEntry: a daily entry for a service hidden from, or
  // removed from, the daily entry. Drafted, not settled; waits on RMC's reviewer.
  "This service is not reported on the daily entry": "यह सेवा दैनिक प्रविष्टि में रिपोर्ट नहीं की जाती",
```

- [ ] **Step 8: Run the suite and fix what else goes red, by rule**

Run: `npx vitest run`

Any remaining failure will be a test that opens service 18–23 or 25 on the daily entry, or pins one in the dashboard filter (known: a loop over services 18–25 in `tests/ui/daily-entry-shapes.test.tsx` asserting the plain `Received` / `Disposed` labels). Fix by this rule only:

- one withdrawn id used as "a plain counter service" → use **24**;
- a loop or list of ids → remove 18–23 and 25, keeping 24 (and 11 if it was there);
- a position number that shifted (old 13 → new 07 for service 24; old 15/16/17 → new 08/09/10 for services 2/5/6) → use the table in "The services" above.

Do not weaken an assertion. If a failure does not fit, stop and report.

- [ ] **Step 9: Run everything**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all passing, tsc silent.

- [ ] **Step 10: Commit** (frontend)

```
feat: the daily entry offers ten services; six are hidden and community hall is removed
```

---

### Task 4: The server accepts a new visit only for field work (backend)

**Files:**
- Modify: `src/Anchal.Infrastructure/CommissionerMonitoring/Officers/MonitoringFieldVisitService.cs`
- Modify: `tests/Anchal.Tests/CommissionerMonitoring/FieldVisits/FieldVisitDetailsTests.cs`

**Produces:** server message `Only field-work activities are recorded as visits`. Visit field errors are keyed with an `input.` prefix, so on the wire this is `fieldErrors["input.serviceId"]`. (The frontend already strips that prefix and already places `serviceId` errors under the Activity dropdown; nothing to do there.)

Helpers already in `FieldVisitDetailsTests.cs` that you will use: `Create()` (the test host), `host.SignInAsOfficer()`, `Input(serviceId, details, withDetails)`, `Post(host, input)`, `Rejected(response)` (asserts 422 and returns the `fieldErrors` element), `PlantRow(host, officerId, detailsJson)`, `Today()`, `Root`.

- [ ] **Step 1: Write the failing tests**

(a) Give `PlantRow` an optional service id. Change its signature to

```csharp
    private static async Task PlantRow(MonitoringTestHost host, Guid officerId, string? detailsJson, int serviceId = 8)
```

and inside it change `ServiceId = 8` to `ServiceId = serviceId`. Its four existing callers are unaffected.

(b) Add these three tests to the class:

```csharp
    /// A visit is how field work is reported, and only field work.
    [Theory]
    [InlineData(1)] [InlineData(2)] [InlineData(11)] [InlineData(24)]
    public async Task ANewVisitForAServiceThatIsNotFieldWorkIsRefused(int serviceId)
    {
        await using var host = await Create();
        await host.SignInAsOfficer();

        using var response = await Post(host, Input(serviceId, withDetails: false));

        var errors = await Rejected(response);
        Assert.Equal("Only field-work activities are recorded as visits", errors.GetProperty("input.serviceId").GetString());
        var list = await host.Client.GetFromJsonAsync<JsonElement>(Root + $"/field-visits?from={Today()}&to={Today()}");
        Assert.Equal(0, list.GetProperty("total").GetInt32());
    }

    [Theory]
    [InlineData(8)] [InlineData(9)] [InlineData(10)] [InlineData(13)]
    [InlineData(14)] [InlineData(15)] [InlineData(16)] [InlineData(17)]
    public async Task ANewVisitForEachFieldWorkServiceIsStillAccepted(int serviceId)
    {
        await using var host = await Create();
        await host.SignInAsOfficer();

        using var response = await Post(host, Input(serviceId, withDetails: false));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    /// Refusing new ones must not hide old ones: one such visit exists on staging.
    [Fact]
    public async Task AVisitAlreadyFiledForAnotherServiceIsStillListed()
    {
        await using var host = await Create();
        var officer = await host.SignInAsOfficer();
        await PlantRow(host, officer.GetProperty("id").GetGuid(), null, serviceId: 1);

        var list = await host.Client.GetFromJsonAsync<JsonElement>(Root + $"/field-visits?from={Today()}&to={Today()}");

        Assert.Equal(1, list.GetProperty("total").GetInt32());
    }
```

If `ANewVisitForEachFieldWorkServiceIsStillAccepted` fails for a service because that service has a *required* detail, do not loosen the test: look at how the first test in the file (`ValidDetailsAreStoredAsVersionOneAndReadBackWithEveryKey`) builds valid details and report which services need them. (Expectation from the field definitions: every detail is optional, so `withDetails: false` is accepted for all eight.)

(c) Two existing tests in this file post a visit for service 1 and will now be refused before details are looked at: `AServiceWithNoFieldsRefusesANonEmptyDetailsObject` and `AServiceWithNoFieldsAcceptsAnEmptyDetailsObject`. A "service with no fields" can no longer be filed at all, so **delete both tests** — this is the one place in this plan where deleting a test is correct, and the new refusal test above replaces them. Say so in your report.

- [ ] **Step 2: Run the backend suite and watch `ANewVisitForAServiceThatIsNotFieldWorkIsRefused` fail** — visits for 1, 2, 11 and 24 are accepted today (status 201, not 422). The other two new tests pass already; say so in your report.

- [ ] **Step 3: Refuse them**

In `MonitoringFieldVisitService.cs`, inside `Validate`, find the line

```csharp
        if (input.ServiceId is < 1 or > MonitoringRules.ServiceCount) throw Validation("serviceId", "Select an activity");
```

and add directly after it:

```csharp
        // A visit is how field work is reported, and only field work: everything else is the clerk's daily
        // entry. Visits already stored for other services are untouched; this refuses new ones.
        if (!MonitoringRules.IsFieldWork(input.ServiceId))
            throw Validation("serviceId", "Only field-work activities are recorded as visits");
```

- [ ] **Step 4: Run the full backend suite.** Expected: all passing. If any other existing test now fails because it files a visit for a service that is not field work, change that test's service id to `9` and nothing else; if the test's point was specifically "a service with no detail fields", stop and report it instead.

- [ ] **Step 5: Commit** (backend)

```
feat: a new field visit is accepted only for a field-work service
```

---

### Task 5: The visit form and the register offer only field work (frontend)

**Files:**
- Modify: `src/domain/service-kind.ts`, `src/client/pages/FieldVisit.tsx`, `src/client/pages/VisitRegister.tsx`, `src/client/i18n.tsx`
- Modify tests: `tests/ui/field-visit.test.tsx`, `tests/ui/visit-register.test.tsx`, `tests/domain/service-kind.test.ts`, `tests/ui/password-reset-midsession.test.tsx`

**Consumes:** server message from Task 4 (arrives as `fieldErrors["input.serviceId"]`; the form already shows `serviceId` errors under the Activity dropdown).
**Produces:** `reportedAsVisit(serviceId)` exported from `service-kind.ts`.

- [ ] **Step 1: Update and add the tests**

`tests/domain/service-kind.test.ts`: import `reportedAsVisit` and add

```ts
  it("reports exactly the eight field-work services as visits", () => {
    expect(services.map((s) => s.id).filter(reportedAsVisit)).toEqual([8, 9, 10, 13, 14, 15, 16, 17]);
  });
```

`tests/ui/field-visit.test.tsx` (add `within` to the `@testing-library/react` import at the top):

- Replace the whole test `renders no extra field for a service with none` (it selects service 1, which the form will no longer offer) with:

```ts
  it("offers the eight field-work services and nothing else, numbered 01 to 08", () => {
    renderForm();
    const options = within(screen.getByLabelText(/^activity/i)).getAllByRole("option").slice(1);
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual(["8", "9", "10", "13", "14", "15", "16", "17"]);
    expect(options.map((o) => o.textContent!.slice(0, 2))).toEqual(["01", "02", "03", "04", "05", "06", "07", "08"]);
  });
```

- In the test `keeps the plain labels before an activity is chosen, and a service with no table entry`: every service the form offers now has its own labels, so the second half is unreachable. Rename it `keeps the plain labels before an activity is chosen`, delete the line `await pick(user, 1);` and the two `expect` lines after it, and delete `const user = userEvent.setup();` from that test if nothing else in it uses `user`.
- In the test that files a visit after `await pick(user, 1);` and expects `details` to be null (around line 440): change `pick(user, 1)` to `pick(user, 17)`. Service 17 has one optional detail, left blank, so `details` is still null.

`tests/ui/visit-register.test.tsx`: add two tests, built like their neighbours (use the file's own `visit(...)` factory and render helper):

1. `offers only the eight field-work services in the activity filter, numbered 01 to 08` — same two assertions as the form test above, against the filter labelled `/activity/i`.
2. `still lists a visit filed for a service the form no longer offers` — `listVisits` resolves one `visit({ serviceId: 1 })`; assert the text `New Holding Application Reporting (SAF)` is shown.

`tests/ui/password-reset-midsession.test.tsx`: add the row `"Only field-work activities are recorded as visits",` to the same list as in Task 3.

- [ ] **Step 2: Run and watch them fail.** `npx vitest run` — `reportedAsVisit` is not exported; the dropdowns hold 25 options; the Hindi key is missing.

- [ ] **Step 3: Add the predicate** to `src/domain/service-kind.ts`, directly after `dailyEntryCollects`:

```ts
// Whether a service is reported as a field visit. The mirror image of the
// daily entry: field work is filed by officers as visits and nothing else is.
// Derived from the shape. Mirrors MonitoringRules.IsFieldWork on the server.
export function reportedAsVisit(serviceId: number): boolean {
  return formShape(serviceId) === "fieldwork";
}
```

- [ ] **Step 4: Narrow both dropdowns**

In `src/client/pages/FieldVisit.tsx` and in `src/client/pages/VisitRegister.tsx`:

(a) import `reportedAsVisit` from the same module the file already imports service helpers from (`../../domain/service-kind`; add the import line if the file has none);

(b) add at module level, below the imports:

```ts
// Only field work is filed as a visit. In list order; the number shown is the
// place in this list, not the service id, which is what is stored and sent.
const VISIT_SERVICES = services.filter((s) => reportedAsVisit(s.id));
```

(c) in the Activity `<select>`, replace

```tsx
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {`${String(service.id).padStart(2, "0")} · ${text(service.en, service.name)}`}
              </option>
            ))}
```

with

```tsx
            {VISIT_SERVICES.map((service, i) => (
              <option key={service.id} value={service.id}>
                {`${String(i + 1).padStart(2, "0")} · ${text(service.en, service.name)}`}
              </option>
            ))}
```

The `value` stays the service id. If `services` is still used elsewhere in the file (the register prints service names in its rows), leave that use alone.

- [ ] **Step 5: Add the Hindi key** in `src/client/i18n.tsx`, after the key added in Task 3:

```ts
  // MonitoringFieldVisitService.Validate: a new visit for a service that is not
  // field work. Drafted, not settled; waits on RMC's reviewer.
  "Only field-work activities are recorded as visits": "केवल क्षेत्रीय कार्य की गतिविधियाँ निरीक्षण के रूप में दर्ज होती हैं",
```

- [ ] **Step 6: Run everything.** `npx vitest run && npx tsc --noEmit`. Expected: all passing, tsc silent. If another visit test fails because it selects a service that is not field work, switch it to `9`.

- [ ] **Step 7: Commit** (frontend)

```
feat: the visit form and the register's filter offer only field work
```

---

### Task 6: Collections are renamed, and "Payments" becomes "Number of Payments" (both repos)

**Files:**
- Modify: `/home/claude/work/src/shared/services.json`
- Modify: `/home/claude/work/tests/domain/shape-twin.fixture.json` (then copy to the backend)
- Modify: `/home/claude/backend/src/Anchal.Infrastructure/CommissionerMonitoring/Seeding/MonitoringProvisioner.cs`
- Modify: `/home/claude/work/src/client/pages/DailyEntry.tsx` (one line)
- Modify tests: `tests/ui/daily-entry-groups.test.tsx`, `tests/ui/daily-entry-shapes.test.tsx`, `tests/ui/daily-entry-service-switch.test.tsx`

The new names (Hindi is a draft):

| id | English | Hindi |
|---|---|---|
| 2 | `Holding Tax Payment Reporting` | `होल्डिंग टैक्स भुगतान की रिपोर्टिंग` |
| 5 | `Water User Charge Payment Reporting` | `जल उपयोगकर्ता शुल्क भुगतान की रिपोर्टिंग` |
| 6 | `Waste User Charge Payment Reporting` | `कचरा उपयोगकर्ता शुल्क भुगतान की रिपोर्टिंग` |

- [ ] **Step 1: Update the tests first**

- `tests/ui/daily-entry-groups.test.tsx`, in the test now titled `shows service 2 as 08…`: heading name `"Holding tax payment"` → `"Holding Tax Payment Reporting"`; `/^payments/i` → `/^number of payments/i`.
- `tests/ui/daily-entry-shapes.test.tsx`: the label string `"Payments"` (around line 130) → `"Number of Payments"`; both `/^payments\b/i` (around lines 194 and 265) → `/^number of payments\b/i`.
- `tests/ui/daily-entry-service-switch.test.tsx` around line 143: `number("Payments")` → `number("Number of Payments")`.

Run `npx vitest run` and confirm these fail on the old label and name.

- [ ] **Step 2: Rename in all three places with this script** (it refuses to run unless every old value is found exactly once)

```bash
python3 - <<'PY'
import pathlib
names = {
  '2': ('Holding tax payment', 'Holding Tax Payment Reporting', 'Holding Tax का भुगतान', 'होल्डिंग टैक्स भुगतान की रिपोर्टिंग'),
  '5': ('Water user charge payment', 'Water User Charge Payment Reporting', 'Water User Charge का भुगतान', 'जल उपयोगकर्ता शुल्क भुगतान की रिपोर्टिंग'),
  '6': ('Waste user charge payment', 'Waste User Charge Payment Reporting', 'Waste User Charge का भुगतान', 'कचरा उपयोगकर्ता शुल्क भुगतान की रिपोर्टिंग'),
}
master = pathlib.Path('/home/claude/work/src/shared/services.json')
fixture = pathlib.Path('/home/claude/work/tests/domain/shape-twin.fixture.json')
seed = pathlib.Path('/home/claude/backend/src/Anchal.Infrastructure/CommissionerMonitoring/Seeding/MonitoringProvisioner.cs')
m, f, s = (p.read_text(encoding='utf-8') for p in (master, fixture, seed))
for sid, (en_old, en_new, hi_old, hi_new) in names.items():
    for text, old in ((m, f'"en": "{en_old}"'), (m, f'"name": "{hi_old}"'), (f, f'"{sid}": "{hi_old}"'), (s, f'"{hi_old}"')):
        assert text.count(old) == 1, f'not found exactly once: {old}'
    m = m.replace(f'"en": "{en_old}"', f'"en": "{en_new}"').replace(f'"name": "{hi_old}"', f'"name": "{hi_new}"')
    f = f.replace(f'"{sid}": "{hi_old}"', f'"{sid}": "{hi_new}"')
    s = s.replace(f'"{hi_old}"', f'"{hi_new}"')
master.write_text(m, encoding='utf-8'); fixture.write_text(f, encoding='utf-8'); seed.write_text(s, encoding='utf-8')
print('ok')
PY
```

- [ ] **Step 3: Copy the fixture to the backend and verify** (`IDENTICAL`, `VALID`), using the commands in "The golden twin fixture".

- [ ] **Step 4: Rename the label**

In `src/client/pages/DailyEntry.tsx`, change

```ts
      if (!hasQueue) return { key, en: "Payments", hi: "भुगतान" };
```

to

```ts
      if (!hasQueue) return { key, en: "Number of Payments", hi: "भुगतानों की संख्या" };
```

- [ ] **Step 5: Run both suites.** Frontend `npx vitest run && npx tsc --noEmit`; backend full suite. Expected: all passing. A backend failure naming one of the three old Hindi names means a test pins that name: update the pinned string to the new one from the table above.

- [ ] **Step 6: Commit in each repo**

Frontend:

```
feat: collections are named as reporting, and ask for the number of payments
```

Backend:

```
feat: the seeded collection names follow the frontend renames
```

---

### Task 7: The browser specs and the handover note (frontend)

**Files:**
- Modify: `tests/browser/daily-form-live.spec.ts`
- Modify: `docs/handover/go-live-operational-checks.md`

The Playwright specs need a live server and **cannot be run here**. Say so plainly in your report; do not imply they pass. What you can check is that they still load: `npx playwright test --list` must list the tests without an error.

- [ ] **Step 1: Bring `daily-form-live.spec.ts` in line with the product**

Known places (search for each; line numbers are approximate):

| Around line | What | Change |
|---|---|---|
| 71–74 | the `FILED` set files services `s1 s2 s5 s6 s7 s12 s20` and expects 17 | replace service **20** with **24** everywhere this set is built or checked; `expected: 17` → `10`; fix the comment's numbers (7 filed of 10) |
| 403, 409, 428, 433, 664 | the label `"Payments"` | `"Number of Payments"` |
| 451–458 | "the list offers seventeen services" | ten; the last row starts `10`; add to the same test a direct POST for one hidden service (20) and the removed one (25), each expecting status 422 and `fieldErrors.serviceId` equal to `This service is not reported on the daily entry` — copy the shape of the existing field-work POST check in that test |
| 470–471 | a plain-counter check on service 20 | service 24 |
| 694–729 | "seventeen", `"All 17 services"`, the 17-value filter | ten / `"All 10 services"` / 10 values |

Then sweep the whole file for any other use of services 18–23 or 25, of the three old collection names, or of a visit filed for a service that is not field work, and fix each by the same rules as Tasks 2–6.

- [ ] **Step 2: Check it still loads.** `npx playwright test --list` — expect a list of tests and no error.

- [ ] **Step 3: Add to the handover note**

In `docs/handover/go-live-operational-checks.md`, in the section `## Field work must not leave the daily entry before officers can sign in`, the sentence saying the service filter and the reports count drop "from 25 to **17**" is now out of date. Change it to say they now stand at **10**, and add directly after that section a new section with this content (plain prose, matching the document's style):

- Heading: `## Services taken off the daily entry by decision`
- Six services are hidden from the clerk's daily entry — Pradhan Mantri Awas Yojana, SSG Group, Vendor licence, PM SVANidhi licence, Revolving fund, Self employment programme — and Community hall booking is removed from it. The daily entry now lists ten services.
- Hidden and removed behave the same in the product today: not offered, refused by the server, and left out of the dashboard's filter, counts and totals. A hidden service can be brought back by deleting its id from three places together: `src/shared/daily-entry-withdrawn.json` (frontend), the `HiddenFromDailyEntry` set in `MonitoringRules.cs` (backend), and `dailyEntryWithdrawn` in the golden fixture in both repos.
- Entries already filed for these services are kept in the database but cannot be corrected through the portal.
- **Known gap:** the opening-balances screen still asks for all 25 services. A balance entered there for a hidden service is ignored by the dashboard, and if that service is later un-hidden the balance will be as old as the day it was typed.
- The field visit form and the register's filter now offer only the eight field-work services, and the server refuses a new visit for anything else; visits already filed for other services stay listed.
- **Deploy order: backend first.** If the frontend ships first, clerks lose the seven services while the old backend still expects 17 reports a day, so every office reads as partly filed until the backend follows.

- [ ] **Step 4: Run** `npx vitest run && npx tsc --noEmit` (the handover and spec edits must not break the unit suite).

- [ ] **Step 5: Commit** (frontend)

```
test: the live spec and the handover follow the ten-service daily entry
```

---

### Task 8: Final verification and delivery

- [ ] **Step 1: Run everything one last time, on the final commits**

Frontend: `npx vitest run` and `npx tsc --noEmit`. Backend: the full suite. Both fixture copies: `cmp` → `IDENTICAL`. Record the two final test counts.

- [ ] **Step 2: Confirm no guard was sidestepped**

```bash
cd /home/claude/work && grep -c "" src/client/index.css && git diff 05e4b3a --stat -- src/client/index.css src/client/styles/theme.css
```

Expected: no changes to either CSS file. Then confirm `git diff 05e4b3a --name-only` (frontend) and `git diff 115f9c5 --name-only` (backend) list only files this plan named, plus tests you fixed by the stated rules.

- [ ] **Step 3: Write the report for the user.** It must contain, in this order:

1. the final test counts for both repos;
2. every commit, per repo, one line each;
3. every existing test you changed, with the rule that justified it;
4. every Hindi string added, marked as awaiting the client's reviewer (the appendix below is the expected list);
5. a plain statement that the Playwright specs were edited but not run;
6. anything you stopped on or were unsure about.

- [ ] **Step 4: Deliver as patches** (do not push, do not deploy)

First ask the user for `git log --oneline -1` from each repo on their machine, because a previous patch may or may not have been applied there and commit ids differ between machines — compare by commit **message**, not id. Cut each patch from the commit whose message matches theirs:

```bash
cd /home/claude/work && git format-patch <base>..HEAD --stdout > /mnt/user-data/outputs/daily-entry-trim-frontend.patch
cd /home/claude/backend && git format-patch <base>..HEAD --stdout > /mnt/user-data/outputs/daily-entry-trim-backend.patch
```

Copy them to `/Users/swetabh/Developer/CommissionerDashboard/` and `/Users/swetabh/Developer/backend-anchal/` with the device file-commit tool, then **list both directories to confirm the files are really there** before telling the user. Tell the user to apply **both** patches before running either test suite (the twin check is red while the two repos are out of step), and that when this is eventually deployed the backend goes first.

---

## Appendix A: Hindi added by this plan (all drafts for the client's reviewer)

| English | Hindi | Where |
|---|---|---|
| This service is not reported on the daily entry | यह सेवा दैनिक प्रविष्टि में रिपोर्ट नहीं की जाती | server message, Task 3 |
| Only field-work activities are recorded as visits | केवल क्षेत्रीय कार्य की गतिविधियाँ निरीक्षण के रूप में दर्ज होती हैं | server message, Task 5 |
| Holding Tax Payment Reporting | होल्डिंग टैक्स भुगतान की रिपोर्टिंग | service 2 name, Task 6 |
| Water User Charge Payment Reporting | जल उपयोगकर्ता शुल्क भुगतान की रिपोर्टिंग | service 5 name, Task 6 |
| Waste User Charge Payment Reporting | कचरा उपयोगकर्ता शुल्क भुगतान की रिपोर्टिंग | service 6 name, Task 6 |
| Number of Payments | भुगतानों की संख्या | field label, Task 6 |

## Appendix B: Things this plan deliberately leaves alone

- The opening-balances screen (still 25 services) — recorded as a known gap in the handover.
- The eight field-work services' own names, and photographs (still disabled).
- The scratch scripts under `tests/agent/`, which are stale and belong to the user.
- Merging `ui-rebuild` and `role-manager`, and any deployment.
