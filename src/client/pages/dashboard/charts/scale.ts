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

// Hover areas that tile the plot: each mark's area runs from the midpoint with the
// previous mark to the midpoint with the next; the first starts at `left`, the last
// ends at `right`. No gaps, no overlaps. No marks, no areas.
export function tiles(marks: number[], left: number, right: number): { x: number; width: number }[] {
  return marks.map((m, i) => {
    const from = i === 0 ? left : (marks[i - 1] + m) / 2;
    const to = i === marks.length - 1 ? right : (m + marks[i + 1]) / 2;
    return { x: from, width: to - from };
  });
}

// Label positions that keep `gap` apart: labels that would be closer are moved
// symmetrically about their midpoint, and the whole group stays within [min, max].
// Positions come back in the order given.
export function spreadLabels(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b]);
  const out = order.map((i) => ys[i]);
  for (let pass = 0; pass < out.length; pass++) {
    for (let k = 1; k < out.length; k++) {
      const short = gap - (out[k] - out[k - 1]);
      if (short > 0) {
        out[k - 1] -= short / 2;
        out[k] += short / 2;
      }
    }
  }
  if (out.length) {
    const shift = out[0] < min ? min - out[0] : out[out.length - 1] > max ? max - out[out.length - 1] : 0;
    for (let k = 0; k < out.length; k++) out[k] += shift;
  }
  const result = new Array<number>(ys.length);
  order.forEach((original, k) => (result[original] = out[k]));
  return result;
}

// A tooltip box sized from its text, since nothing is measured: seven units a
// character and 24 of padding, between 120 and 320.
export function tipWidth(lines: string[]): number {
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  return Math.min(320, Math.max(120, longest * 7 + 24));
}

// Where a tooltip's left edge goes so it never covers its own mark: right of the mark
// in the left half of the plot, left of it in the right half, then kept inside.
export function tipLeft(mark: number, width: number, left: number, right: number, gap = 12): number {
  const x = mark <= (left + right) / 2 ? mark + gap : mark - gap - width;
  return Math.min(Math.max(x, left), right - width);
}
