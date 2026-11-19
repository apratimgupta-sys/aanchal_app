import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { clearSessionCaches, myVisitsQueryKey } from "../../src/client/session-caches";

describe("myVisitsQueryKey", () => {
  it("separates one officer's visits from another's", () => {
    const a = myVisitsQueryKey("off-1", "2026-10-20", "2026-11-19");
    const b = myVisitsQueryKey("off-2", "2026-10-20", "2026-11-19");
    expect(a).not.toEqual(b);
  });

  it("separates different date ranges for the same officer", () => {
    expect(myVisitsQueryKey("off-1", "2026-10-20", "2026-11-19")).not.toEqual(
      myVisitsQueryKey("off-1", "2026-10-01", "2026-10-31"),
    );
  });

  it("stays under the field-visits namespace so a void invalidates it", () => {
    expect(myVisitsQueryKey("off-1", "a", "b")[0]).toBe("field-visits");
  });
});

describe("clearSessionCaches", () => {
  it("empties the cache so the next person cannot read the last one's data", () => {
    const client = new QueryClient();
    client.setQueryData(["field-visits", "mine", "off-1"], { rows: [{ id: "v1" }] });
    clearSessionCaches(client);
    expect(client.getQueryData(["field-visits", "mine", "off-1"])).toBeUndefined();
  });

  it("is called with the real client, not a copy", () => {
    const client = { clear: vi.fn() } as unknown as QueryClient;
    clearSessionCaches(client);
    expect(client.clear).toHaveBeenCalledTimes(1);
  });
});
