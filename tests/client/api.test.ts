import { afterEach, describe, expect, it, vi } from "vitest";
import { api, apiRead, RequestError } from "../../src/client/api";

afterEach(() => vi.unstubAllGlobals());

describe("Commissioner Monitoring API transport", () => {
  it("uses the configured Anchal API base and includes monitoring cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ role: "office" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api("/session", "GET", undefined, "https://api.example.in/root/");

    expect(fetchMock).toHaveBeenCalledWith("https://api.example.in/root/session", {
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: undefined,
    });
  });

  it("uses the Anchal API prefix by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await api("services");

    expect(fetchMock.mock.calls[0][0]).toBe("/v1/api/anchal/services");
  });

  it("preserves backend error envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: "VALIDATION", message: "Enter a value" }), {
          status: 422,
        }),
      ),
    );

    await expect(api("/office/entries")).rejects.toMatchObject({
      name: RequestError.name,
      status: 422,
      detail: { code: "VALIDATION", message: "Enter a value" },
    });
  });

  it("returns freshness headers with read payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ officeId: 1 }]), {
          status: 200,
          headers: {
            "X-Monitoring-Retrieved-At": "2026-10-07T10:00:00.000Z",
            "X-Monitoring-Last-Updated": "2026-10-07T09:59:00.000Z",
            "X-Monitoring-Revision": "revision-1",
          },
        }),
      ),
    );

    await expect(apiRead<{ officeId: number }[]>("/dashboard")).resolves.toEqual({
      data: [{ officeId: 1 }],
      retrievedAt: "2026-10-07T10:00:00.000Z",
      lastUpdated: "2026-10-07T09:59:00.000Z",
      revision: "revision-1",
    });
  });
});
