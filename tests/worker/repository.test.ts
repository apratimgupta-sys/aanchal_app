import { env, reset } from "cloudflare:test";
import { beforeEach, afterEach, it, expect } from "vitest";
import { Repository } from "../../src/worker/repository";
beforeEach(async () => {
  await env.DB.exec(env.TEST_SCHEMA.replace(/\n/g, " "));
  await env.DB.prepare("INSERT INTO services VALUES(1,?)")
    .bind("service")
    .run();
});
it("persists setup and ordered entries", async () => {
  const repo = new Repository(env.DB);
  expect(await repo.getSetup(1)).toBeNull();
  await env.DB.prepare("INSERT INTO office_setup VALUES(1,?,1)")
    .bind("2026-10-01")
    .run();
  expect((await repo.getSetup(1))?.startDate).toBe("2026-10-01");
});
it("rolls back atomic batch on duplicate key", async () => {
  await expect(
    env.DB.batch([
      env.DB.prepare("INSERT INTO office_revisions VALUES(1,1)"),
      env.DB.prepare("INSERT INTO offices VALUES(1,?)").bind("duplicate"),
    ]),
  ).rejects.toThrow();
  expect(
    await env.DB.prepare("SELECT * FROM office_revisions").all(),
  ).toMatchObject({ results: [] });
});

afterEach(async () => {
  await reset();
});
it("reads legacy entries with original activity date and actual registration date", async () => {
  const old = {
    id: "legacy",
    officeId: 1,
    serviceId: 1,
    reportingDate: "2026-10-01",
    version: 1,
    createdAt: "2026-10-02T20:00:00.000Z",
    updatedAt: "2026-10-02T20:00:00.000Z",
    received: 1,
    completed: 0,
    slaWithinTime: 0,
    amountPaise: 0,
    complaintsReceived: 0,
    complaintsResolved: 0,
    fieldReceived: 0,
    fieldCompleted: 0,
    ward: "1",
    avgDisposalDays: null,
    remarks: "",
  };
  await env.DB.prepare("INSERT INTO daily_entries VALUES(?,?,?,?,?,?)")
    .bind(old.id, 1, 1, old.reportingDate, 1, JSON.stringify(old))
    .run();
  const e = (await new Repository(env.DB).getEntries(1))[0];
  expect(e.serviceDate).toBe("2026-10-01");
  expect(e.reportingDate).toBe("2026-10-03");
  expect(e.createdAt).toBe(old.createdAt);
});
