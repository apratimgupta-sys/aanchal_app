// The arithmetic behind the dashboard's two charts, kept apart from the drawing
// so it can be tested without a browser.

// A value axis from zero: five equal steps of 1, 2 or 5 times a power of ten,
// the smallest such that the top is not below the largest value. An empty or
// all-zero series still gets an axis (0 to 5), so the chart draws its frame.
export function axis(largest: number): { max: number; ticks: number[] } {
  const steps = 5;
  let step = 1;
  if (largest > steps) {
    const power = 10 ** Math.floor(Math.log10(largest / steps));
    step = [1, 2, 5, 10].map((m) => m * power).find((s) => s * steps >= largest)!;
  }
  return { max: step * steps, ticks: Array.from({ length: steps + 1 }, (_, i) => i * step) };
}

// Where the i-th of `count` evenly spaced marks sits between two edges. A single
// mark sits in the middle.
export function xAt(index: number, count: number, left: number, right: number): number {
  if (count <= 1) return (left + right) / 2;
  return left + (index * (right - left)) / (count - 1);
}

// Which marks get a label on the axis: all of them when they fit, otherwise
// evenly spaced ones counted back from the last, so the latest day is always
// named.
export function labelIndexes(count: number, most = 8): number[] {
  if (count <= most) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil((count - 1) / (most - 1));
  const picked: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) picked.unshift(i);
  return picked;
}
