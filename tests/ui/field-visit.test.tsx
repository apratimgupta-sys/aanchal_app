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
    screen.getByLabelText(/issue/i),
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
    await user.type(screen.getByLabelText(/issue/i), "Drain blocked near the school gate.");
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
    expect((screen.getByLabelText(/issue/i) as HTMLTextAreaElement).value).toContain("Fogging done");
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
    const field = screen.getByLabelText(/issue/i);
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
