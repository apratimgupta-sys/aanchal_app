import { describe, expect, it } from "vitest";
import { indiaToday } from "../../src/client/lib/dates";

describe("indiaToday", () => {
  it("returns the Indian calendar date, not the UTC one", () => {
    // 19 Nov 2026 20:30 UTC is already 20 Nov in India (UTC+5:30).
    expect(indiaToday(new Date("2026-11-19T20:30:00.000Z"))).toBe("2026-11-20");
  });

  it("stays on the earlier day just before the India midnight boundary", () => {
    expect(indiaToday(new Date("2026-11-19T18:29:00.000Z"))).toBe("2026-11-19");
  });

  it("formats as an ISO calendar date", () => {
    expect(indiaToday(new Date("2026-01-05T06:00:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
