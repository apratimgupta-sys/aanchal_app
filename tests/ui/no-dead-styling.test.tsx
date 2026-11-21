// @vitest-environment node
// Guard: the abandoned styling system (UX4G + the hand-written styles.css) must
// not come back. A .tsx extension is deliberate: vitest.config.ts only includes
// tests/domain/**/*.test.ts and tests/ui/**/*.test.tsx, so a .test.ts here would
// silently never run.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("the abandoned styling system stays deleted", () => {
  it("no file under src/ mentions ux4g, in any case", () => {
    const hits = walk("src").filter((f) => /ux4g/i.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  it("the hand-written stylesheet is gone", () => {
    expect(existsSync("src/client/styles.css")).toBe(false);
  });

  it("the legacy component set is gone", () => {
    expect(existsSync("src/client/legacy-ui.tsx")).toBe(false);
  });

  it("nothing imports either of them", () => {
    const hits = walk("src").filter((f) => /\bstyles\.css\b|legacy-ui/.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });

  // The browser specs and agent scripts select by class. When a screen is rebuilt
  // and a class disappears, a selector for it matches nothing: it times out, or
  // (toHaveCount(0)) passes without checking anything. Every class a test names
  // must still exist somewhere in src/.
  it("every .class a browser spec or agent script selects still exists in src/", () => {
    const source = walk("src").map((f) => readFileSync(f, "utf8")).join("\n");
    const specs = [...walk("tests/browser"), ...walk("tests/agent")].filter((f) => /\.(ts|js)$/.test(f));
    const missing: string[] = [];
    for (const f of specs) {
      const text = readFileSync(f, "utf8");
      // Only inside quoted selector strings: '...', "...", `...`.
      for (const lit of text.match(/(["'`])(?:(?!\1)[^\\\n]|\\.)*\1/g) ?? []) {
        for (const m of lit.matchAll(/(?<![\w\]\)-])\.([a-zA-Z_][\w-]*)(?![\w(])/g)) {
          const cls = m[1];
          if (/^(com|org|json|ts|js|png|css|jpg|csv|txt|html|test|spec|sh|md|[0-9]+)$/.test(cls)) continue;
          if (!new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(source)) missing.push(`${f}: .${cls}`);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});
