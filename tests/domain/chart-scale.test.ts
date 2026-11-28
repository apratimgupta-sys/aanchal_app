import { describe, expect, it } from "vitest";
import { axis, labelIndexes, xAt } from "../../src/client/pages/dashboard/charts/scale";

describe("a chart's value axis", () => {
  it.each([
    [418, 500, [0, 100, 200, 300, 400, 500]],
    [500, 500, [0, 100, 200, 300, 400, 500]],
    [501, 1000, [0, 200, 400, 600, 800, 1000]],
    [3, 5, [0, 1, 2, 3, 4, 5]],
    [7, 10, [0, 2, 4, 6, 8, 10]],
    [1_630_000, 2_500_000, [0, 500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000]],
  ])("covers %d with a top of %d", (largest, max, ticks) => {
    expect(axis(largest)).toEqual({ max, ticks });
  });

  it("still has an axis when there is nothing to plot", () => {
    expect(axis(0)).toEqual({ max: 5, ticks: [0, 1, 2, 3, 4, 5] });
  });

  it("never tops out below the largest value", () => {
    for (const largest of [1, 6, 11, 26, 49, 99, 101, 999, 12_345, 987_654]) expect(axis(largest).max).toBeGreaterThanOrEqual(largest);
  });
});

describe("where a day sits across the chart", () => {
  it("spreads the days from edge to edge", () => {
    expect(xAt(0, 3, 10, 110)).toBe(10);
    expect(xAt(1, 3, 10, 110)).toBe(60);
    expect(xAt(2, 3, 10, 110)).toBe(110);
  });

  it("puts a single day in the middle", () => {
    expect(xAt(0, 1, 10, 110)).toBe(60);
  });
});

describe("which days are named on the axis", () => {
  it("names every day when they fit", () => {
    expect(labelIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("thins a month evenly and always names the last day", () => {
    expect(labelIndexes(28)).toEqual([3, 7, 11, 15, 19, 23, 27]);
  });

  it("never names more than eight, whatever the length", () => {
    for (const count of [9, 31, 60, 92]) {
      const picked = labelIndexes(count);
      expect(picked.length).toBeLessThanOrEqual(8);
      expect(picked.at(-1)).toBe(count - 1);
    }
  });
});
