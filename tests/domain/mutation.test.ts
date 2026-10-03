import { it, expect } from "vitest";
import { mutationIntent } from "../../src/client/mutation";
it("reuses request id for unchanged retries and changes it for changed payload", () => {
  const first = mutationIntent(null, { received: 1 });
  expect(mutationIntent(first, { received: 1 }).requestId).toBe(
    first.requestId,
  );
  expect(mutationIntent(first, { received: 2 }).requestId).not.toBe(
    first.requestId,
  );
});
