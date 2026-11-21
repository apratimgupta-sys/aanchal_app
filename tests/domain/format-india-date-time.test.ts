import { describe, expect, it } from "vitest";
import { formatIndiaDateTime, formatServiceDate } from "../../src/client/lib/dates";

describe("formatIndiaDateTime", () => {
  it("formats in India time", () => {
    expect(formatIndiaDateTime("2026-11-20T05:00:00.000Z")).toBe("20/11/2026 10:30");
  });
  it.each(["", "not-a-date"])("returns a dash, not a throw, for %j", (v) => {
    expect(formatIndiaDateTime(v)).toBe("—");
  });
});

describe("formatServiceDate", () => {
  it("formats a service date", () => {
    expect(formatServiceDate("2026-11-20")).toBe("20/11/2026");
  });
  it.each(["", "not-a-date"])("returns a dash, not a throw, for %j", (v) => {
    expect(formatServiceDate(v)).toBe("—");
  });
});
