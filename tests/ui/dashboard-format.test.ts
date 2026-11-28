import { describe, expect, it } from "vitest";
import { rangeLabel } from "../../src/client/pages/dashboard/format";

describe("rangeLabel", () => {
  it("prints one date when the range is one day", () => {
    expect(rangeLabel({ from: "2026-11-28", to: "2026-11-28" }, "en")).toBe("28 Nov 2026");
  });

  it("prints both ends with an en dash when the range is a span", () => {
    expect(rangeLabel({ from: "2026-11-01", to: "2026-11-28" }, "en")).toBe("1 Nov 2026 – 28 Nov 2026");
  });

  it("keeps each end's own year across a year boundary", () => {
    expect(rangeLabel({ from: "2026-12-30", to: "2027-01-02" }, "en")).toBe("30 Dec 2026 – 2 Jan 2027");
  });

  it("prints day, month, year in Hindi with Hindi month names", () => {
    expect(rangeLabel({ from: "2026-11-28", to: "2026-11-28" }, "hi")).toBe("28 नव॰ 2026");
    expect(rangeLabel({ from: "2026-11-01", to: "2026-11-28" }, "hi")).toBe("1 नव॰ 2026 – 28 नव॰ 2026");
  });

  it("prints nothing without a range", () => {
    expect(rangeLabel(null, "en")).toBe("");
    expect(rangeLabel(null, "hi")).toBe("");
  });
});
