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

// The time a visit is filed under. It comes out of the same instant as the date, in the
// same zone, so the pair cannot disagree. Run this file with TZ=UTC to see it does not
// lean on the machine's zone.
import { indiaTimeOfDay, visitTimeAt } from "../../src/client/lib/dates";

describe("indiaTimeOfDay", () => {
  it("is the wall clock in India, whatever zone the device is in", () => {
    expect(indiaTimeOfDay(new Date("2026-11-19T18:30:00Z"))).toBe("00:00");
    expect(indiaTimeOfDay(new Date("2026-11-19T18:22:00Z"))).toBe("23:52");
    expect(indiaTimeOfDay(new Date("2026-11-19T05:00:00Z"))).toBe("10:30");
  });
});

describe("visitTimeAt: the time that belongs to the day the visit is filed on", () => {
  const at = (iso: string) => new Date(iso);
  it("is the moment the officer captured the location when that was today", () => {
    expect(visitTimeAt("2026-11-19T10:05:00+05:30", at("2026-11-19T10:20:00+05:30"))).toBe("10:05");
  });
  it("is the submit time when the capture was on an earlier day", () => {
    expect(visitTimeAt("2026-11-19T23:52:00+05:30", at("2026-11-20T00:03:00+05:30"))).toBe("00:03");
  });
  it("is the submit time when the capture is after now (a skewed clock) or unreadable", () => {
    expect(visitTimeAt("2026-11-19T10:40:00+05:30", at("2026-11-19T10:20:00+05:30"))).toBe("10:20");
    expect(visitTimeAt("", at("2026-11-19T10:20:00+05:30"))).toBe("10:20");
    expect(visitTimeAt("not a date", at("2026-11-19T10:20:00+05:30"))).toBe("10:20");
  });
  it("never yields a time later than now on now's own date, for any capture", () => {
    const now = at("2026-11-20T00:03:00+05:30");
    for (const capture of ["2026-11-19T00:00:00+05:30", "2026-11-19T23:59:00+05:30", "2026-11-20T00:00:00+05:30", "2026-11-20T00:03:00+05:30", "2026-11-20T09:00:00+05:30"]) {
      expect(visitTimeAt(capture, now) <= indiaTimeOfDay(now)).toBe(true);
    }
  });
});
