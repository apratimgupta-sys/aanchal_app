import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// "Derive, never list": which services the daily entry collects is decided by
// the form shape in src/domain/service-kind.ts, and nothing else may spell the
// ids out. A hand-kept list is behaviourally identical to the derivation today
// and drifts the day a service changes shape, so no behavioural test can catch
// it; only reading the source can.
//
// The ids below are the oracle the source is held against, not something any
// production file may copy.
const FIELD_WORK = [8, 9, 10, 13, 14, 15, 16, 17];
const COLLECTED_ONLY = [11, 12, 18, 19, 20, 21, 22, 23, 24, 25]; // the 17 minus 1..7, which are too common as small numbers to mean anything alone
const THRESHOLD = 3;

// What this can and cannot see. It reads every .ts/.tsx under src (comments
// removed), takes each run of numeric literals that sit next to one another
// with only punctuation or a short identifier between them, and reports a run
// that holds THRESHOLD or more distinct ids of either set. That is order
// independent and indifferent to the spelling: an array, a Set, `.includes`,
// `id === 8 || id === 9 || ...`, across lines, at module scope or inside any
// block. It does NOT see a list that is computed (a range, a slice, ids built
// from strings), one kept in another data file, a mask, or a filter on service
// names. Those are possible and no scan of this kind will find them; they have
// to be caught in review. src/shared/services.json is the master and is not
// code, so it is not scanned.
export function findIdLists(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const tokens = [...code.matchAll(/(?<![\w.])\d+(?![\w.])/g)].map((m) => ({
    value: Number(m[0]),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
  const found: string[] = [];
  let run: typeof tokens = [];
  const close = () => {
    const distinct = (ids: number[]) => new Set(run.map((t) => t.value).filter((v) => ids.includes(v))).size;
    if (distinct(FIELD_WORK) >= THRESHOLD || distinct(COLLECTED_ONLY) >= THRESHOLD)
      found.push(code.slice(run[0].start, run.at(-1)!.end).replace(/\s+/g, " ").slice(0, 80));
    run = [];
  };
  for (const t of tokens) {
    if (run.length) {
      const gap = code.slice(run.at(-1)!.end, t.start);
      if (gap.length > 40 || /[\d;{}]/.test(gap)) close();
    }
    run.push(t);
  }
  if (run.length) close();
  return found;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("no production file spells out which services are field work", () => {
  const files = sourceFiles("src");

  it("scans the code it is meant to scan", () => {
    expect(files).toContain(join("src", "domain", "service-kind.ts"));
    expect(files).toContain(join("src", "client", "pages", "DailyEntry.tsx"));
    expect(files).toContain(join("src", "client", "pages", "Dashboard.tsx"));
  });

  it.each(files)("%s holds no list of service ids", (file) => {
    expect(findIdLists(readFileSync(file, "utf8"))).toEqual([]);
  });
});

// The scan is only worth having if it reddens on the spellings it claims to.
describe("the scan itself", () => {
  const caught: [string, string][] = [
    ["at module scope", `const FIELD = new Set([8, 9, 10, 13, 14, 15, 16, 17]);\nexport function f(id: number) { return !FIELD.has(id); }`],
    ["after an inner block", `export function f(id: number) {\n  if (g(id)) { return true; }\n  return ![8, 9, 10, 13, 14, 15, 16, 17].includes(id);\n}`],
    ["in a different order", `const x = [17, 8, 14, 9, 13, 10, 16, 15];`],
    ["split over lines", `const x = [\n  8,\n  9,\n  10,\n];`],
    ["as a chain of comparisons", `const f = (id: number) => id === 8 || id === 9 || id === 10 || id === 13;`],
    ["as the collected seventeen", `const OFFERED = [1, 2, 3, 4, 5, 6, 7, 11, 12, 18, 19, 20, 21, 22, 23, 24, 25];`],
    ["as a string", `const x = "8,9,10,13".split(",");`],
  ];
  it.each(caught)("reports a list %s", (_name, source) => {
    expect(findIdLists(source)).not.toEqual([]);
  });

  const allowed: [string, string][] = [
    ["a comment that names them", `// 8, 9, 10, 13, 14 are field work\n/* 15, 16, 17 */\nconst x = 1;`],
    ["unrelated small numbers", `const grid = [0, 1, 2, 3, 4]; const pad = 16; const y = 44;`],
    ["two of them", `const x = [8, 9];`],
    ["numbers inside a longer identifier", `const a = w8_9_10; const b = 1.10;`],
  ];
  it.each(allowed)("lets through %s", (_name, source) => {
    expect(findIdLists(source)).toEqual([]);
  });
});

// The entry form's own derivation, the line the Dashboard's test already pins
// for itself. It feeds the groups, the displayed numbering, the register count
// and the initial selection.
describe("the entry form derives what it offers", () => {
  const src = readFileSync("src/client/pages/DailyEntry.tsx", "utf8");
  it("builds OFFERED from dailyEntryCollects and nothing else", () => {
    const line = src.split("\n").find((l) => l.startsWith("const OFFERED"));
    expect(line, "OFFERED not found").toBeDefined();
    expect(line).toBe("const OFFERED = services.filter((s) => dailyEntryCollects(s.id));");
  });
});
