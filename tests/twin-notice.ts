import { twinNotice } from "./domain/backend-twin";

// Vitest global setup (see vitest.config.ts). It runs for every `npm test`, so the
// fixture twin's absence is announced at the end of the run, not left as one skipped
// test among hundreds. It never fails the run: ANCHAL_REQUIRE_BACKEND=1 does that.
export function setup() {}

export function teardown() {
  const notice = twinNotice(process.cwd());
  if (notice) console.error(notice);
}
