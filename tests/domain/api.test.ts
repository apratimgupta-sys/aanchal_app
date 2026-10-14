import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../src/client/api";

describe("api GET requests", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shares one in-flight request between concurrent callers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    const [first, second] = await Promise.all([
      api<{ ok: boolean }>("/session"),
      api<{ ok: boolean }>("/session"),
    ]);

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the isolated Anchal API prefix in a production build", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await api<{ ok: boolean }>("/session");

    expect(fetchMock).toHaveBeenCalledWith(
      "/v1/api/anchal/session",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
