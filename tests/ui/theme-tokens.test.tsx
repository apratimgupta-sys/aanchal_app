import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import config from "../../tailwind.config";

const css = readFileSync("src/client/styles/theme.css", "utf8");
const rootBlock = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));

// name -> value with the trailing /* comment */ removed
const rootVars = new Map<string, string>();
for (const m of rootBlock.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
  rootVars.set(m[1], m[2].replace(/\/\*.*?\*\//g, "").trim());
}

function referencedVars(node: unknown, out = new Set<string>()): Set<string> {
  if (typeof node === "string") {
    for (const m of node.matchAll(/var\(--([\w-]+)\)/g)) out.add(m[1]);
  } else if (node && typeof node === "object") {
    for (const v of Object.values(node)) referencedVars(v, out);
  }
  return out;
}

describe("theme.css token contract", () => {
  const extend = config.theme?.extend as Record<string, unknown>;
  const referenced = referencedVars({ colors: extend.colors, borderRadius: extend.borderRadius });

  it("the Tailwind config references some variables (guards the walker itself)", () => {
    expect(referenced.size).toBeGreaterThan(15);
  });

  it("every variable the Tailwind theme references is defined in :root", () => {
    const missing = [...referenced].filter((n) => !rootVars.has(n));
    expect(missing).toEqual([]);
  });

  it("every colour triplet is `H S% L%` with the last two as percentages", () => {
    const triplet = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;
    const bad = [...rootVars]
      .filter(([n]) => n !== "radius")
      .filter(([, v]) => !triplet.test(v))
      .map(([n, v]) => `--${n}: ${v}`);
    expect(bad).toEqual([]);
  });
});

describe("tailwind font families", () => {
  const ff = (config.theme?.extend as { fontFamily?: Record<string, string[]> }).fontFamily ?? {};
  it("sans leads with IBM Plex Sans and carries Devanagari in the same stack", () => {
    expect(ff.sans?.[0]).toBe('"IBM Plex Sans"');
    expect(ff.sans).toContain('"IBM Plex Sans Devanagari"');
  });
  it("mono is IBM Plex Mono", () => {
    expect(ff.mono?.[0]).toBe('"IBM Plex Mono"');
  });
  it("every stack ends in a generic family, so a blocked font still renders sensibly", () => {
    for (const key of ["sans", "mono"]) {
      expect(ff[key]?.at(-1)).toMatch(/^(sans-serif|monospace)$/);
    }
  });
  it("defines explicit line heights for the Devanagari-safe body, help and heading text", () => {
    const lh = (config.theme?.extend as { lineHeight?: Record<string, string> }).lineHeight ?? {};
    for (const k of ["body", "help", "heading"]) expect(Number(lh[k])).toBeGreaterThanOrEqual(1.4);
    expect(Number(lh.body)).toBeGreaterThanOrEqual(1.6);
  });
});
