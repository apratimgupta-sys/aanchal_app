// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language } from "../../src/client/i18n";
import DayChart, { dayLabel } from "../../src/client/pages/dashboard/charts/DayChart";

type Day = { date: string; values: number[] };
const month: Day[] = Array.from({ length: 28 }, (_, i) => ({
  date: `2026-11-${String(i + 1).padStart(2, "0")}`,
  values: [400 + i, 360 + i],
}));
const two = [{ label: "Received", colour: 1 as const }, { label: "Disposed", colour: 2 as const }];
const one = [{ label: "Collected", colour: 1 as const }];
const plain = (value: number) => String(value);

function show(props: Partial<Parameters<typeof DayChart>[0]> = {}, lang: "en" | "hi" = "en") {
  render(
    <Language.Provider value={lang}>
      <DayChart kind="lines" title="Received and disposed per day" days={month} series={two} format={plain} {...props} />
    </Language.Provider>,
  );
}
const all = (selector: string) => Array.from(document.querySelectorAll(selector));

afterEach(() => cleanup());

describe("the day chart", () => {
  it("is one named image, with a line and an end label for each series and a legend naming both", () => {
    show();

    expect(screen.getByRole("img", { name: "Received and disposed per day" })).toBeTruthy();
    expect(all("polyline[data-line]")).toHaveLength(2);
    expect(all("[data-end-label]").map((e) => e.textContent)).toEqual(["427", "387"]);
    expect(document.querySelector("[data-legend]")!.textContent).toContain("Received");
    expect(document.querySelector("[data-legend]")!.textContent).toContain("Disposed");
  });

  it("draws one bar per day, and no legend for a single series", () => {
    show({ kind: "bars", series: one, days: month.map((d) => ({ date: d.date, values: [d.values[0]] })) });

    expect(all("[data-bar]")).toHaveLength(28);
    expect(all("polyline[data-line]")).toHaveLength(0);
    expect(document.querySelector("[data-legend]")).toBeNull();
  });

  it("names a readable number of days on the axis and always the last", () => {
    show();
    const labels = all("[data-x-label]").map((e) => e.textContent);

    expect(labels.length).toBeLessThanOrEqual(8);
    expect(labels.at(-1)).toBe("28 Nov");
  });

  it("uses the compact form on the axis and the full form everywhere else", () => {
    show({ formatAxis: (value) => `${value / 100}h` });

    expect(all("[data-end-label]").map((e) => e.textContent)).toEqual(["4.27h", "3.87h"]);
    fireEvent.mouseEnter(all("[data-day]")[0]);
    expect(document.querySelector("[data-chart-tooltip]")!.textContent).toContain("Received 400");
  });

  it("shows a day's date and figures while the pointer or the keyboard is on it", () => {
    show();
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
    const day = all("[data-day]")[4];

    fireEvent.mouseEnter(day);
    const tip = document.querySelector("[data-chart-tooltip]")!.textContent!;
    expect(tip).toContain("5 Nov");
    expect(tip).toContain("Received 404");
    expect(tip).toContain("Disposed 364");
    fireEvent.mouseLeave(day);
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();

    fireEvent.focus(day);
    expect(document.querySelector("[data-chart-tooltip]")!.textContent).toContain("5 Nov");
    fireEvent.blur(day);
    expect(document.querySelector("[data-chart-tooltip]")).toBeNull();
  });

  it("gives every day a name a screen reader can read, and lets the keyboard reach it", () => {
    show();
    const day = all("[data-day]")[4];

    expect(all("[data-day]")).toHaveLength(28);
    expect(day.getAttribute("aria-label")).toBe("5 Nov: Received 404, Disposed 364");
    expect(day.getAttribute("tabindex")).toBe("0");
  });

  it("turns into a table of the same days and back", async () => {
    show();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "View as table" }));
    expect(screen.queryByRole("img")).toBeNull();
    const rows = Array.from(screen.getByRole("table").querySelectorAll("tbody tr"));
    expect(Array.from(screen.getByRole("table").querySelectorAll("thead th")).map((th) => th.textContent!.trim())).toEqual(["Date", "Received", "Disposed"]);
    expect(rows).toHaveLength(28);
    expect(Array.from(rows[4].querySelectorAll("td")).map((td) => td.textContent!.trim())).toEqual(["5 Nov", "404", "364"]);

    await user.click(screen.getByRole("button", { name: "View as chart" }));
    expect(screen.getByRole("img")).toBeTruthy();
  });

  it.each([
    ["no days at all", []],
    ["a single day", [{ date: "2026-11-28", values: [418, 371] }]],
    ["days with nothing filed", month.map((d) => ({ date: d.date, values: [0, 0] }))],
  ])("draws its frame for %s, with no NaN anywhere", (_, days) => {
    show({ days: days as Day[] });

    expect(screen.getByRole("img")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("NaN");
    expect(document.body.innerHTML).not.toContain("Infinity");
  });

  it("speaks Hindi, dates included", async () => {
    show({}, "hi");

    expect(all("[data-x-label]").at(-1)!.textContent).toBe(dayLabel("2026-11-28", "hi"));
    expect(dayLabel("2026-11-28", "hi")).not.toBe(dayLabel("2026-11-28", "en"));
    await userEvent.setup().click(screen.getByRole("button", { name: "तालिका के रूप में देखें" }));
    expect(screen.getByRole("table").querySelector("thead th")!.textContent!.trim()).toBe("तिथि");
    expect(screen.getByRole("button", { name: "चार्ट के रूप में देखें" })).toBeTruthy();
  });
});
