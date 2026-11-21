// @vitest-environment jsdom
// Pins the opening-balances save path before and after the restyle. These balances
// lock permanently, per office, the first time they are saved, so the exact payload,
// the single request, the confirm gate and the bilingual strings are all load-bearing.
// Nothing here asserts a class name.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import InitialBalances from "../../src/client/pages/InitialBalances";
import { RequestError } from "../../src/client/api";
import services from "../../src/shared/services.json";

const api = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("../../src/client/api", async () => {
  const actual = await vi.importActual<typeof import("../../src/client/api")>("../../src/client/api");
  return { ...actual, api };
});
vi.mock("sonner", () => ({ toast }));

function renderBalances(lang: "en" | "hi" = "en") {
  const onSaved = vi.fn();
  render(
    <Language.Provider value={lang}>
      <InitialBalances onSaved={onSaved} />
    </Language.Provider>,
  );
  return { onSaved };
}

const confirmBox = () => screen.getByRole("checkbox") as HTMLInputElement;
const saveButton = () => screen.getByRole("button", { name: /Save opening balances|प्रारंभिक शेष सहेजें/ }) as HTMLButtonElement;

beforeEach(() => {
  cleanup();
  api.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("InitialBalances", () => {
  it("has 25 services with three figure inputs each, labelled for assistive tech", () => {
    renderBalances();
    expect(screen.getByRole("heading", { name: "Set opening balances" })).toBeTruthy();
    for (const s of services) {
      for (const k of ["service", "complaints", "field"]) {
        const input = screen.getByLabelText(`${s.id} ${k}`) as HTMLInputElement;
        expect(input.type).toBe("number");
        expect(input.value).toBe("0");
        expect(input.min).toBe("0");
        expect(input.max).toBe("1000000000");
      }
    }
    expect(screen.getAllByRole("spinbutton")).toHaveLength(75);
  });

  it("does not let the first, permanent save happen until the clerk confirms", async () => {
    const user = userEvent.setup();
    renderBalances();
    expect(saveButton().disabled).toBe(true);
    await user.click(confirmBox());
    expect(saveButton().disabled).toBe(false);
    await user.click(confirmBox());
    expect(saveButton().disabled).toBe(true);
    expect(api).not.toHaveBeenCalled();
  });

  it("saves once, with exactly the locked payload, and reports success", async () => {
    api.mockResolvedValue({});
    const user = userEvent.setup();
    const { onSaved } = renderBalances();
    const date = screen.getByLabelText(/^Reporting start date/) as HTMLInputElement;
    await user.clear(screen.getByLabelText("3 service"));
    await user.type(screen.getByLabelText("3 service"), "12");
    await user.clear(screen.getByLabelText("25 field"));
    await user.type(screen.getByLabelText("25 field"), "1234567");
    await user.click(confirmBox());
    await user.click(saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledTimes(1);
    const [path, method, body] = api.mock.calls[0];
    expect(path).toBe("/office/setup");
    expect(method).toBe("PUT");
    expect(Object.keys(body).sort()).toEqual(["balances", "expectedVersion", "reason", "requestId", "startDate"]);
    expect(body.expectedVersion).toBeNull();
    expect(body.reason).toBeNull();
    expect(body.startDate).toBe(date.value);
    expect(typeof body.requestId).toBe("string");
    expect(body.balances).toHaveLength(25);
    expect(body.balances[2]).toEqual({ serviceId: 3, opening: { service: 12, complaints: 0, field: 0 } });
    expect(body.balances[24]).toEqual({ serviceId: 25, opening: { service: 0, complaints: 0, field: 1234567 } });
    expect(body.balances[0]).toEqual({ serviceId: 1, opening: { service: 0, complaints: 0, field: 0 } });
    expect(toast.success).toHaveBeenCalledWith("Opening balances saved");
  });

  it("refuses a negative or oversize figure and sends nothing", async () => {
    const user = userEvent.setup();
    renderBalances();
    await user.clear(screen.getByLabelText("1 service"));
    await user.type(screen.getByLabelText("1 service"), "-5");
    await user.click(confirmBox());
    await user.click(saveButton());
    expect(await screen.findByText("Please correct the highlighted fields.")).toBeTruthy();
    expect(screen.getByText("Enter a number of 0 or more")).toBeTruthy();
    expect(screen.getByLabelText("1 service").getAttribute("aria-invalid")).toBe("true");
    expect(api).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Could not save opening balances");
  });

  it("refuses a missing start date", async () => {
    const user = userEvent.setup();
    renderBalances();
    await user.clear(screen.getByLabelText(/^Reporting start date/));
    await user.click(confirmBox());
    await user.click(saveButton());
    expect(await screen.findByText("Reporting start date is required")).toBeTruthy();
    expect(screen.getByLabelText(/^Reporting start date/).getAttribute("aria-invalid")).toBe("true");
    expect(api).not.toHaveBeenCalled();
  });

  it("shows the server's refusal against the field it names, and does not call it saved", async () => {
    api.mockRejectedValue(
      new RequestError({ message: "Opening balances are already set", fieldErrors: { "balances[4].opening.complaints": "Enter a number of 0 or more" } } as never, 409),
    );
    const user = userEvent.setup();
    const { onSaved } = renderBalances();
    await user.click(confirmBox());
    await user.click(saveButton());
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Enter a number of 0 or more")).toBeTruthy();
    expect(screen.getByLabelText("5 complaints").getAttribute("aria-invalid")).toBe("true");
    expect(onSaved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Could not save opening balances");
    expect(saveButton().disabled).toBe(false);
  });

  it("reuses the request id when the same payload is sent again after a failure", async () => {
    api.mockRejectedValueOnce(new Error("Network down")).mockResolvedValueOnce({});
    const user = userEvent.setup();
    const { onSaved } = renderBalances();
    await user.click(confirmBox());
    await user.click(saveButton());
    await screen.findByRole("alert");
    await user.click(saveButton());
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls[1][2].requestId).toBe(api.mock.calls[0][2].requestId);
  });

  it("speaks Hindi: heading, column heads, confirmation and button", async () => {
    renderBalances("hi");
    expect(screen.getByRole("heading", { name: "प्रारंभिक शेष दर्ज करें" })).toBeTruthy();
    for (const head of ["सेवा", "लंबित कार्य", "लंबित शिकायतें", "लंबित क्षेत्रीय कार्य"])
      expect(screen.getAllByText(head).length).toBeGreaterThan(0);
    expect(screen.getByText("मैं शून्य शेष सहित सभी प्रारंभिक शेष की पुष्टि करता/करती हूँ।")).toBeTruthy();
    expect(saveButton().textContent).toBe("प्रारंभिक शेष सहेजें");
    expect(screen.getByLabelText(/^रिपोर्टिंग प्रारंभ तिथि/)).toBeTruthy();
  });

  it("is not its own main landmark: the app supplies one", () => {
    renderBalances();
    expect(screen.queryByRole("main")).toBeNull();
    expect(within(document.body).getByLabelText("Opening balances table")).toBeTruthy();
  });
});
