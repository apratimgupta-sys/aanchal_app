import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  BACKEND_FIXTURE,
  backendFixtureCandidates,
  findBackendFixture,
  twinNotice,
} from "./backend-twin";
import { fieldsFor } from "../../src/domain/field-visit-fields";
import { collectedFields, formShape, movesPendingBalance } from "../../src/domain/service-kind";
import fixture from "./shape-twin.fixture.json";
import services from "../../src/shared/services.json";
import withdrawn from "../../src/shared/daily-entry-withdrawn.json";
import bounds from "../../src/shared/field-visit-bounds.json";

// The shape tables are a hand-maintained twin of MonitoringRules in the backend
// repo. This golden table is committed identically in both repos, and each side
// asserts its own tables against it, so neither can change a shape or reorder a
// collected field without a test going red. The backend's copy is
// backend/tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json
// and its test is CounterRevenueShapeTests.TheShapeTablesMatchTheGoldenTwinFixture.
const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");
const entries = Object.entries(fixture.shapes) as [
  string,
  { shape: string; collected: string[]; movesPendingBalance: boolean },
][];

describe("the shape tables against the golden twin table", () => {
  it("holds the services withdrawn from the daily entry exactly as daily-entry-withdrawn.json does", () => {
    expect(withdrawn).toEqual(fixture.dailyEntryWithdrawn);
  });

  it("covers the four counterRevenue ids", () => {
    expect(entries.filter(([, e]) => e.shape === "counterRevenue").map(([id]) => Number(id)).sort()).toEqual([1, 3, 4, 7]);
  });

  it.each(entries)("service %s matches in shape, collected fields and order, and balance", (id, e) => {
    expect(formShape(Number(id))).toBe(e.shape);
    expect([...collectedFields(Number(id))]).toEqual(e.collected);
    expect(movesPendingBalance(Number(id))).toBe(e.movesPendingBalance);
  });

  // The Hindi service names are a second hand-kept twin: the backend's
  // MonitoringProvisioner.ServiceNames re-writes the catalog rows from its own
  // copy on every provision run. A rename that reaches only one side is caught
  // here, in the repo where services.json was edited, not only where the two
  // repos sit side by side. The backend asserts the same table against its names
  // (MonitoringAuthTests.TheSeededServiceNamesMatchTheGoldenTwinFixture).
  it("holds every service name exactly as services.json does, and no other", () => {
    const fromJson = Object.fromEntries(services.map((s) => [String(s.id), s.name]));
    expect(fromJson).toEqual(fixture.serviceNames);
    expect(services).toHaveLength(25);
  });

  // The per-service field definitions are the third hand-kept twin: the backend
  // holds the same keys, types, requiredness and option values in
  // MonitoringFieldDefinitions and will validate a submitted details object
  // against them. Labels and Hindi are presentation and stay here only. A key or
  // option value changed on this side goes red here; the backend asserts its own
  // table against the same fixture (FieldVisitFieldDefinitionTests).
  it("holds every field definition exactly as field-visit-fields.json does, and no other", () => {
    const structure = (id: number) =>
      fieldsFor(id).map((f) => ({
        key: f.key,
        type: f.type,
        ...(f.integer ? { integer: true } : {}),
        ...(f.options ? { options: f.options.map((o) => o.value) } : {}),
      }));
    const ids = services.map((s) => s.id);
    const fromReader = Object.fromEntries(
      ids.filter((id) => fieldsFor(id).length > 0).map((id) => [String(id), structure(id)]),
    );
    expect(fromReader).toEqual(fixture.fieldVisitFields);
    // A definition for an id that is not a service would never be reached.
    for (const id of Object.keys(fixture.fieldVisitFields)) expect(ids).toContain(Number(id));
  });

  // The limits a details value is held to: the form's inputs and the Hindi length
  // messages read src/shared/field-visit-bounds.json, the server holds the same three
  // numbers as constants (MonitoringFieldVisitService.Details*), and the fixture is
  // the one place both are asserted against. The backend asserts its constants
  // against the same entry (FieldVisitDetailsTests).
  it("holds the details bounds exactly as field-visit-bounds.json does", () => {
    expect(bounds).toEqual(fixture.fieldVisitBounds);
  });

  // The two copies must be byte-identical. This is the only check that they
  // are, so it must not be able to go quiet by accident: the backend is found
  // under either directory name (see backend-twin.ts), and when it genuinely is
  // not there the test is skipped WITH the reason, which the reporter prints,
  // and warns on the console. Set ANCHAL_REQUIRE_BACKEND=1 where both repos are
  // known to be present and a missing one should fail instead of skip.
  // `npm test` also prints a closing notice when the backend is absent (twin-notice.ts),
  // so a run that did not compare the copies says so as its last lines.
  it("is byte-identical to the backend repo's copy", (ctx) => {
    const found = findBackendFixture(repoRoot);
    if (!found) {
      const looked = backendFixtureCandidates(repoRoot).join(", ");
      const why = `backend repo not found beside this one; looked for ${looked}`;
      if (process.env.ANCHAL_REQUIRE_BACKEND) throw new Error(why);
      console.warn(`shape-twin: byte-identity check SKIPPED: ${why}`);
      ctx.skip(why);
      return;
    }
    const here = readFileSync(new URL("./shape-twin.fixture.json", import.meta.url), "utf8");
    expect(readFileSync(found, "utf8")).toBe(here);
  });
});

describe("finding the backend repo", () => {
  const roots: string[] = [];
  function layout(...dirs: string[]) {
    const base = mkdtempSync(join(tmpdir(), "twin-"));
    roots.push(base);
    mkdirSync(join(base, "CommissionerDashboard"));
    for (const d of dirs) {
      mkdirSync(join(base, d, dirname(BACKEND_FIXTURE)), { recursive: true });
      writeFileSync(join(base, d, BACKEND_FIXTURE), "{}");
    }
    return { front: join(base, "CommissionerDashboard"), base };
  }
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

  it("finds it as ../backend", () => {
    const { front, base } = layout("backend");
    expect(findBackendFixture(front, {})).toBe(join(base, "backend", BACKEND_FIXTURE));
  });

  it("finds it as ../backend-anchal, the name on the user's machine", () => {
    const { front, base } = layout("backend-anchal");
    expect(findBackendFixture(front, {})).toBe(join(base, "backend-anchal", BACKEND_FIXTURE));
  });

  it("finds it where ANCHAL_BACKEND_DIR says", () => {
    const { front, base } = layout("elsewhere");
    expect(findBackendFixture(front, { ANCHAL_BACKEND_DIR: join(base, "elsewhere") })).toBe(
      join(base, "elsewhere", BACKEND_FIXTURE),
    );
  });

  it("reports nothing found rather than guessing, and a directory without the fixture is not a match", () => {
    const { front, base } = layout();
    mkdirSync(join(base, "backend-anchal"));
    expect(findBackendFixture(front, {})).toBeNull();
  });
});

describe("saying so when the twin could not be compared", () => {
  const roots: string[] = [];
  afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
  function layout(withBackend: boolean) {
    const base = mkdtempSync(join(tmpdir(), "twin-notice-"));
    roots.push(base);
    mkdirSync(join(base, "front"));
    if (withBackend) {
      mkdirSync(join(base, "backend", dirname(BACKEND_FIXTURE)), { recursive: true });
      writeFileSync(join(base, "backend", BACKEND_FIXTURE), "{}");
    }
    return join(base, "front");
  }

  it("is silent when the backend is there", () => {
    expect(twinNotice(layout(true), {})).toBeNull();
  });

  it("says plainly that the copies were not compared, and where it looked", () => {
    const front = layout(false);
    const notice = twinNotice(front, {})!;
    expect(notice).toMatch(/NOT COMPARED/);
    expect(notice).toMatch(/DOES NOT COVER/);
    for (const candidate of backendFixtureCandidates(front, {})) expect(notice).toContain(candidate);
    expect(notice).toContain("ANCHAL_BACKEND_DIR");
    expect(notice).toContain("ANCHAL_REQUIRE_BACKEND");
  });
});
