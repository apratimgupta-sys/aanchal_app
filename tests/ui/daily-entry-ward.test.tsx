// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DailyEntry, { wardSchema } from "../../src/client/pages/DailyEntry";

const api = vi.hoisted(() => vi.fn());
const RequestError = vi.hoisted(
  () =>
    class RequestError extends Error {
      detail: { fieldErrors?: Record<string, string> | null };
      constructor(message: string, detail: { fieldErrors?: Record<string, string> | null } = {}) {
        super(message);
        this.detail = detail;
      }
    },
);
vi.mock("../../src/client/api", () => ({ api, RequestError }));

const empty = { setup: null, entries: [], openings: [] };

// Service 1 collects Received, Disposed and an Amount, and the form will not
// submit until all three are filled. Typing the zeros is what the removed "Set
// zero activity" button used to do for the office. The amount is typed only
// where the form asks for one, so this works for any service.
async function fillZeros(
  user: ReturnType<typeof userEvent.setup>,
  received = /^applications received/i,
  disposed = /^applications disposed/i,
  amount = /^(amount collected|संग्रहित राशि)/i,
) {
  await user.type(screen.getByLabelText(received), "0");
  await user.type(screen.getByLabelText(disposed), "0");
  const money = screen.queryByLabelText(amount);
  if (money) await user.type(money, "0");
}

function renderForm(lang: "en" | "hi" = "en") {
  return render(
    <Language.Provider value={lang}>
      <DailyEntry
        officeId={1}
        mode="today"
        startDate="2020-01-01"
        onDirtyChange={() => {}}
        preserveDraftSignal={0}
        onContinueDraftInBackdate={() => {}}
      />
    </Language.Provider>,
  );
}

beforeEach(() => {
  cleanup();
  api.mockReset();
  api.mockImplementation(async (_path: string, method = "GET") => (method === "GET" ? empty : {}));
});

// Break caught: the stored string drifting from `Ward N` (one space, no leading
// zero, 1 to 53). The server enforces the same format; neither side holds a list.
describe("the ward schema", () => {
  it.each(["Ward 1", "Ward 11", "Ward 53", " Ward 11 "])("accepts %j", (ward) => {
    expect(wardSchema.safeParse(ward).success).toBe(true);
  });

  it.each([
    "Ward 0", "Ward 54", "ward 11", "Ward 011", "Ward 11, Konka",
    "Ward  11", "11", "Ward", "", "  ",
  ])("rejects %j with the message the field-visit form already translates", (ward) => {
    const parsed = wardSchema.safeParse(ward);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0].message).toBe("Select a ward from 1 to 53");
  });
});

describe("the ward picker", () => {
  it("is a labelled combobox holding the 53 wards in order, behind an empty choice", async () => {
    renderForm();
    await screen.findByText(/daily service entry/i);
    const select = screen.getByRole("combobox", { name: "Ward" }) as HTMLSelectElement;
    const options = Array.from(select.options);
    expect(options[0].value).toBe("");
    const wards = options.slice(1);
    expect(wards).toHaveLength(53);
    expect(wards[0].textContent).toBe("Ward 1");
    expect(wards[52].textContent).toBe("Ward 53");
    expect(wards.map((o) => o.value)).toEqual(wards.map((o) => o.textContent));
    expect(wards.map((o) => o.textContent)).toEqual(
      Array.from({ length: 53 }, (_, i) => `Ward ${i + 1}`),
    );
  });

  // A clerk works through 25 services every morning, so the picker must take focus.
  it("is reachable by keyboard", async () => {
    renderForm();
    await screen.findByText(/daily service entry/i);
    const select = screen.getByRole("combobox", { name: "Ward" }) as HTMLSelectElement;
    expect(select.disabled).toBe(false);
    expect(select.tabIndex).toBeGreaterThanOrEqual(0);
    select.focus();
    expect(document.activeElement).toBe(select);
  });

  it("files the chosen ward in the canonical form", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText(/daily service entry/i);
    await user.selectOptions(screen.getByRole("combobox", { name: "Ward" }), "Ward 11");
    await fillZeros(user);
    await user.click(screen.getByRole("button", { name: /submit entry/i }));
    await waitFor(() => expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(true));
    expect(api.mock.calls.find((c) => c[1] === "POST")![2].input.ward).toBe("Ward 11");
  });

  // The select is `required`, so the browser stops an empty submit before the
  // schema runs. Asserted as: the ward is the one and only control the browser
  // rejects, so a different unfilled field cannot make this pass.
  it("will not file with no ward chosen", async () => {
    const user = userEvent.setup();
    renderForm();
    await screen.findByText(/daily service entry/i);
    const select = screen.getByRole("combobox", { name: "Ward" }) as HTMLSelectElement;
    expect(select.required).toBe(true);
    expect(select.value).toBe("");
    await fillZeros(user);
    await user.click(screen.getByRole("button", { name: /submit entry/i }));
    expect(select.validity.valueMissing).toBe(true);
    expect(Array.from(document.querySelectorAll("form :invalid"))).toEqual([select]);
    expect(api.mock.calls.some((c) => c[1] === "POST")).toBe(false);
  });

  it("shows the server's ward rejection under the picker, in Hindi when asked", async () => {
    const user = userEvent.setup();
    renderForm("hi");
    const select = await screen.findByRole("combobox", { name: "वार्ड" });
    expect((select as HTMLSelectElement).options[0].textContent).toBe("वार्ड चुनें");
    api.mockImplementation(async (_path: string, method = "GET") => {
      if (method === "GET") return empty;
      throw new RequestError("Please correct the highlighted fields", {
        fieldErrors: { "input.ward": "Select a ward from 1 to 53" },
      });
    });
    await user.selectOptions(select, "Ward 11");
    await fillZeros(user, /^प्राप्त/, /^निस्तारित/);
    await user.click(screen.getByRole("button", { name: /जमा/ }));
    expect(await screen.findByText("1 से 53 के बीच वार्ड चुनें")).toBeTruthy();
  });
});
