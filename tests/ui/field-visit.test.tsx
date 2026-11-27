// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { Language } from "../../src/client/i18n";
import FieldVisit from "../../src/client/pages/FieldVisit";
import type { OfficerProfile } from "../../src/shared/types";

const capturePosition = vi.hoisted(() => vi.fn());
const createVisit = vi.hoisted(() => vi.fn());

vi.mock("../../src/client/lib/geolocation", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/lib/geolocation")>(
    "../../src/client/lib/geolocation",
  );
  return { ...actual, capturePosition };
});
vi.mock("../../src/client/field-visits", () => ({ createVisit }));

const officer: OfficerProfile = {
  id: "off-1",
  username: "je.kadru",
  name: "A. Kumar",
  designation: "Junior Engineer",
  homeOfficeId: 3,
  active: true,
};

const goodReading = {
  latitude: 23.3441,
  longitude: 85.3096,
  accuracyMetres: 18,
  capturedAt: "2026-11-19T05:00:00.000Z",
};

function renderForm(lang: "en" | "hi" = "en", clock?: () => Date) {
  render(
    <Language.Provider value={lang}>
      <FieldVisit officer={officer} today="2026-11-19" clock={clock} />
    </Language.Provider>,
  );
}

async function fillAndCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/ward/i), "24");
  await user.selectOptions(screen.getByLabelText(/activity/i), "9");
  await user.type(
    screen.getByLabelText(/issue|description/i),
    "Fogging done along the main lane; two bylanes still pending.",
  );
  await user.click(screen.getByRole("button", { name: /capture location/i }));
}

beforeEach(() => {
  cleanup();
  capturePosition.mockReset();
  createVisit.mockReset();
});

describe("FieldVisit", () => {
  it("defaults the anchal to the officer's own posting", () => {
    renderForm();
    expect((screen.getByLabelText(/anchal/i) as HTMLSelectElement).value).toBe("3");
  });

  it("will not submit before a location is captured", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.selectOptions(screen.getByLabelText(/ward/i), "24");
    await user.selectOptions(screen.getByLabelText(/activity/i), "9");
    await user.type(screen.getByLabelText(/issue|description/i), "Drain blocked near the school gate.");
    expect((screen.getByRole("button", { name: /submit/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(createVisit).not.toHaveBeenCalled();
  });

  it("submits the captured reading with the typed observation", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockResolvedValue({ id: "v1", receivedAt: "2026-11-19T05:01:00.000Z" });
    renderForm();
    await fillAndCapture(user);
    await waitFor(() => expect(screen.getByRole("button", { name: /submit/i })).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(createVisit).toHaveBeenCalled());
    const [input, requestId] = createVisit.mock.calls[0];
    expect(input).toMatchObject({ officeId: 3, ward: 24, serviceId: 9, gps: goodReading, visitDate: "2026-11-19" });
    expect(String(requestId).length).toBeGreaterThan(0);
  });

  it("tells the officer why a denied location blocks the form", async () => {
    const user = userEvent.setup();
    const { GeolocationCaptureError } = await vi.importActual<
      typeof import("../../src/client/lib/geolocation")
    >("../../src/client/lib/geolocation");
    capturePosition.mockRejectedValue(new GeolocationCaptureError("denied"));
    renderForm();
    await user.click(screen.getByRole("button", { name: /capture location/i }));

    expect(await screen.findByText(/location permission/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /submit/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers a retry after a failed capture", async () => {
    const user = userEvent.setup();
    const { GeolocationCaptureError } = await vi.importActual<
      typeof import("../../src/client/lib/geolocation")
    >("../../src/client/lib/geolocation");
    capturePosition.mockRejectedValueOnce(new GeolocationCaptureError("timeout"));
    capturePosition.mockResolvedValueOnce(goodReading);
    renderForm();
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    expect(await screen.findByText(/took too long/i)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /capture location|try again/i }));
    await waitFor(() => expect(screen.getByText(/±\s*18\s*m/)).toBeTruthy());
  });

  it("keeps what was typed when the server refuses the submission", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockRejectedValue(new RequestError({ code: "unauthorised", message: "Please sign in" }, 401));
    renderForm();
    await fillAndCapture(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/please sign in/i)).toBeTruthy();
    expect((screen.getByLabelText(/issue|description/i) as HTMLTextAreaElement).value).toContain("Fogging done");
  });

  it("shows server field errors against their own fields", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>(
      "../../src/client/api",
    );
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockRejectedValue(
      new RequestError(
        { code: "invalid", message: "Please correct the highlighted fields", fieldErrors: { "input.ward": "Ward is not in this Anchal" } },
        422,
      ),
    );
    renderForm();
    await fillAndCapture(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/ward is not in this anchal/i)).toBeTruthy();
  });

  it("renders its labels in Hindi", () => {
    renderForm("hi");
    expect(screen.getByRole("button", { name: /स्थान कैप्चर करें/ })).toBeTruthy();
  });
});

describe("FieldVisit — review findings", () => {
  it("files one visit when submit is pressed twice in quick succession", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    let resolveCreate: (value: unknown) => void = () => {};
    createVisit.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));
    renderForm();
    await fillAndCapture(user);
    const submit = screen.getByRole("button", { name: /submit/i });
    await user.click(submit);
    await user.click(submit);
    resolveCreate({ id: "v1" });

    await waitFor(() => expect(createVisit).toHaveBeenCalledTimes(1));
  });

  it("files one visit when two clicks land in the same flush", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockImplementation(() => new Promise(() => {}));
    renderForm();
    await fillAndCapture(user);
    const submit = screen.getByRole("button", { name: /submit/i });
    // Two taps before React commits the disabled state — the case a request id exists for.
    await act(async () => {
      fireEvent.click(submit);
      fireEvent.click(submit);
    });
    if (createVisit.mock.calls.length > 1) {
      expect(createVisit.mock.calls[0][1]).toBe(createVisit.mock.calls[1][1]);
    } else {
      expect(createVisit).toHaveBeenCalledTimes(1);
    }
  });

  it("gives both attempts the same request id if two do get through", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockRejectedValue(new Error("network"));
    renderForm();
    await fillAndCapture(user);
    const submit = screen.getByRole("button", { name: /submit/i });
    await user.click(submit);
    await waitFor(() => expect(createVisit).toHaveBeenCalledTimes(1));
    await user.click(submit);
    await waitFor(() => expect(createVisit).toHaveBeenCalledTimes(2));
    expect(createVisit.mock.calls[0][1]).toBe(createVisit.mock.calls[1][1]);
  });

  it("re-reads the clock for the next visit instead of reusing the first one's time", async () => {
    const user = userEvent.setup();
    const times = [new Date("2026-11-19T10:30:00"), new Date("2026-11-19T11:40:00")];
    let call = 0;
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockResolvedValue({ id: "v1" });
    renderForm("en", () => times[Math.min(call++, times.length - 1)]);
    expect((screen.getByLabelText(/time of visit/i) as HTMLInputElement).value).toBe("10:30");
    await fillAndCapture(user);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect((screen.getByLabelText(/time of visit/i) as HTMLInputElement).value).toBe("11:40"),
    );
  });

  it("says why submit is unavailable before a location is captured", () => {
    renderForm();
    expect((screen.getByRole("button", { name: /submit/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/capture the location.*before/i)).toBeTruthy();
  });

  it("shows validation messages in Hindi", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    renderForm("hi");
    await user.click(screen.getByRole("button", { name: /स्थान कैप्चर करें/ }));
    await waitFor(() => expect(screen.getByText(/±/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /निरीक्षण जमा करें/ }));
    // The full error string, not the dropdown placeholder that shares a phrase.
    expect(await screen.findByText("1 से 53 के बीच वार्ड चुनें")).toBeTruthy();
    expect(screen.queryByText(/Select a ward from/)).toBeNull();
  });

  it("keeps a good reading when a later capture fails", async () => {
    const user = userEvent.setup();
    const { GeolocationCaptureError } = await vi.importActual<
      typeof import("../../src/client/lib/geolocation")
    >("../../src/client/lib/geolocation");
    capturePosition.mockResolvedValueOnce(goodReading);
    capturePosition.mockRejectedValueOnce(new GeolocationCaptureError("timeout"));
    renderForm();
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await waitFor(() => expect(screen.getByText(/±\s*18\s*m/)).toBeTruthy());
    await user.click(screen.getByRole("button", { name: /capture location again/i }));
    expect(await screen.findByText(/took too long/i)).toBeTruthy();
    expect(screen.getByText(/±\s*18\s*m/)).toBeTruthy();
  });
});

describe("the observation field's ceiling", () => {
  it("stops typing at the length the server and the column accept", () => {
    renderForm();
    const field = screen.getByLabelText(/issue|description/i);
    expect(field.getAttribute("maxlength")).toBe("4000");
  });
});

describe("FieldVisit — the rebuilt screen", () => {
  it("offers 53 wards in a select and no free text", () => {
    renderForm();
    const ward = screen.getByRole("combobox", { name: /Ward/ }) as HTMLSelectElement;
    expect(ward.options.length).toBe(54); // placeholder + wards 1..53
    expect(screen.queryByRole("textbox", { name: /Ward/ })).toBeNull();
  });

  it("links a captured reading to its point on the map, in a new tab, at a tappable size", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    renderForm();
    expect(screen.queryByRole("link", { name: /map/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    const link = await screen.findByRole("link", { name: /map/i });
    expect(link.getAttribute("href")).toBe("https://maps.google.com/?q=23.3441,85.3096");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.className).toMatch(/min-h-\[44px\]/);
  });

  it("states, in both languages, that photographs are switched off", () => {
    renderForm();
    expect(screen.getByText(/not being collected/)).toBeTruthy();
    cleanup();
    renderForm("hi");
    expect(screen.getByText(/संग्रहित नहीं/)).toBeTruthy();
    expect(document.querySelector("input[type=file]")).toBeNull();
  });

  it("renders no landmark of its own: the shell supplies <main>", () => {
    renderForm();
    expect(document.querySelector("main, #main-content")).toBeNull();
  });

  it("marks a field invalid and ties its message to it", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    renderForm();
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    const ward = screen.getByRole("combobox", { name: /Ward/ });
    expect(ward.getAttribute("aria-invalid")).toBe("true");
    expect(ward.getAttribute("aria-describedby")).toBeTruthy();
  });

  it("uses no class from styles.css and no longer imports the legacy component set", () => {
    renderForm();
    const legacy = /^(ux4g-|app-|ui-|visit-|workspace|field-error)/;
    const used = new Set<string>();
    document.querySelectorAll("[class]").forEach((el) => el.classList.forEach((c) => legacy.test(c) && used.add(c)));
    expect([...used]).toEqual([]);
    expect(readFileSync("src/client/pages/FieldVisit.tsx", "utf8")).not.toMatch(/legacy-ui/);
  });
});

// The labels a service's visit is filed under. Date is not an input (a visit is
// always dated today), so it is a labelled value, not a control.
async function pick(user: ReturnType<typeof userEvent.setup>, id: number) {
  await user.selectOptions(screen.getByLabelText(/^activity/i), String(id));
}
const controls = () => document.querySelectorAll("form input, form select, form textarea").length;

describe("FieldVisit — each service's own details", () => {
  it("renders service 8's four fields in order, each with its own control", async () => {
    const user = userEvent.setup();
    renderForm();
    await pick(user, 8);
    const labour = screen.getByLabelText("Vehicle & labour") as HTMLInputElement;
    const street = screen.getByLabelText("Street / lane") as HTMLInputElement;
    const waste = screen.getByLabelText("Waste type") as HTMLSelectElement;
    const quantity = screen.getByLabelText("Quantity (kg)") as HTMLInputElement;
    expect([labour.type, street.type, waste.tagName, quantity.type]).toEqual(["text", "text", "SELECT", "number"]);
    expect([...waste.options].map((o) => o.value)).toEqual(["", "wet", "dry", "mixed"]);
    const order = [labour, street, waste, quantity, screen.getByLabelText(/description/i)];
    order.slice(1).forEach((el, i) =>
      expect(order[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(),
    );
    // between the ward and the description
    expect(screen.getByLabelText(/^ward/i).compareDocumentPosition(labour) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders no extra field for a service with none", async () => {
    const user = userEvent.setup();
    renderForm();
    const before = controls();
    await pick(user, 1);
    expect(controls()).toBe(before);
  });

  it("makes every details field optional", async () => {
    const user = userEvent.setup();
    renderForm();
    await pick(user, 8);
    for (const label of ["Vehicle & labour", "Street / lane", "Waste type", "Quantity (kg)"])
      expect((screen.getByLabelText(label) as HTMLInputElement).required).toBe(false);
  });

  it.each([
    [8, "Pickup date", "Work description"],
    [9, "Fogging date", "Work description"],
    [10, "Activity date", "Outcome description"],
    [13, "Date", "Fault & work description"],
    [14, "Inspection date", "Inspection description"],
    [15, "Work date", "Work description"],
    [16, "Work date", "Pruning description"],
    [17, "Date", "Work description"],
  ])("labels service %i's date %s and its description %s", async (id, date, description) => {
    const user = userEvent.setup();
    renderForm();
    await pick(user, id);
    expect(screen.getByText(date)).toBeTruthy();
    expect(screen.getByText("2026-11-19", { selector: "[data-visit-date]" })).toBeTruthy();
    const box = screen.getByLabelText(new RegExp(`^${description}`)) as HTMLTextAreaElement;
    expect(box.tagName).toBe("TEXTAREA");
    expect(box.required).toBe(true);
  });

  it("keeps the plain labels before an activity is chosen, and a service with no table entry", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByText("Visit date")).toBeTruthy();
    expect(screen.getByLabelText(/issue \/ action/i)).toBeTruthy();
    await pick(user, 1);
    expect(screen.getByText("Visit date")).toBeTruthy();
    expect(screen.getByLabelText(/issue \/ action/i)).toBeTruthy();
  });

  it("labels date and description in Hindi", async () => {
    const user = userEvent.setup();
    renderForm("hi");
    await user.selectOptions(screen.getByLabelText(/^गतिविधि/), "10");
    expect(screen.getByText("गतिविधि तिथि")).toBeTruthy();
    expect(screen.getByLabelText(/^परिणाम का विवरण/)).toBeTruthy();
    expect(screen.getByLabelText("पकड़े गए कुत्ते")).toBeTruthy();
  });

  it("labels service 13 and 17's date and service 13's description in Hindi", async () => {
    const user = userEvent.setup();
    renderForm("hi");
    await user.selectOptions(screen.getByLabelText(/^गतिविधि/), "13");
    expect(screen.getByText("तिथि", { selector: "span, label, div, p, dt" })).toBeTruthy();
    expect(screen.getByLabelText(/^खराबी और कार्य का विवरण/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText(/^गतिविधि/), "17");
    expect(screen.getByText("तिथि", { selector: "span, label, div, p, dt" })).toBeTruthy();
  });

  it("files details carrying only that service's keys, blanks left out, numbers as numbers", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockResolvedValue({ id: "v1" });
    renderForm();
    await user.selectOptions(screen.getByLabelText(/^ward/i), "24");
    await pick(user, 8);
    await user.type(screen.getByLabelText("Street / lane"), "Main lane");
    await user.selectOptions(screen.getByLabelText("Waste type"), "wet");
    await user.type(screen.getByLabelText("Quantity (kg)"), "12.5");
    await user.type(screen.getByLabelText(/description/i), "Collected from both sides of the lane.");
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    await waitFor(() => expect(createVisit).toHaveBeenCalled());
    expect(createVisit.mock.calls[0][0].details).toEqual({ street: "Main lane", wasteType: "wet", quantity: 12.5 });
  });

  it("sends no details at all for a service that has none", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockResolvedValue({ id: "v1" });
    renderForm();
    await user.selectOptions(screen.getByLabelText(/^ward/i), "24");
    await pick(user, 1);
    await user.type(screen.getByLabelText(/issue|description/i), "Counter checked; queue was short.");
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    await waitFor(() => expect(createVisit).toHaveBeenCalled());
    expect(createVisit.mock.calls[0][0].details ?? null).toBeNull();
  });

  // The daily entry shipped this bug once ("files against the service on screen,
  // not the one typed into first"). Service 8 and 16 both have a `street` key, so
  // only a reset on the change — not the filter on the keys — keeps 8's street
  // out of 16's filing.
  it("files against the details of the service on screen, not the one typed into first", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockResolvedValue({ id: "v1" });
    renderForm();
    await user.selectOptions(screen.getByLabelText(/^ward/i), "24");
    await pick(user, 8);
    await user.type(screen.getByLabelText("Street / lane"), "Old lane typed under waste");
    await user.type(screen.getByLabelText("Quantity (kg)"), "40");
    await pick(user, 16);
    expect((screen.getByLabelText("Street / lane") as HTMLInputElement).value).toBe("");
    expect(screen.queryByLabelText("Quantity (kg)")).toBeNull();
    await user.type(screen.getByLabelText("Number of trees"), "3");
    await user.type(screen.getByLabelText(/description/i), "Three trees pruned along the road.");
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    await waitFor(() => expect(createVisit).toHaveBeenCalled());
    const [input] = createVisit.mock.calls[0];
    expect(input.serviceId).toBe(16);
    expect(input.details).toEqual({ treeCount: 3 });
  });

  it("does not bring a stale details error across a change of service", async () => {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>("../../src/client/api");
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockRejectedValue(
      new RequestError({ code: "VALIDATION", message: "Please correct the highlighted fields", fieldErrors: { "input.details.street": "Enter text" } }, 422),
    );
    renderForm();
    await user.selectOptions(screen.getByLabelText(/^ward/i), "24");
    await pick(user, 8);
    await user.type(screen.getByLabelText(/description/i), "Collected from both sides of the lane.");
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Enter text")).toBeTruthy();
    await pick(user, 16);
    expect(screen.queryByText("Enter text")).toBeNull();
  });

  it("clears the details after a visit is filed", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    // A server that stored the details answers with them (C1: one that did not is a different story).
    createVisit.mockResolvedValue({ id: "v1", details: { street: "Main lane" } });
    renderForm();
    await user.selectOptions(screen.getByLabelText(/^ward/i), "24");
    await pick(user, 8);
    await user.type(screen.getByLabelText("Street / lane"), "Main lane");
    await user.type(screen.getByLabelText(/description/i), "Collected from both sides of the lane.");
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    await screen.findByText(/visit recorded/i);
    await pick(user, 8);
    expect((screen.getByLabelText("Street / lane") as HTMLInputElement).value).toBe("");
  });
});

describe("FieldVisit — a server error on a details field", () => {
  async function refused(fieldErrors: Record<string, string>, lang: "en" | "hi" = "en", id = 10) {
    const user = userEvent.setup();
    const { RequestError } = await vi.importActual<typeof import("../../src/client/api")>("../../src/client/api");
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockRejectedValue(
      new RequestError({ code: "VALIDATION", message: "Please correct the highlighted fields", fieldErrors }, 422),
    );
    renderForm(lang);
    await user.selectOptions(screen.getByLabelText(lang === "hi" ? /^वार्ड/ : /^ward/i), "24");
    await user.selectOptions(screen.getByLabelText(lang === "hi" ? /^गतिविधि/ : /^activity/i), String(id));
    await user.type(screen.getByLabelText(/description|विवरण/i), "Dogs picked up near the market gate.");
    await user.click(screen.getByRole("button", { name: /capture location|स्थान कैप्चर/i }));
    await user.click(await screen.findByRole("button", { name: /submit|जमा करें/i }));
  }

  it.each([
    ["dogsPicked", "Dogs picked", "Enter a whole number from 0 to 1,000,000,000"],
    ["teamLabour", "Team / labour", "Shorten this to 200 characters or fewer"],
    ["actionLocation", "Location of action", "Enter text"],
  ])("puts the message for %s on that field, tied to it", async (key, label, message) => {
    await refused({ [`input.details.${key}`]: message });
    const control = screen.getByLabelText(label);
    expect(control.getAttribute("aria-invalid")).toBe("true");
    const described = control.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
    expect(described).toContain(message);
  });

  it("puts a select's message on the select", async () => {
    await refused({ "input.details.wasteType": "Select one of the listed options" }, "en", 8);
    const control = screen.getByLabelText("Waste type");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(control.getAttribute("aria-describedby")!)?.textContent).toContain("Select one of the listed options");
  });

  it("says every refused field's message at once", async () => {
    await refused({
      "input.details.dogsPicked": "Enter a whole number from 0 to 1,000,000,000",
      "input.details.dogsNeutered": "Enter a whole number from 0 to 1,000,000,000",
    });
    expect(screen.getByLabelText("Dogs picked").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Dogs neutered & released").getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the message in Hindi to a Hindi reader", async () => {
    await refused({ "input.details.dogsPicked": "Enter a whole number from 0 to 1,000,000,000" }, "hi");
    expect(screen.getByText("0 से 1,000,000,000 के बीच पूर्ण संख्या दर्ज करें")).toBeTruthy();
  });

  it("does not leave a message with nowhere to land", async () => {
    // A key the screen has no field for must still be said somewhere visible.
    await refused({ "input.details.noSuchKey": "This activity does not ask for this detail" });
    expect(screen.getByText(/does not ask for this detail/i)).toBeTruthy();
  });

  it("shows a refused visit date, which has no input of its own", async () => {
    await refused({ "input.visitDate": "A visit can only be recorded on the day it was made" });
    expect(screen.getByText(/only be recorded on the day/i)).toBeTruthy();
  });
});

describe("FieldVisit — a whole-number input for a count", () => {
  it("asks a count for a whole number and a measurement for a decimal", async () => {
    const user = userEvent.setup();
    renderForm();
    await pick(user, 10);
    const dogs = screen.getByLabelText("Dogs picked") as HTMLInputElement;
    expect([dogs.type, dogs.getAttribute("step"), dogs.getAttribute("inputmode"), dogs.min]).toEqual(["number", "1", "numeric", "0"]);
    await pick(user, 8);
    const kg = screen.getByLabelText("Quantity (kg)") as HTMLInputElement;
    expect([kg.getAttribute("step"), kg.getAttribute("inputmode"), kg.min]).toEqual(["any", "decimal", "0"]);
  });
});

describe("FieldVisit — phone-width controls", () => {
  it("gives every details control the 44px floor, the no-zoom type size and a visible focus ring", async () => {
    const user = userEvent.setup();
    renderForm();
    await pick(user, 8);
    for (const label of ["Vehicle & labour", "Street / lane", "Waste type", "Quantity (kg)"]) {
      const el = screen.getByLabelText(label);
      expect(el.className).toMatch(/min-h-\[44px\]/);
      expect(el.className).toMatch(/text-\[16px\]/);
      expect(el.className).toMatch(/focus-visible:outline/);
      expect(el.tabIndex).toBe(0);
    }
  });

  it("wraps no new control in a fixed width", async () => {
    const user = userEvent.setup();
    renderForm();
    await pick(user, 8);
    expect(screen.getByLabelText("Quantity (kg)").className).not.toMatch(/\bw-\[\d+px\]/);
  });
});

// Server messages match by exact string and fall back to English silently, so a
// message with no key here would show in English to a Hindi reader with no failing
// test. These are the details messages the server can send (MonitoringFieldVisitService).
describe("FieldVisit — the server's details messages have Hindi", () => {
  it.each([
    "This activity does not ask for this detail",
    "Enter a number from 0 to 1,000,000,000",
    "Enter a whole number from 0 to 1,000,000,000",
    "Select one of the listed options",
    "Enter text",
    "Shorten this to 200 characters or fewer",
    "Shorten this to 2000 characters or fewer",
  ])("translates %s", async (message) => {
    const { runtimeText } = await import("../../src/client/i18n");
    expect(runtimeText(message, "hi")).not.toBe(message);
    expect(runtimeText(message, "en")).toBe(message);
  });
});

// C1: a backend that predates the details column skips `input.details` without a
// word, answers 201, and sends back a visit with no details. The form must not read
// that as success: the officer typed those figures in a street and has to be told.
describe("FieldVisit — a visit stored without the details that were sent", () => {
  async function fileWithDogs(lang: "en" | "hi" = "en") {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    renderForm(lang);
    await user.selectOptions(screen.getByLabelText(lang === "hi" ? /^वार्ड/ : /^ward/i), "24");
    await user.selectOptions(screen.getByLabelText(lang === "hi" ? /^गतिविधि/ : /^activity/i), "10");
    await user.type(screen.getByLabelText(lang === "hi" ? "पकड़े गए कुत्ते" : "Dogs picked"), "4");
    await user.type(screen.getByLabelText(lang === "hi" ? "कार्रवाई का स्थान" : "Location of action"), "Market gate");
    await user.type(screen.getByLabelText(/description|विवरण/i), "Dogs picked up near the market gate.");
    await user.click(screen.getByRole("button", { name: /capture location|स्थान कैप्चर/i }));
    await user.click(await screen.findByRole("button", { name: /submit|जमा करें/i }));
    return user;
  }

  it("says the details were not saved, and does not say 'Visit recorded.' alone", async () => {
    createVisit.mockResolvedValue({ id: "v1" });
    await fileWithDogs();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/details were not saved/i);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/^visit recorded\.$/i)).toBeNull();
  });

  it("lists each lost figure by its label and value, so it can be reported", async () => {
    createVisit.mockResolvedValue({ id: "v1", details: null });
    await fileWithDogs();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Dogs picked: 4");
    expect(alert.textContent).toContain("Location of action: Market gate");
  });

  it("keeps everything the officer typed, rather than clearing the form", async () => {
    createVisit.mockResolvedValue({ id: "v1" });
    await fileWithDogs();
    await screen.findByRole("alert");
    expect((screen.getByLabelText("Dogs picked") as HTMLInputElement).value).toBe("4");
    expect((screen.getByLabelText("Location of action") as HTMLInputElement).value).toBe("Market gate");
    expect((screen.getByLabelText(/description/i) as HTMLTextAreaElement).value).toContain("market gate");
  });

  it("names only the figures that are missing when some came back", async () => {
    createVisit.mockResolvedValue({ id: "v1", details: { dogsPicked: 4 } });
    await fileWithDogs();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Location of action: Market gate");
    expect(alert.textContent).not.toContain("Dogs picked: 4");
  });

  it("is an ordinary success when every sent figure comes back", async () => {
    createVisit.mockResolvedValue({ id: "v1", details: { dogsPicked: 4, actionLocation: "Market gate" } });
    await fileWithDogs();
    expect(await screen.findByText("Visit recorded.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    // The service resets with the form, so the description is back to its plain label.
    expect((screen.getByLabelText(/issue/i) as HTMLTextAreaElement).value).toBe("");
  });

  it("does not treat a visit filed with no details as a loss", async () => {
    const user = userEvent.setup();
    capturePosition.mockResolvedValue(goodReading);
    createVisit.mockResolvedValue({ id: "v1" });
    renderForm();
    await user.selectOptions(screen.getByLabelText(/^ward/i), "24");
    await pick(user, 10);
    await user.type(screen.getByLabelText(/description/i), "Dogs picked up near the market gate.");
    await user.click(screen.getByRole("button", { name: /capture location/i }));
    await user.click(await screen.findByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Visit recorded.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not file a second visit when the officer submits again: the same request id is reused", async () => {
    createVisit.mockResolvedValue({ id: "v1" });
    const user = await fileWithDogs();
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(createVisit).toHaveBeenCalledTimes(2));
    expect(createVisit.mock.calls[1][1]).toBe(createVisit.mock.calls[0][1]);
  });

  it("says it in Hindi", async () => {
    createVisit.mockResolvedValue({ id: "v1" });
    await fileWithDogs("hi");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("विवरण सहेजे नहीं गए");
    expect(alert.textContent).toContain("पकड़े गए कुत्ते: 4");
  });
});
