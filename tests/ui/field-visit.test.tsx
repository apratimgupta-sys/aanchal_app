// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderForm(lang: "en" | "hi" = "en") {
  render(
    <Language.Provider value={lang}>
      <FieldVisit officer={officer} today="2026-11-19" />
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
    createVisit.mockResolvedValue({ id: "v1", verifiedOnSite: true, receivedAt: "2026-11-19T05:01:00.000Z" });
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
