// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Language } from "../../src/client/i18n";
import PeriodPicker, { CHART_PERIODS } from "../../src/client/pages/dashboard/PeriodPicker";
import { todayIST } from "../../src/domain/ledger";
import type { PeriodKind, PeriodValue } from "../../src/domain/period";

function Host({ kinds, seen, lang = "en" }: { kinds?: readonly PeriodKind[]; seen: (v: PeriodValue) => void; lang?: "en" | "hi" }) {
  const [value, setValue] = useState<PeriodValue>({ kind: kinds?.[0] ?? "today", from: "", to: "" });
  return (
    <Language.Provider value={lang}>
      <PeriodPicker name="t" kinds={kinds} value={value} onChange={(v) => { setValue(v); seen(v); }} />
    </Language.Provider>
  );
}

const buttons = () => within(screen.getByRole("group")).getAllByRole("button").map((b) => b.textContent);
const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

afterEach(() => cleanup());

describe("the period picker", () => {
  it("offers the four periods as buttons and marks the one chosen", async () => {
    const seen = vi.fn();
    render(<Host seen={seen} />);
    expect(screen.getByRole("group", { name: "Period" })).toBeTruthy();
    expect(buttons()).toEqual(["Today", "Past 7 days", "This month", "Custom"]);
    expect(pressed("Today")).toBe("true");

    await userEvent.setup().click(screen.getByRole("button", { name: "This month" }));

    expect(seen).toHaveBeenLastCalledWith({ kind: "month", from: "", to: "" });
    expect(pressed("This month")).toBe("true");
    expect(pressed("Today")).toBe("false");
  });

  it("asks for two dates only when the period is custom, neither after today", async () => {
    const seen = vi.fn();
    render(<Host seen={seen} />);
    expect(screen.queryByLabelText("From date")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: "Custom" }));
    const from = screen.getByLabelText("From date") as HTMLInputElement;
    const to = screen.getByLabelText("To date") as HTMLInputElement;
    expect(from.type).toBe("date");
    expect(from.max).toBe(todayIST());
    expect(to.max).toBe(todayIST());

    fireEvent.change(from, { target: { value: "2026-11-01" } });
    expect(seen).toHaveBeenLastCalledWith({ kind: "custom", from: "2026-11-01", to: "" });
    fireEvent.change(to, { target: { value: "2026-11-10" } });
    expect(seen).toHaveBeenLastCalledWith({ kind: "custom", from: "2026-11-01", to: "2026-11-10" });
  });

  it("offers only the periods it is given", () => {
    render(<Host kinds={CHART_PERIODS} seen={vi.fn()} />);
    expect(buttons()).toEqual(["Past 7 days", "This month", "Custom"]);
  });

  it("speaks Hindi", () => {
    render(<Host seen={vi.fn()} lang="hi" />);
    expect(screen.getByRole("group", { name: "अवधि" })).toBeTruthy();
    expect(buttons()).toEqual(["आज", "पिछले 7 दिन", "इस माह", "कस्टम"]);
  });
});
