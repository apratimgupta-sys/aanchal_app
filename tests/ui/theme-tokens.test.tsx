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
