import { env, SELF, reset } from "cloudflare:test";
import { beforeEach, afterEach, it, expect } from "vitest";
import { hashPassword } from "../../src/worker/auth";
const base = "https://rmc.test";
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
) {
  return SELF.fetch(base + path, {
    method,
    headers: { "content-type": "application/json", origin: base, cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function login(user = "anchal1") {
  const r = await request("/api/login", "POST", {
    username: user,
    password: "Test-password-123",
  });
  expect(r.status).toBe(200);
  return r.headers.get("set-cookie")!.split(";")[0];
}
const zero = {
  received: 0,
  completed: 0,
  slaWithinTime: 0,
  amountPaise: 0,
  complaintsReceived: 0,
  complaintsResolved: 0,
  fieldReceived: 0,
  fieldCompleted: 0,
  reportingDate: "2026-10-01",
  serviceId: 1,
  ward: "1",
  avgDisposalDays: null,
  remarks: "",
};
const setup = {
  startDate: "2026-10-01",
  expectedVersion: null,
  requestId: "setup-123",
  reason: null,
  balances: Array.from({ length: 25 }, (_, i) => ({
    serviceId: i + 1,
    opening: { service: 10, complaints: 5, field: 5 },
  })),
};
beforeEach(async () => {
  await env.DB.exec(env.TEST_SCHEMA.replace(/\n/g, " "));
  for (let i = 1; i <= 25; i++)
    await env.DB.prepare("INSERT INTO services VALUES(?,?)")
      .bind(i, "Service " + i)
      .run();
  const hash = await hashPassword("Test-password-123");
  for (const [id, role, office] of [
    ["anchal1", "office", 1],
    ["anchal2", "office", 2],
    ["commissioner", "commissioner", null],
  ] as const)
    await env.DB.prepare("INSERT INTO users VALUES(?,?,?,?,?)")
      .bind(id, id, role, office, hash)
      .run();
});
it("requires authentication and enforces office/commissioner permissions", async () => {
  expect((await request("/api/office/entries")).status).toBe(401);
  const office = await login();
  expect(
    (
      await request(
        "/api/dashboard?from=2026-10-01&to=2026-10-01",
        "GET",
        undefined,
        office,
      )
    ).status,
  ).toBe(403);
  const commissioner = await login("commissioner");
  expect(
    (await request("/api/office/setup", "PUT", setup, commissioner)).status,
  ).toBe(403);
});
it("logs out and rejects invalid credentials and cross origin writes", async () => {
  expect(
    (
      await request("/api/login", "POST", {
        username: "anchal1",
        password: "wrong",
      })
    ).status,
  ).toBe(401);
  const c = await login();
  const r = await SELF.fetch(base + "/api/logout", {
    method: "POST",
    headers: { origin: "https://evil.test", cookie: c },
  });
  expect(r.status).toBe(403);
  expect((await request("/api/logout", "POST", {}, c)).status).toBe(200);
  expect((await request("/api/session", "GET", undefined, c)).status).toBe(401);
});
it("requires setup, persists entries, retries safely, and rejects stale corrections", async () => {
  const c = await login();
  const command = {
    requestId: "entry-123",
    expectedVersion: null,
    input: zero,
    reason: null,
  };
  expect(
    (await request("/api/office/entries", "POST", command, c)).status,
  ).toBe(422);
  expect((await request("/api/office/setup", "PUT", setup, c)).status).toBe(
    200,
  );
  const saved = await request("/api/office/entries", "POST", command, c);
  expect(saved.status).toBe(200);
  const e = (await saved.json()) as { id: string; version: number };
  expect(
    (await request("/api/office/entries", "POST", command, c)).status,
  ).toBe(200);
  expect(
    (
      await request(
        "/api/office/entries",
        "POST",
        { ...command, requestId: "entry-124" },
        c,
      )
    ).status,
  ).toBe(409);
  const other = await login("anchal2");
  expect(
    (
      await request(
        "/api/office/entries?date=2026-10-01",
        "GET",
        undefined,
        other,
      )
    ).status,
  ).toBe(200);
  expect((await request("/api/history", "GET", undefined, c)).status).toBe(200);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_events",
  ).first<{ n: number }>();
  expect(count?.n).toBe(2);
  expect(e.version).toBe(1);
});
it("rejects earlier edits that invalidate later balances without partial audit", async () => {
  const c = await login();
  await request("/api/office/setup", "PUT", setup, c);
  const a = (await (
    await request(
      "/api/office/entries",
      "POST",
      {
        requestId: "first-123",
        expectedVersion: null,
        input: { ...zero, completed: 4, avgDisposalDays: 1 },
        reason: null,
      },
      c,
    )
  ).json()) as { id: string };
  await request(
    "/api/office/entries",
    "POST",
    {
      requestId: "second-123",
      expectedVersion: null,
      input: {
        ...zero,
        reportingDate: "2026-10-02",
        completed: 6,
        avgDisposalDays: 1,
      },
      reason: null,
    },
    c,
  );
  const r = await request(
    "/api/office/entries/" + a.id,
    "PUT",
    {
      requestId: "edit-1234",
      expectedVersion: 1,
      input: { ...zero, completed: 5, avgDisposalDays: 1 },
      reason: "Correction",
    },
    c,
  );
  expect(r.status).toBe(422);
  expect(
    (
      await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_events").first<{
        n: number;
      }>()
    )?.n,
  ).toBe(3);
});
it("rejects malformed setup and websocket access", async () => {
  const c = await login();
  expect(
    (await request("/api/office/setup", "PUT", { ...setup, balances: [] }, c))
      .status,
  ).toBe(422);
  expect((await request("/api/live", "GET", undefined, c)).status).toBe(403);
  expect((await request("/api/live")).status).toBe(401);
});

afterEach(async () => {
  await reset();
});
it("updates commissioner metrics, rejects cross-office correction, and records changes", async () => {
  const c = await login();
  await request("/api/office/setup", "PUT", setup, c);
  const e = (await (
    await request(
      "/api/office/entries",
      "POST",
      {
        requestId: "metrics-123",
        expectedVersion: null,
        input: {
          ...zero,
          received: 2,
          completed: 4,
          slaWithinTime: 3,
          amountPaise: 101,
          avgDisposalDays: 1,
        },
        reason: null,
      },
      c,
    )
  ).json()) as { id: string };
  const other = await login("anchal2");
  await request(
    "/api/office/setup",
    "PUT",
    { ...setup, requestId: "setup-other" },
    other,
  );
  expect(
    (
      await request(
        "/api/office/entries/" + e.id,
        "PUT",
        {
          requestId: "cross-office",
          expectedVersion: 1,
          input: zero,
          reason: "Invalid",
        },
        other,
      )
    ).status,
  ).toBe(404);
  const commissioner = await login("commissioner");
  const summary = (await (
    await request(
      "/api/dashboard?from=2026-10-01&to=2026-10-02",
      "GET",
      undefined,
      commissioner,
    )
  ).json()) as {
    rows: {
      pending: number;
      disposalPct: number;
      slaPct: number;
      submitted: number;
      expected: number;
    }[];
  };
  expect(summary.rows[0]).toMatchObject({
    pending: 248,
    disposalPct: 200,
    slaPct: 75,
    submitted: 1,
    expected: 50,
  });
  const correction = await request(
    "/api/office/entries/" + e.id,
    "PUT",
    {
      requestId: "correct-123",
      expectedVersion: 1,
      input: { ...zero, received: 2, completed: 3, avgDisposalDays: 1 },
      reason: "Count corrected",
    },
    c,
  );
  expect(correction.status).toBe(200);
  const audit = (await (
    await request("/api/history", "GET", undefined, c)
  ).json()) as { before: string; after: string }[];
  expect(
    audit.some(
      (a) =>
        a.before?.includes('"completed":4') &&
        a.after.includes('"completed":3'),
    ),
  ).toBe(true);
});
it("serializes competing saves and rejects expired sessions", async () => {
  const c = await login();
  await request("/api/office/setup", "PUT", setup, c);
  const commands = ["compete-123", "compete-124"].map((requestId) =>
    request(
      "/api/office/entries",
      "POST",
      { requestId, expectedVersion: null, input: zero, reason: null },
      c,
    ),
  );
  expect((await Promise.all(commands)).map((r) => r.status).sort()).toEqual([
    200, 409,
  ]);
  await env.DB.prepare("UPDATE sessions SET expires_at=0").run();
  expect((await request("/api/session", "GET", undefined, c)).status).toBe(401);
});
it("validates login rate limit", async () => {
  for (let i = 0; i < 10; i++)
    expect(
      (
        await request("/api/login", "POST", {
          username: "anchal1",
          password: "wrong",
        })
      ).status,
    ).toBe(401);
  expect(
    (
      await request("/api/login", "POST", {
        username: "anchal1",
        password: "wrong",
      })
    ).status,
  ).toBe(429);
});
it("delivers committed revisions to authenticated websocket subscriber", async () => {
  const commissioner = await login("commissioner");
  const r = await SELF.fetch(base + "/api/live", {
    headers: { origin: base, cookie: commissioner, upgrade: "websocket" },
  });
  expect(r.status).toBe(101);
  const ws = r.webSocket!;
  ws.accept();
  const message = new Promise<string>((resolve) =>
    ws.addEventListener("message", (e) => resolve(String(e.data)), {
      once: true,
    }),
  );
  const office = await login();
  await request("/api/office/setup", "PUT", setup, office);
  expect(JSON.parse(await message)).toMatchObject({
    type: "invalidate",
    officeId: 1,
    revision: 1,
  });
  ws.close();
});
