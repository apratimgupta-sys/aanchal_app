// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import Dashboard from "../../src/client/pages/Dashboard";
import { route } from "./dashboard-harness";

const api = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/api", () => ({ api }));

const wsCtor = vi.fn();
let client: QueryClient;

function respond(payload: { updatedAt?: string; retrievedAt?: string }) {
  route(api, payload);
}

async function renderDashboard(lang: "en" | "hi" = "en") {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>
        <Dashboard />
      </Language.Provider>
    </QueryClientProvider>,
  );
  await screen.findByText(/anchal-wise performance|अंचलवार प्रदर्शन/i);
  await waitFor(() => expect(api).toHaveBeenCalled());
}

beforeEach(() => {
  api.mockReset();
  wsCtor.mockReset();
  vi.stubGlobal("WebSocket", wsCtor);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// 05:00Z is 10:30 in India.
const STAMP = "2026-11-20T05:00:00.000Z";

describe("dashboard 'figures as of' line", () => {
  it("renders in English, in India time", async () => {
    respond({ updatedAt: STAMP });
    await renderDashboard("en");
    expect(await screen.findByText("Figures as of 20/11/2026 10:30")).toBeTruthy();
  });

  it("renders in Hindi", async () => {
    respond({ updatedAt: STAMP });
    await renderDashboard("hi");
    expect(await screen.findByText("आंकड़े 20/11/2026 10:30 तक")).toBeTruthy();
  });

  it.each([["empty", ""], ["garbage", "not-a-date"]])(
    "renders no broken string for an %s updatedAt",
    async (_n, updatedAt) => {
      respond({ updatedAt });
      await renderDashboard("en");
      await new Promise((r) => setTimeout(r, 50));
      expect(document.body.textContent).not.toMatch(/Invalid Date/);
      expect(screen.queryByText(/Figures as of/)).toBeNull();
    },
  );

  it("falls back to retrievedAt when updatedAt is unusable", async () => {
    respond({ updatedAt: "", retrievedAt: STAMP });
    await renderDashboard("en");
    expect(await screen.findByText("Figures as of 20/11/2026 10:30")).toBeTruthy();
  });

  it("constructs no WebSocket", async () => {
    respond({ updatedAt: STAMP });
    await renderDashboard("en");
    expect(wsCtor).not.toHaveBeenCalled();
  });
});

describe("dashboard refresh without a socket", () => {
  it("polls every 15s while visible and not while hidden", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    respond({ updatedAt: STAMP });
    await renderDashboard("en");
    const spy = vi.spyOn(client, "invalidateQueries");
    act(() => { vi.advanceTimersByTime(15000); });
    expect(spy).toHaveBeenCalledTimes(1);
    const vis = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => { vi.advanceTimersByTime(15000); });
    expect(spy).toHaveBeenCalledTimes(1);
    vis.mockRestore();
  });

  it("refreshes on window focus", async () => {
    respond({ updatedAt: STAMP });
    await renderDashboard("en");
    const spy = vi.spyOn(client, "invalidateQueries");
    act(() => { window.dispatchEvent(new Event("focus")); });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("stops both on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    respond({ updatedAt: STAMP });
    await renderDashboard("en");
    const spy = vi.spyOn(client, "invalidateQueries");
    cleanup();
    act(() => { vi.advanceTimersByTime(30000); window.dispatchEvent(new Event("focus")); });
    expect(spy).not.toHaveBeenCalled();
  });
});
