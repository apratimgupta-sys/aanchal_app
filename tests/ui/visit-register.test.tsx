// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import VisitRegister from "../../src/client/pages/VisitRegister";
import type { FieldVisitView } from "../../src/shared/types";

const listVisits = vi.hoisted(() => vi.fn());
const voidVisit = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/field-visits", () => ({ listVisits, voidVisit }));

function visit(overrides: Partial<FieldVisitView> = {}): FieldVisitView {
  return {
    id: "v1",
    visitDate: "2026-11-19",
    visitTime: "10:30",
    officeId: 3,
    ward: 24,
    serviceId: 9,
    gps: { latitude: 23.3441, longitude: 85.3096, accuracyMetres: 18, capturedAt: "2026-11-19T05:00:00.000Z" },
    issueAction: "Fogging done along the main lane.",
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

function renderRegister(lang: "en" | "hi" = "en") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Language.Provider value={lang}>
        <VisitRegister />
      </Language.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  cleanup();
  listVisits.mockReset();
  voidVisit.mockReset();
});

describe("VisitRegister", () => {
  it("shows the officer, place, activity and verification state of each visit", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister();
    expect(await screen.findByText(/A\. Kumar/)).toBeTruthy();
    expect(screen.getByText(/Junior Engineer/)).toBeTruthy();
    expect(screen.getByText(/Ward 24/)).toBeTruthy();
    expect(screen.getByText("Fogging")).toBeTruthy();
  });

  it("shows the coordinates so a visit can be checked on a map", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister();
    expect(await screen.findByText(/23\.34410, 85\.30960/)).toBeTruthy();
  });

  it("composes the chosen filters into one query", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [], total: 0 });
    renderRegister();
    await waitFor(() => expect(listVisits).toHaveBeenCalled());
    await user.selectOptions(screen.getByLabelText(/anchal/i), "3");
    await user.selectOptions(screen.getByLabelText(/activity/i), "9");
    await waitFor(() => {
      const last = listVisits.mock.calls.at(-1)![0];
      expect(last).toMatchObject({ officeId: 3, serviceId: 9 });
    });
  });

  it("will not void a visit without a reason", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister();
    await user.click(await screen.findByRole("button", { name: /void/i }));
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(voidVisit).not.toHaveBeenCalled();
    expect(await screen.findByText(/give a reason/i)).toBeTruthy();
  });

  it("voids a visit with its reason and keeps the row visible", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    voidVisit.mockResolvedValue(visit({ voidedAt: "2026-11-19T07:00:00.000Z", voidReason: "Wrong ward" }));
    renderRegister();
    await user.click(await screen.findByRole("button", { name: /void/i }));
    await user.type(screen.getByLabelText(/reason/i), "Wrong ward");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(voidVisit).toHaveBeenCalledWith("v1", "Wrong ward"));
    expect(await screen.findByTestId("visit-v1")).toBeTruthy();
  });

  it("marks a visit that was not verified on site", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ verifiedOnSite: false })], total: 1 });
    renderRegister();
    expect(await screen.findByText(/not verified on site/i)).toBeTruthy();
  });

  it("says plainly when the filters match nothing", async () => {
    listVisits.mockResolvedValue({ rows: [], total: 0 });
    renderRegister();
    expect(await screen.findByText(/no visits/i)).toBeTruthy();
  });
});
