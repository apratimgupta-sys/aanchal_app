import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Where the backend's copy of the golden twin table lives, relative to the
// backend repo's root.
export const BACKEND_FIXTURE =
  "tests/Anchal.Tests/CommissionerMonitoring/Domain/shape-twin.fixture.json";

// The two repos are checked out side by side, but not under one name: the
// backend is `backend` on some machines and `backend-anchal` on others (where
// this repo is `CommissionerDashboard`). ANCHAL_BACKEND_DIR overrides both for a
// layout that is neither.
export const BACKEND_DIR_NAMES = ["backend", "backend-anchal"] as const;

export function backendFixtureCandidates(frontendRoot: string, env = process.env): string[] {
  const dirs = [
    ...(env.ANCHAL_BACKEND_DIR ? [resolve(env.ANCHAL_BACKEND_DIR)] : []),
    ...BACKEND_DIR_NAMES.map((n) => resolve(frontendRoot, "..", n)),
  ];
  return dirs.map((d) => resolve(d, BACKEND_FIXTURE));
}

export function findBackendFixture(frontendRoot: string, env = process.env): string | null {
  return backendFixtureCandidates(frontendRoot, env).find((p) => existsSync(p)) ?? null;
}

// What `npm test` says, last, when the backend repo is not beside this one and the
// byte-identity check therefore did not run. A skip is one line in a long summary; this
// is meant to be the last thing a person reads. Returns null when the backend is found.
export function twinNotice(frontendRoot: string, env = process.env): string | null {
  if (findBackendFixture(frontendRoot, env)) return null;
  const bar = "=".repeat(78);
  return [
    "",
    bar,
    "THE TWO FIXTURE COPIES WERE NOT COMPARED. A GREEN RUN HERE DOES NOT COVER THEM.",
    "",
    "The backend repo was not found beside this one, so the check that",
    "tests/domain/shape-twin.fixture.json is byte-identical to the backend's copy was skipped.",
    "An edit made to the definitions, the service names or the shape tables on one side only",
    "passes this run. Looked for:",
    ...backendFixtureCandidates(frontendRoot, env).map((c) => `  ${c}`),
    "Put the backend checkout next to this one, or set ANCHAL_BACKEND_DIR, and run again.",
    "Set ANCHAL_REQUIRE_BACKEND=1 to make a missing backend fail the run instead.",
    bar,
    "",
  ].join("\n");
}
