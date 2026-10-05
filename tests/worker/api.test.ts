import { env, SELF, reset } from "cloudflare:test";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { hashPassword } from "../../src/worker/auth";
import { todayIST } from "../../src/domain/ledger";
const base = "https://rmc.test";
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie = "",
) {
  if (path.startsWith("/api/office/entries?") && !path.includes("mode=")) {
    const date = new URL(base + path).searchParams.get("date") ?? todayIST();
    const yesterday = new Date(`${todayIST()}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    path += date === todayIST() ? "&mode=today" : "&mode=backdate";
    if (date > yesterday.toISOString().slice(0, 10))
      path = path.replace("mode=backdate", "mode=today");
  }
  if (
    path.startsWith("/api/office/entries") &&
    body &&
    typeof body === "object" &&
    "input" in body &&
    !("mode" in body)
  ) {
    const payload = body as {
      input: { serviceDate: string };
      reason?: string | null;
    };
    const today = todayIST();
    const mode = payload.input.serviceDate === today ? "today" : "backdate";
    body = {
      ...payload,
      mode,
      reason:
        payload.reason == null && mode === "backdate"
          ? "Test delayed report"
          : (payload.reason ?? null),
    };
  }
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
  serviceDate: "2026-10-01",
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
        "/api/office/setup",
        "PUT",
        { ...setup, requestId: "setup-office2" },
        other,
      )
    ).status,
  ).toBe(200);
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
  const officeHistory = (await (
    await request("/api/history", "GET", undefined, c)
  ).json()) as { officeId: number }[];
  expect(officeHistory).toHaveLength(2);
  expect(officeHistory.every((event) => event.officeId === 1)).toBe(true);
  const commissionerHistory = (await (
    await request("/api/history", "GET", undefined, await login("commissioner"))
  ).json()) as { officeId: number }[];
  expect(commissionerHistory).toHaveLength(3);
  const count = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_events",
  ).first<{ n: number }>();
  expect(count?.n).toBe(3);
  expect(e.version).toBe(1);
});
it("blocks entry reads until setup is complete and locks the first baseline", async () => {
  const c = await login();
  expect(
    (
      await request(
        "/api/office/entries?date=2026-10-01&mode=backdate",
        "GET",
        undefined,
        c,
      )
    ).status,
  ).toBe(422);
  expect((await request("/api/office/setup", "PUT", setup, c)).status).toBe(
    200,
  );
  const original = await env.DB.prepare(
    "SELECT start_date,version FROM office_setup WHERE office_id=1",
  ).first();
  const firstBalance = await env.DB.prepare(
    "SELECT service,complaints,field FROM initial_balances WHERE office_id=1 AND service_id=1",
  ).first();
  const changed = {
    ...setup,
    startDate: "2026-09-01",
    requestId: "setup-second",
  };
  expect((await request("/api/office/setup", "PUT", changed, c)).status).toBe(
    409,
  );
  expect(
    await env.DB.prepare(
      "SELECT start_date,version FROM office_setup WHERE office_id=1",
    ).first(),
  ).toEqual(original);
  expect(
    await env.DB.prepare(
      "SELECT service,complaints,field FROM initial_balances WHERE office_id=1 AND service_id=1",
    ).first(),
  ).toEqual(firstBalance);
});
it("serializes competing first-time setup submissions without overwriting the winner", async () => {
  const c = await login();
  const alternatives = ["setup-race-123", "setup-race-124"].map(
    (requestId, index) =>
      request(
        "/api/office/setup",
        "PUT",
        {
          ...setup,
          requestId,
          balances: setup.balances.map((balance) => ({
            ...balance,
            opening: { ...balance.opening, service: index + 1 },
          })),
        },
        c,
      ),
  );
  expect(
    (await Promise.all(alternatives)).map((response) => response.status).sort(),
  ).toEqual([200, 409]);
  const saved = await env.DB.prepare(
    "SELECT service FROM initial_balances WHERE office_id=1 AND service_id=1",
  ).first<{ service: number }>();
  expect([1, 2]).toContain(saved?.service);
  expect(
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM audit_events",
      ).first<any>()
    ).n,
  ).toBe(1);
});
it("enforces Today and Backdate service-date boundaries and late reasons", async () => {
  const c = await login();
  const startDate = todayIST() === "2026-10-01" ? "2026-09-30" : "2026-10-01";
  await request("/api/office/setup", "PUT", { ...setup, startDate }, c);
  const save = (
    id: string,
    mode: string,
    serviceDate: string,
    reason: string | null,
    serviceId = 1,
  ) =>
    request(
      "/api/office/entries",
      "POST",
      {
        requestId: id,
        expectedVersion: null,
        mode,
        input: { ...zero, serviceId, serviceDate },
        reason,
      },
      c,
    );
  expect(
    (await save("today-valid-123", "today", todayIST(), null)).status,
  ).toBe(200);
  expect(
    (await save("today-old-1234", "today", startDate, "late")).status,
  ).toBe(422);
  const yesterday = new Date(`${todayIST()}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayDate = yesterday.toISOString().slice(0, 10);
  expect(
    (await save("back-start-123", "backdate", startDate, "Late report", 3))
      .status,
  ).toBe(200);
  expect(
    (await save("back-yest-123", "backdate", yesterdayDate, "Late report"))
      .status,
  ).toBe(200);
  expect(
    (
      await request(
        "/api/office/entries",
        "POST",
        {
          requestId: "back-blank-123",
          expectedVersion: null,
          mode: "backdate",
          input: { ...zero, serviceId: 2, serviceDate: yesterdayDate },
          reason: "  ",
        },
        c,
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await request(
        `/api/office/entries?date=${todayIST()}&mode=backdate`,
        "GET",
        undefined,
        c,
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await request(
        `/api/office/entries?date=${yesterdayDate}&mode=today`,
        "GET",
        undefined,
        c,
      )
    ).status,
  ).toBe(422);
  expect(
    (
      await request(
        `/api/office/entries?date=${startDate}&mode=backdate`,
        "GET",
        undefined,
        c,
      )
    ).status,
  ).toBe(200);
  expect(
    (await save("back-today-123", "backdate", todayIST(), "Late report"))
      .status,
  ).toBe(422);
  const audits = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM audit_events",
  ).first<{ n: number }>();
  const revisions = await env.DB.prepare(
    "SELECT revision FROM office_revisions WHERE office_id=1",
  ).first<{ revision: number }>();
  expect(audits?.n).toBe(4);
  expect(revisions?.revision).toBe(4);
});
it("uses the Asia/Kolkata reporting day across UTC midnight boundaries", async () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date("2026-10-04T18:29:59.999Z"));
    const c = await login();
    await request("/api/office/setup", "PUT", setup, c);
    const beforeMidnight = await request("/api/office/entries", "POST", {
      requestId: "ist-today-123",
      expectedVersion: null,
      mode: "today",
      input: { ...zero, serviceDate: "2026-10-04" },
      reason: null,
    }, c);
    expect(beforeMidnight.status).toBe(200);
    vi.setSystemTime(new Date("2026-10-04T18:30:00.000Z"));
    const entry = await beforeMidnight.json() as { id: string; reportingDate: string };
    expect(entry.reportingDate).toBe("2026-10-04");
    expect((await request("/api/office/entries/" + entry.id, "PUT", {
      requestId: "ist-backdate-123",
      expectedVersion: 1,
      mode: "backdate",
      input: { ...zero, serviceDate: "2026-10-04" },
      reason: "Recorded just after midnight IST",
    }, c)).status).toBe(200);
    expect((await request("/api/office/entries", "POST", {
      requestId: "ist-wrong-day-123",
      expectedVersion: null,
      mode: "today",
      input: { ...zero, serviceId: 2, serviceDate: "2026-10-04" },
      reason: null,
    }, c)).status).toBe(422);
    expect((await request("/api/office/entries", "POST", {
      requestId: "ist-new-day-123",
      expectedVersion: null,
      mode: "today",
      input: { ...zero, serviceId: 3, serviceDate: "2026-10-05" },
      reason: null,
    }, c)).status).toBe(200);
  } finally {
    vi.useRealTimers();
  }
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
        serviceDate: "2026-10-02",
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
  const rejectedCorrection = await request(
    "/api/office/entries/" + e.id,
    "PUT",
    {
      requestId: "blank-correction",
      expectedVersion: 1,
      input: { ...zero, received: 2, completed: 3, avgDisposalDays: 1 },
      reason: "   ",
    },
    c,
  );
  expect(rejectedCorrection.status).toBe(422);
  expect(
    (
      await env.DB.prepare(
        "SELECT revision FROM office_revisions WHERE office_id=1",
      ).first<any>()
    ).revision,
  ).toBe(2);
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
it("separates backdated service date from immutable server registration date", async () => {
  const c = await login();
  await request("/api/office/setup", "PUT", setup, c);
  const first = await request(
    "/api/office/entries",
    "POST",
    {
      requestId: "date-first-123",
      expectedVersion: null,
      input: {
        ...zero,
        serviceDate: "2026-10-01",
        reportingDate: "2000-01-01",
      },
      reason: null,
    },
    c,
  );
  expect(first.status).toBe(200);
  const saved = (await first.json()) as {
    id: string;
    serviceDate: string;
    reportingDate: string;
    createdAt: string;
  };
  expect(saved.serviceDate).toBe("2026-10-01");
  expect(saved.reportingDate).toBe(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(saved.createdAt)),
  );
  const updated = (await (
    await request(
      "/api/office/entries/" + saved.id,
      "PUT",
      {
        requestId: "date-correct-123",
        expectedVersion: 1,
        input: {
          ...zero,
          serviceDate: "2026-10-01",
          reportingDate: "2001-01-01",
        },
        reason: "Correction preserves registration",
      },
      c,
    )
  ).json()) as typeof saved;
  expect(updated.reportingDate).toBe(saved.reportingDate);
  expect(updated.createdAt).toBe(saved.createdAt);
});
it("rejects service dates before the immutable reporting start", async () => {
  const c = await login();
  await request("/api/office/setup", "PUT", setup, c);
  const command = {
    requestId: "prior-month-123",
    expectedVersion: null,
    input: { ...zero, serviceDate: "2026-09-15", received: 2 },
    reason: "Late report",
  };
  const first = await request("/api/office/entries", "POST", command, c);
  expect(first.status).toBe(422);
  const unchanged = await env.DB.prepare(
    "SELECT start_date,version FROM office_setup WHERE office_id=1",
  ).first();
  expect(unchanged).toEqual({ start_date: "2026-10-01", version: 1 });
  expect(
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM daily_entries",
      ).first<any>()
    ).n,
  ).toBe(0);
});
it("preserves later balance validation when a back-entry would invalidate it", async () => {
  const c = await login();
  await request("/api/office/setup", "PUT", setup, c);
  const later = await request(
    "/api/office/entries",
    "POST",
    {
      requestId: "later-consume-123",
      expectedVersion: null,
      input: { ...zero, completed: 10, slaWithinTime: 10, avgDisposalDays: 1 },
      reason: null,
    },
    c,
  );
  expect(later.status).toBe(200);
  const rejected = await request(
    "/api/office/entries",
    "POST",
    {
      requestId: "earlier-invalid-123",
      expectedVersion: null,
      input: {
        ...zero,
        serviceDate: "2026-09-15",
        completed: 1,
        slaWithinTime: 1,
        avgDisposalDays: 1,
      },
      reason: null,
    },
    c,
  );
  expect(rejected.status).toBe(422);
  expect(
    (
      await env.DB.prepare(
        "SELECT start_date FROM office_setup WHERE office_id=1",
      ).first<any>()
    ).start_date,
  ).toBe("2026-10-01");
  expect(
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM audit_events WHERE action='Reporting start extended for back-entry'",
      ).first<any>()
    ).count,
  ).toBe(0);
});
