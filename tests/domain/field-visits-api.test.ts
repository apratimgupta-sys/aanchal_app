import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVisit, listVisits, voidVisit } from "../../src/client/field-visits";
import type { FieldVisitInput } from "../../src/shared/types";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/api")>(
    "../../src/client/api",
  );
  return { ...actual, api };
});

const input: FieldVisitInput = {
  visitDate: "2026-11-19",
  visitTime: "10:30",
  officeId: 3,
  ward: 24,
  serviceId: 9,
  gps: { latitude: 23.3441, longitude: 85.3096, accuracyMetres: 18, capturedAt: "2026-11-19T05:00:00.000Z" },
  issueAction: "Fogging done along the main lane; two bylanes pending.",
};

beforeEach(() => api.mockReset());

describe("createVisit", () => {
  it("posts the visit with its request id", async () => {
    api.mockResolvedValue({ id: "v1" });
    await createVisit(input, "req-1");
    expect(api).toHaveBeenCalledWith("/field-visits", "POST", { requestId: "req-1", input });
  });

  it("returns the stored visit the server echoes back", async () => {
    api.mockResolvedValue({ id: "v1" });
    await expect(createVisit(input, "req-1")).resolves.toMatchObject({ id: "v1" });
  });
});

describe("listVisits", () => {
  it("passes the date range through as query parameters", async () => {
    api.mockResolvedValue({ rows: [], total: 0 });
    await listVisits({ from: "2026-11-01", to: "2026-11-19" });
    expect(api).toHaveBeenCalledWith("/field-visits?from=2026-11-01&to=2026-11-19");
  });

  it("includes only the filters that are set", async () => {
    api.mockResolvedValue({ rows: [], total: 0 });
    await listVisits({ from: "2026-11-01", to: "2026-11-19", officeId: 3, serviceId: 9 });
    const [path] = api.mock.calls[0];
    expect(path).toContain("officeId=3");
    expect(path).toContain("serviceId=9");
    expect(path).not.toContain("ward=");
    expect(path).not.toContain("undefined");
  });

  it("escapes filter values rather than pasting them into the query", async () => {
    api.mockResolvedValue({ rows: [], total: 0 });
    await listVisits({ from: "2026-11-01", to: "2026-11-19", officerId: "off 1&x=2" });
    const [path] = api.mock.calls[0];
    expect(path).toContain("officerId=off+1%26x%3D2");
  });

  it("asks for a page when one is given", async () => {
    api.mockResolvedValue({ rows: [], total: 0 });
    await listVisits({ from: "2026-11-01", to: "2026-11-19", page: 2 });
    expect(api.mock.calls[0][0]).toContain("page=2");
  });
});

describe("voidVisit", () => {
  it("posts the reason to the visit's void route", async () => {
    api.mockResolvedValue({ id: "v1", voidedAt: "2026-11-19T07:00:00.000Z" });
    await voidVisit("v1", "Filed against the wrong ward");
    expect(api).toHaveBeenCalledWith("/field-visits/v1/void", "POST", {
      reason: "Filed against the wrong ward",
    });
  });

  it("escapes an id rather than pasting it into the path", async () => {
    api.mockResolvedValue({ id: "a/b" });
    await voidVisit("a/b", "reason");
    expect(api.mock.calls[0][0]).toBe("/field-visits/a%2Fb/void");
  });
});
