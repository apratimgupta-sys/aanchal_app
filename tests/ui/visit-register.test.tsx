// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Language } from "../../src/client/i18n";
import VisitRegister from "../../src/client/pages/VisitRegister";
import type { FieldVisitView } from "../../src/shared/types";

const listVisits = vi.hoisted(() => vi.fn());
const voidVisit = vi.hoisted(() => vi.fn());
const listOfficers = vi.hoisted(() => vi.fn());
vi.mock("../../src/client/field-visits", () => ({ listVisits, voidVisit }));
vi.mock("../../src/client/officers", () => ({ listOfficers }));

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
  listOfficers.mockReset();
  listOfficers.mockResolvedValue([
    { id: "off-1", username: "je.kadru", name: "A. Kumar", designation: "Junior Engineer", homeOfficeId: 3, active: true },
  ]);
});

describe("VisitRegister", () => {
  it("shows the officer, place and activity of each visit", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister();
    // Scoped to the row: the officer filter lists the same name.
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).getByText(/A\. Kumar/)).toBeTruthy();
    expect(within(row).getByText(/Junior Engineer/)).toBeTruthy();
    expect(within(row).getByText(/Ward 24/)).toBeTruthy();
    expect(within(row).getByText("Fogging")).toBeTruthy();
  });

  it("shows the coordinates so a visit can be checked on a map", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister();
    expect(await screen.findByText(/23\.34410, 85\.30960/)).toBeTruthy();
  });

  it("links each visit's coordinates to Google Maps and passes no verdict on them", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ gps: { latitude: 23.37412, longitude: 85.33891, accuracyMetres: 400, capturedAt: "2026-11-19T03:00:00.000Z" } })],
      total: 1,
    });
    renderRegister();
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).getByText(/23\.37412, 85\.33891/)).toBeTruthy();
    const link = within(row).getByRole("link", { name: /ward 24/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://maps.google.com/?q=23.37412,85.33891");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.textContent).toBe("Open in Google Maps");
    // A coarse, late reading is shown as it was recorded, with no wording about trust.
    expect(within(row).queryByText(/verif/i)).toBeNull();
  });

  it("labels the map link in Hindi", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister("hi");
    const row = await screen.findByTestId("visit-v1");
    const link = within(row).getByRole("link") as HTMLAnchorElement;
    expect(link.textContent).toBe("गूगल मैप्स में खोलें");
    expect(link.getAttribute("aria-label")).toBe("गूगल मैप्स में खोलें — वार्ड 24, 2026-11-19 10:30");
  });

  it("gives each row's map link a name that tells the visits apart", async () => {
    listVisits.mockResolvedValue({
      rows: [visit(), visit({ id: "v2", visitTime: "14:05" })],
      total: 2,
    });
    renderRegister();
    await screen.findByTestId("visit-v2");
    const names = within(screen.getByRole("table")).getAllByRole("link").map((link) => link.getAttribute("aria-label"));
    expect(names).toEqual([
      "Open in Google Maps — Ward 24, 2026-11-19 10:30",
      "Open in Google Maps — Ward 24, 2026-11-19 14:05",
    ]);
  });

  it("says no location was recorded for a 0,0 reading and offers no link", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ gps: { latitude: 0, longitude: 0, accuracyMetres: 18, capturedAt: "2026-11-19T05:00:00.000Z" } })],
      total: 1,
    });
    renderRegister();
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).getByText("No location recorded")).toBeTruthy();
    expect(within(row).queryByRole("link")).toBeNull();
    expect(within(row).queryByText(/0\.00000/)).toBeNull();
    expect(within(row).queryByText(/±/)).toBeNull();
  });

  it("does not blank the register for a visit with no gps at all", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ gps: null }), visit({ id: "v2" })],
      total: 2,
    });
    renderRegister("hi");
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).getByText("कोई स्थान दर्ज नहीं")).toBeTruthy();
    expect(within(row).queryByRole("link")).toBeNull();
    expect(within(await screen.findByTestId("visit-v2")).getByRole("link")).toBeTruthy();
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

  it("says plainly when the filters match nothing", async () => {
    listVisits.mockResolvedValue({ rows: [], total: 0 });
    renderRegister();
    expect(await screen.findByText(/no visits/i)).toBeTruthy();
  });
});

describe("VisitRegister — review findings", () => {
  it("pages through a register larger than one server page", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [visit()], total: 120 });
    renderRegister();
    expect(await screen.findByText(/120/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => expect(listVisits.mock.calls.at(-1)![0]).toMatchObject({ page: 2 }));
  });

  it("does not offer paging when everything fits on one page", async () => {
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    renderRegister();
    await screen.findByTestId("visit-v1");
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
  });

  it("returns to the first page when a filter changes", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [visit()], total: 120 });
    renderRegister();
    await user.click(await screen.findByRole("button", { name: /next/i }));
    await waitFor(() => expect(listVisits.mock.calls.at(-1)![0]).toMatchObject({ page: 2 }));
    await user.selectOptions(screen.getByLabelText(/anchal/i), "3");
    await waitFor(() => {
      const last = listVisits.mock.calls.at(-1)![0];
      expect(last.officeId).toBe(3);
      expect(last.page ?? 1).toBe(1);
    });
  });

  it("filters by officer", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [], total: 0 });
    renderRegister();
    await waitFor(() => expect(listOfficers).toHaveBeenCalled());
    await user.selectOptions(await screen.findByLabelText(/officer/i), "off-1");
    await waitFor(() => expect(listVisits.mock.calls.at(-1)![0]).toMatchObject({ officerId: "off-1" }));
  });

  it("reports a failed void instead of leaving the dialog dead", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    voidVisit.mockRejectedValue(new RequestError({ code: "unauthorised", message: "Please sign in" }, 401));
    renderRegister();
    await user.click(await screen.findByRole("button", { name: /void/i }));
    await user.type(screen.getByLabelText(/reason/i), "Wrong ward");
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(await screen.findByText(/please sign in/i)).toBeTruthy();
  });

  it("does not fire a second void while the first is in flight", async () => {
    const user = userEvent.setup();
    listVisits.mockResolvedValue({ rows: [visit()], total: 1 });
    voidVisit.mockImplementation(() => new Promise(() => {}));
    renderRegister();
    await user.click(await screen.findByRole("button", { name: /void/i }));
    await user.type(screen.getByLabelText(/reason/i), "Wrong ward");
    const confirm = screen.getByRole("button", { name: /confirm/i });
    await user.click(confirm);
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(true));
    expect(voidVisit).toHaveBeenCalledTimes(1);
  });
});

describe("VisitRegister — service details", () => {
  const eight = { vehicleLabour: "Truck 12 with 3 labour", street: "Main Rd, Kadru", wasteType: "dry", quantity: 420 };

  it("shows a service 8 visit's four details, labelled, in the definition's order", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ serviceId: 8, details: eight })], total: 1 });
    renderRegister();
    const row = await screen.findByTestId("visit-v1");
    const box = within(row).getByTestId("visit-details");
    const labels = Array.from(box.querySelectorAll("dt")).map((n) => n.textContent);
    expect(labels).toEqual(["Vehicle & labour", "Street / lane", "Waste type", "Quantity (kg)"]);
    const values = Array.from(box.querySelectorAll("dd")).map((n) => n.textContent);
    expect(values).toEqual(["Truck 12 with 3 labour", "Main Rd, Kadru", "Dry", "420"]);
  });

  it("shows the details in Hindi, including the option's Hindi name", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ serviceId: 8, details: eight })], total: 1 });
    renderRegister("hi");
    const box = within(await screen.findByTestId("visit-v1")).getByTestId("visit-details");
    expect(Array.from(box.querySelectorAll("dt")).map((n) => n.textContent)).toContain("कचरे का प्रकार");
    expect(Array.from(box.querySelectorAll("dd")).map((n) => n.textContent)).toContain("सूखा");
  });

  it.each([
    ["null", null],
    ["absent", undefined],
    ["an empty object", {}],
    ["only blanks", { street: "", vehicleLabour: "  " }],
  ])("renders a visit whose details are %s with no section and no placeholder", async (_name, details) => {
    listVisits.mockResolvedValue({ rows: [visit({ serviceId: 8, details: details as FieldVisitView["details"] })], total: 1 });
    renderRegister();
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).queryByTestId("visit-details")).toBeNull();
    expect(row.querySelector("dl")).toBeNull();
    expect(within(row).queryByText(/^(—|-|n\/a|none|not recorded)$/i)).toBeNull();
    // The rest of the row is intact.
    expect(within(row).getByText("Fogging done along the main lane.")).toBeTruthy();
  });

  // CHOICE: a stored key the service no longer defines is SHOWN, after the defined
  // ones, under its raw key. A person typed that value; a later edit to the field
  // list must not make it vanish from the record.
  it("still shows a value whose key the service no longer defines, after the defined ones", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ serviceId: 8, details: { retiredField: "Left by the old form", street: "Main Rd" } })],
      total: 1,
    });
    renderRegister();
    const box = within(await screen.findByTestId("visit-v1")).getByTestId("visit-details");
    expect(Array.from(box.querySelectorAll("dt")).map((n) => n.textContent)).toEqual(["Street / lane", "retiredField"]);
    expect(within(box).getByText("Left by the old form")).toBeTruthy();
  });

  it("shows a select value it has no option for as it was stored", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ serviceId: 8, details: { wasteType: "hazardous" } })], total: 1 });
    renderRegister();
    expect(within(await screen.findByTestId("visit-v1")).getByText("hazardous")).toBeTruthy();
  });

  it("looks the labels up by the visit's own service", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ id: "a", serviceId: 15, details: { reportingOfficer: "R. Singh", areaCut: 90 } }), visit({ id: "b", serviceId: 8, details: eight })],
      total: 2,
    });
    renderRegister();
    const a = within(await screen.findByTestId("visit-a")).getByTestId("visit-details");
    expect(a.textContent).toContain("Reporting officer");
    expect(a.textContent).not.toContain("Waste type");
    expect(within(screen.getByTestId("visit-b")).getByTestId("visit-details").textContent).toContain("Waste type");
  });

  it("still populates the officer filter from the officers list, with details on screen", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ serviceId: 8, details: eight })], total: 1 });
    renderRegister();
    await screen.findByTestId("visit-v1");
    const select = screen.getByLabelText("Officer") as HTMLSelectElement;
    await waitFor(() => expect(Array.from(select.options).map((o) => o.textContent)).toEqual(["All officers", "A. Kumar · Junior Engineer"]));
  });

  it("keeps the existing columns and the Void button beside the details", async () => {
    listVisits.mockResolvedValue({ rows: [visit({ serviceId: 8, details: eight })], total: 1 });
    renderRegister();
    const row = await screen.findByTestId("visit-v1");
    expect(within(row).getByText(/A\. Kumar/)).toBeTruthy();
    expect(within(row).getByText(/Ward 24/)).toBeTruthy();
    expect(within(row).getByText("Waste vehicle service")).toBeTruthy();
    expect(within(row).getByText(/23\.34410, 85\.30960/)).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Void" })).toBeTruthy();
  });

  it("shows details on a voided row too, which stays struck through", async () => {
    listVisits.mockResolvedValue({
      rows: [visit({ serviceId: 8, details: eight, voidedAt: "2026-11-19T07:00:00.000Z", voidReason: "Wrong ward" })],
      total: 1,
    });
    renderRegister();
    const row = await screen.findByTestId("visit-v1");
    expect(row.hasAttribute("data-voided")).toBe(true);
    expect(within(row).getByTestId("visit-details")).toBeTruthy();
  });
});
