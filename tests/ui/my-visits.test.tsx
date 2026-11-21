// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
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
    voidedAt: null,
    voidReason: null,
    ...overrides,
  };
}

function renderList(lang: "en" | "hi" = "en", officerId = "off-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>
        <MyVisits officerId={officerId} />
      </Language.Provider>
    </QueryClientProvider>,
  );
  return client;
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

  it("shows where the visit was made with a link that opens it in Google Maps", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ gps: { latitude: 23.37412, longitude: 85.33891, accuracyMetres: 400, capturedAt: "2026-11-19T03:00:00.000Z" } })],
      total: 1,
    });
    renderList();
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).getByText(/23\.37412, 85\.33891/)).toBeTruthy();
    const link = within(row).getByRole("link", { name: /ward 24/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://maps.google.com/?q=23.37412,85.33891");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.textContent).toBe("Open in Google Maps");
    expect(within(row).queryByText(/verif/i)).toBeNull();
  });

  it("labels the map link in Hindi", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderList("hi");
    const row = await screen.findByTestId("visit-v1");
    const link = within(row).getByRole("link");
    expect(link.textContent).toBe("गूगल मैप्स में खोलें");
    expect(link.getAttribute("aria-label")).toBe("गूगल मैप्स में खोलें — वार्ड 24, 2026-11-19 10:30");
  });

  it("says no location was recorded when the coordinates are absent or unusable", async () => {
    listVisits.mockResolvedValue({
      rows: [
        visit({ id: "zero", gps: { latitude: 0, longitude: 0, accuracyMetres: 5, capturedAt: "2026-11-19T05:00:00.000Z" } }),
        visit({ id: "nan", gps: { latitude: Number.NaN, longitude: 85.3, accuracyMetres: 5, capturedAt: "2026-11-19T05:00:00.000Z" } }),
        visit({ id: "none", gps: undefined as unknown as FieldVisitView["gps"] }),
        visit({ id: "ok" }),
      ],
      total: 4,
    });
    renderList();
    for (const id of ["zero", "nan", "none"]) {
      const row = await screen.findByTestId(`visit-${id}`);
      expect(within(row).getByText("No location recorded")).toBeTruthy();
      expect(within(row).queryByRole("link")).toBeNull();
      expect(within(row).queryByText(/±/)).toBeNull();
    }
    const ok = screen.getByTestId("visit-ok");
    expect(within(ok).getByText(/23\.34410, 85\.30960/)).toBeTruthy();
    expect(within(ok).getByRole("link")).toBeTruthy();
  });

  it("writes a tiny coordinate into the link without exponent notation", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ gps: { latitude: 0.0000001, longitude: 85, accuracyMetres: 5, capturedAt: "2026-11-19T05:00:00.000Z" } })],
      total: 1,
    });
    renderList();
    const link = within(await screen.findByTestId("visit-v1")).getByRole("link");
    expect(link.getAttribute("href")).toBe("https://maps.google.com/?q=0.0000001,85");
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

describe("MyVisits — review findings", () => {
  it("caches under the signed-in officer, so another officer's session cannot read it", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    const client = renderList("en", "off-7");
    await screen.findByTestId("visit-v1");
    const keys = client.getQueryCache().findAll().map((entry) => entry.queryKey);
    expect(keys.some((key) => key.includes("off-7"))).toBe(true);
  });
});
