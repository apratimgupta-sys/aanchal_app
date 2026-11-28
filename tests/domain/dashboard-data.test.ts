import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAnchalRows, getDayRows, getServiceRows, getVisitSummary } from "../../src/client/dashboard-data";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/api")>("../../src/client/api");
  return { ...actual, api };
});

beforeEach(() => api.mockReset());

describe("the dashboard's four reads", () => {
  const period = { from: "2026-11-01", to: "2026-11-28" };

  it("asks each route for the period alone when nothing else is chosen", async () => {
    api.mockResolvedValue({ rows: [] });
    await getAnchalRows(period);
    await getServiceRows(period);
    await getDayRows(period);
    await getVisitSummary(period);
    expect(api.mock.calls.map((c) => c[0])).toEqual([
      "/dashboard?from=2026-11-01&to=2026-11-28",
      "/dashboard/services?from=2026-11-01&to=2026-11-28",
      "/dashboard/days?from=2026-11-01&to=2026-11-28",
      "/field-visits/summary?from=2026-11-01&to=2026-11-28",
    ]);
  });

  it("adds the Anchal and the service only when one is chosen", async () => {
    api.mockResolvedValue({ rows: [] });
    await getAnchalRows({ ...period, serviceId: 11 });
    await getServiceRows({ ...period, officeId: 3 });
    await getDayRows({ ...period, officeId: 3, serviceId: 2 });
    await getVisitSummary({ ...period, officeId: 5 });
    expect(api.mock.calls.map((c) => c[0])).toEqual([
      "/dashboard?from=2026-11-01&to=2026-11-28&serviceId=11",
      "/dashboard/services?from=2026-11-01&to=2026-11-28&officeId=3",
      "/dashboard/days?from=2026-11-01&to=2026-11-28&officeId=3&serviceId=2",
      "/field-visits/summary?from=2026-11-01&to=2026-11-28&officeId=5",
    ]);
  });
});
