import { describe, expect, it } from "vitest";
import { addDays, daysInRange, periodRange } from "../../src/domain/period";

const today = "2026-11-28";
const value = (kind: "today" | "week" | "month" | "custom", from = "", to = "") => ({ kind, from, to });

describe("what a dashboard period means", () => {
  it("today is the one day", () => {
    expect(periodRange(value("today"), today)).toEqual({ from: today, to: today });
  });

  it("the past 7 days are today and the six before it", () => {
    expect(periodRange(value("week"), today)).toEqual({ from: "2026-11-22", to: today });
    expect(periodRange(value("week"), "2026-03-03")).toEqual({ from: "2026-02-25", to: "2026-03-03" });
  });

  it("this month runs from the 1st to today, and is one day on the 1st", () => {
    expect(periodRange(value("month"), today)).toEqual({ from: "2026-11-01", to: today });
    expect(periodRange(value("month"), "2026-12-01")).toEqual({ from: "2026-12-01", to: "2026-12-01" });
  });

  it("a custom range is taken as given", () => {
    expect(periodRange(value("custom", "2026-10-05", "2026-11-10"), today)).toEqual({ from: "2026-10-05", to: "2026-11-10" });
  });

  it.each([
    ["no start", "", "2026-11-10"],
    ["no end", "2026-11-01", ""],
    ["the start after the end", "2026-11-11", "2026-11-10"],
    ["the end after today", "2026-11-01", "2026-11-29"],
    ["a malformed date", "1/11/2026", "2026-11-10"],
  ])("a custom range with %s cannot be asked for", (_, from, to) => {
    expect(periodRange(value("custom", from, to), today)).toBeNull();
  });

  it("the other periods ignore whatever custom dates were typed", () => {
    expect(periodRange(value("today", "2026-01-01", "2026-01-02"), today)).toEqual({ from: today, to: today });
  });
});

describe("date arithmetic on calendar days", () => {
  it("steps across a month and a year", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("counts both ends of a range", () => {
    expect(daysInRange(today, today)).toBe(1);
    expect(daysInRange("2026-11-01", today)).toBe(28);
    expect(daysInRange("2026-07-06", "2026-10-05")).toBe(92);
  });
});
