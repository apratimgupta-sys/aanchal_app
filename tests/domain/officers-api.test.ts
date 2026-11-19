import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOfficer,
  listOfficers,
  resetOfficerPassword,
  setOfficerActive,
} from "../../src/client/officers";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/api")>(
    "../../src/client/api",
  );
  return { ...actual, api };
});

beforeEach(() => api.mockReset());

describe("officer administration calls", () => {
  it("lists officers", async () => {
    api.mockResolvedValue([]);
    await listOfficers();
    expect(api).toHaveBeenCalledWith("/officers");
  });

  it("creates an officer and returns the one-time password", async () => {
    api.mockResolvedValue({ officer: { id: "o1" }, temporaryPassword: "Temp#2026ab" });
    const result = await createOfficer({
      username: "je.kadru",
      name: "A. Kumar",
      designation: "Junior Engineer",
      homeOfficeId: 3,
    });
    expect(api).toHaveBeenCalledWith("/officers", "POST", {
      username: "je.kadru",
      name: "A. Kumar",
      designation: "Junior Engineer",
      homeOfficeId: 3,
    });
    expect(result.temporaryPassword).toBe("Temp#2026ab");
  });

  it("deactivates and reactivates by patching the officer", async () => {
    api.mockResolvedValue({ id: "o1", active: false });
    await setOfficerActive("o1", false);
    expect(api).toHaveBeenCalledWith("/officers/o1", "PATCH", { active: false });
    await setOfficerActive("o1", true);
    expect(api).toHaveBeenLastCalledWith("/officers/o1", "PATCH", { active: true });
  });

  it("resets a password through the officer's own route", async () => {
    api.mockResolvedValue({ temporaryPassword: "Temp#2026cd" });
    await resetOfficerPassword("o1");
    expect(api).toHaveBeenCalledWith("/officers/o1/password-reset", "POST", {});
  });

  it("escapes officer ids in paths", async () => {
    api.mockResolvedValue({});
    await setOfficerActive("a/b", false);
    expect(api.mock.calls[0][0]).toBe("/officers/a%2Fb");
  });
});
