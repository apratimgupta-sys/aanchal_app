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
