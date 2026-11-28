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

import { spreadLabels, tiles, tipLeft, tipWidth } from "../../src/client/pages/dashboard/charts/scale";

describe("hover areas", () => {
  it("tile the plot from edge to edge", () => {
    expect(tiles([10, 60, 110], 0, 120)).toEqual([{ x: 0, width: 35 }, { x: 35, width: 50 }, { x: 85, width: 35 }]);
    expect(tiles([60], 10, 110)).toEqual([{ x: 10, width: 100 }]);
    expect(tiles([], 10, 110)).toEqual([]);
  });
});

describe("labels that keep apart", () => {
  it("leaves labels that have room alone", () => {
    expect(spreadLabels([20, 100], 14, 0, 200)).toEqual([20, 100]);
  });
  it("moves close labels apart about their midpoint, keeping the order given", () => {
    expect(spreadLabels([102, 100], 14, 0, 200)).toEqual([108, 94]);
  });
  it("keeps them inside the limits", () => {
    expect(spreadLabels([2, 4], 14, 0, 200)).toEqual([0, 14]);
    expect(spreadLabels([198, 199], 14, 0, 200)).toEqual([186, 200]);
  });
});

describe("a tooltip box", () => {
  it("is sized from its longest line, within 120 and 320", () => {
    expect(tipWidth(["a"])).toBe(120);
    expect(tipWidth(["x".repeat(30)])).toBe(234);
    expect(tipWidth(["x".repeat(100)])).toBe(320);
  });
  it("steps clear of its mark's edge, to the side away from the nearer plot edge", () => {
    expect(tipLeft(56, 4, 150, 56, 1110)).toBe(72);
    expect(tipLeft(100, 20, 150, 56, 1110)).toBe(132);
    expect(tipLeft(1110, 4, 150, 56, 1110)).toBe(944);
    expect(tipLeft(1000, 20, 150, 56, 1110)).toBe(818);
    expect(tipLeft(600, 4, 150, 56, 1110)).toBe(434);
  });
  it("stays inside a plot too narrow to stand beside the mark", () => {
    expect(tipLeft(30, 4, 150, 0, 100)).toBe(0);
    expect(tipLeft(80, 4, 90, 0, 100)).toBe(0);
    expect(tipLeft(50, 4, 150, 10, 100)).toBe(10);
  });
});
