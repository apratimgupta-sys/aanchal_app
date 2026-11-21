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
});
