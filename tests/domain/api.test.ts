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

describe("api responses with no body", () => {
  afterEach(() => vi.restoreAllMocks());

  // The password change answers 204 No Content. Parsing that as JSON throws,
  // so a successful change surfaced to the officer as "Could not change the
  // password. Try again." — after it had already been changed.
  it("treats 204 as success rather than failing to parse an empty body", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 204 }),
    );

    await expect(
      api("/password", "POST", { currentPassword: "a", newPassword: "b" }),
    ).resolves.toBeNull();
  });

  it("still reports an error status that carries no body", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(null, { status: 500 }),
    );

    await expect(api("/password", "POST", {})).rejects.toMatchObject({ status: 500 });
  });

  it("still reads the error envelope when one is present", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(JSON.stringify({ code: "VALIDATION", message: "Enter a longer password" }), {
        status: 422,
      }),
    );

    await expect(api("/password", "POST", {})).rejects.toMatchObject({
      status: 422,
      detail: { message: "Enter a longer password" },
    });
  });
});
