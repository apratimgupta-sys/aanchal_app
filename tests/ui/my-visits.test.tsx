// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import MyVisits from "../../src/client/pages/MyVisits";
import type { FieldVisitView } from "../../src/shared/types";

const listVisits = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/field-visits", () => ({ listVisits }));

function visit(overrides: Partial<FieldVisitView> = {}): FieldVisitView {
  return {
    id: "v1",
    visitDate: "2026-11-19",
    visitTime: "10:30",
    officeId: 3,
    ward: 24,
    serviceId: 9,
    gps: { latitude: 23.3441, longitude: 85.3096, accuracyMetres: 18, capturedAt: "2026-11-19T05:00:00.000Z" },
    issueAction: "Fogging done along the main lane.\nTwo bylanes still pending.",
    officerId: "off-1",
    officerName: "A. Kumar",
    officerDesignation: "Junior Engineer",
    receivedAt: "2026-11-19T05:01:00.000Z",
    verifiedOnSite: true,
    voidedAt: null,
    voidReason: null,
    ...overrides,
  };
}

function renderList(lang: "en" | "hi" = "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>
        <MyVisits />
      </Language.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  listVisits.mockReset();
});

describe("MyVisits", () => {
  it("lists a visit with its ward, activity and first line of the observation", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderList();
    expect(await screen.findByText(/Fogging done along the main lane\./)).toBeTruthy();
    expect(screen.getByText(/Ward 24/)).toBeTruthy();
    // Exact match: the activity label, not the observation that mentions fogging.
    expect(screen.getByText("Fogging")).toBeTruthy();
  });

  it("marks a visit that was not verified on site", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ verifiedOnSite: false })], total: 1 });
    renderList();
    expect(await screen.findByText(/not verified on site/i)).toBeTruthy();
  });

  it("does not claim verification for a visit that was verified", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ verifiedOnSite: true })], total: 1 });
    renderList();
    await screen.findByText(/Fogging done along the main lane\./);
    expect(screen.queryByText(/not verified on site/i)).toBeNull();
  });

  it("strikes through a voided visit and gives the reason", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ voidedAt: "2026-11-19T07:00:00.000Z", voidReason: "Filed against the wrong ward" })],
      total: 1,
    });
    renderList();
    const row = await screen.findByTestId("visit-v1");
    expect(row.className).toContain("is-voided");
    expect(screen.getByText(/filed against the wrong ward/i)).toBeTruthy();
  });

  it("says plainly when there is nothing yet", async () => {
    listVisits.mockResolvedValue({ rows: [], total: 0 });
    renderList();
    expect(await screen.findByText(/no visits recorded/i)).toBeTruthy();
  });

  it("reports a failure to load instead of showing an empty list", async () => {
    listVisits.mockRejectedValue(new Error("network"));
    renderList();
    expect(await screen.findByText(/could not load/i)).toBeTruthy();
  });

  it("renders in Hindi", async () => {
    listVisits.mockResolvedValue({ rows: [], total: 0 });
    renderList("hi");
    expect(await screen.findByText(/कोई निरीक्षण दर्ज नहीं/)).toBeTruthy();
  });
});
