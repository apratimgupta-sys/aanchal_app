// @vitest-environment jsdom
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import App from "../../src/client/App";
import { api } from "../../src/client/api";
import { runtimeText } from "../../src/client/i18n";

// The real api() runs here; only fetch is stubbed, so the 403 travels the same
// path a production request takes.
vi.mock("../../src/client/pages/DailyEntry", () => ({
  default: () => {
    useEffect(() => {
      void api("/office/entries").catch(() => undefined);
    }, []);
    return <h1>TODAY</h1>;
  },
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let reset: boolean;
let sessionReads: number;

beforeEach(() => {
  localStorage.clear();
  reset = false;
  sessionReads = 0;
  window.history.replaceState({}, "", "/");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input).replace("/v1/api/anchal", "");
    if (url === "/session") {
      sessionReads += 1;
      return json(200, { userId: "u", username: "anchal3", role: "office", officeId: 3, expiresAt: 0, mustChangePassword: reset });
    }
    if (url === "/office/setup") return json(200, { officeId: 3, startDate: "2026-04-01", version: 1, balances: [] });
    if (url.startsWith("/office/entries")) {
      reset = true; // the role manager resets the password while the clerk is working
      return json(403, { code: "password_change_required", message: "Change your temporary password before using the portal" });
    }
    throw new Error(`unexpected ${url}`);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a password reset while the user is signed in", () => {
  it("re-reads the session on the 403 and leaves the clerk on the change-password screen", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Change your password" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "TODAY" })).toBeNull();
    expect(sessionReads).toBe(2);
  });

  it("does not loop: one 403 means one re-read", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "Change your password" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(sessionReads).toBe(2);
  });
});

describe("the Hindi for server messages", () => {
  it.each([
    "Change your temporary password before using the portal",
    "Select a valid role",
    "That username is already taken",
    "Officer not found",
    // MonitoringRules.ValidateEntry, Task 1 of the field-work change.
    "Field work is reported by field officers, not on the daily entry",
    "This service is not reported on the daily entry",
    "Only field-work activities are recorded as visits",
    // The other refusal on the same `serviceId` key.
    "Select a service",
    // These two are the server's wording, character for character. Their keys once
    // read "Service date is outside..." and "...Try again in one minute.", so the
    // Hindi never applied and nothing said so.
    "Date is outside this reporting route",
    "Too many attempts. Try again later.",
    "Choose a period of 92 days or fewer",
  ])("has a Hindi key for %s", (message) => {
    const hindi = runtimeText(message, "hi");
    expect(hindi).not.toBe(message);
    expect(/[ऀ-ॿ]/.test(hindi)).toBe(true);
  });
});
