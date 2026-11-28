import { describe, expect, it } from "vitest";
import wording from "../../src/shared/visit-card-wording.json";
import services from "../../src/shared/services.json";
import { fieldsFor } from "../../src/domain/field-visit-fields";
import { reportedAsVisit } from "../../src/domain/service-kind";
import { formatCount, visitCard } from "../../src/domain/visit-cards";
import type { VisitServiceSummary } from "../../src/shared/types";

const summary = (serviceId: number, over: Partial<VisitServiceSummary> = {}): VisitServiceSummary => ({
  serviceId, visits: 0, wardsCovered: 0, numbers: [], choices: [], ...over,
});

describe("the wording of the visit cards against the visit forms", () => {
  const fieldWork = services.filter((s) => reportedAsVisit(s.id)).map((s) => String(s.id));
  type Words = { headline: { number?: string }; sub: { split?: string; number?: string } };

  it("has a card for every field-work service and for nothing else", () => {
    expect(Object.keys(wording).sort()).toEqual([...fieldWork].sort());
  });

  it("names only fields the service's form really has, of the right kind", () => {
    for (const [id, words] of Object.entries(wording as Record<string, Words>)) {
      const type = (key: string) => fieldsFor(Number(id)).find((f) => f.key === key)?.type;
      if (words.headline.number) expect(type(words.headline.number), `${id} headline`).toBe("number");
      if (words.sub.number) expect(type(words.sub.number), `${id} sub`).toBe("number");
      if (words.sub.split) expect(type(words.sub.split), `${id} split`).toBe("select");
    }
  });
});

describe("what a visit card says", () => {
  it("sums the service's number and splits it by the choice", () => {
    const card = visitCard(summary(8, {
      visits: 9, wardsCovered: 6,
      numbers: [{ key: "quantityKg", sum: 4250, visits: 9 }],
      choices: [{ key: "wasteType", options: [
        { value: "wet", visits: 4, numbers: [{ key: "quantityKg", sum: 2100, visits: 4 }] },
        { value: "dry", visits: 3, numbers: [{ key: "quantityKg", sum: 1400, visits: 3 }] },
        { value: "mixed", visits: 2, numbers: [{ key: "quantityKg", sum: 750, visits: 2 }] },
      ] }],
    }));
    expect(card.headline).toEqual({ value: 4250, en: "kg lifted", hi: "किग्रा उठाया" });
    expect(card.sub.en).toBe("Wet 2,100 · Dry 1,400 · Mixed 750");
    expect(card.sub.hi).toBe("गीला 2,100 · सूखा 1,400 · मिश्रित 750");
    expect(card.missing).toBe(0);
  });

  it("counts visits per choice where the service has no number", () => {
    const card = visitCard(summary(13, {
      visits: 7, wardsCovered: 5,
      choices: [{ key: "workType", options: [
        { value: "repair", visits: 4, numbers: [] },
        { value: "replace", visits: 2, numbers: [] },
        { value: "shift", visits: 1, numbers: [] },
      ] }],
    }));
    expect(card.headline).toEqual({ value: 7, en: "jobs", hi: "कार्य" });
    expect(card.sub.en).toBe("Repair 4 · Replace 2 · Shift 1");
  });

  it("gives a second number as the line beneath", () => {
    const card = visitCard(summary(10, {
      visits: 4, numbers: [{ key: "dogsPicked", sum: 27, visits: 4 }, { key: "dogsNeutered", sum: 20, visits: 4 }],
    }));
    expect(card.headline.value).toBe(27);
    expect(card.sub).toEqual({ en: "20 neutered", hi: "20 का बधियाकरण" });
  });

  it("names the wards covered, with the singular for one", () => {
    expect(visitCard(summary(9, { visits: 6, wardsCovered: 5 })).sub).toEqual({ en: "in 5 wards", hi: "5 वार्ड में" });
    expect(visitCard(summary(17, { visits: 1, wardsCovered: 1 })).sub.en).toBe("in 1 ward");
    expect(visitCard(summary(9, { visits: 6, wardsCovered: 5 })).headline).toEqual({ value: 6, en: "routes covered", hi: "मार्ग कवर" });
  });

  it("says how many visits gave no figure, and never for a service that counts visits", () => {
    expect(visitCard(summary(16, { visits: 5, numbers: [{ key: "treeCount", sum: 14, visits: 3 }] })).missing).toBe(2);
    expect(visitCard(summary(16, { visits: 5 })).missing).toBe(5);
    expect(visitCard(summary(9, { visits: 6 })).missing).toBe(0);
  });

  it("reads zero everywhere for a service with no visits, in the form's own option order", () => {
    const card = visitCard(summary(14));
    expect(card.headline.value).toBe(0);
    expect(card.sub.en).toBe("Road 0 · Drain 0");
    expect(card.missing).toBe(0);
  });

  it("refuses a service that has no card", () => {
    expect(() => visitCard(summary(1))).toThrow();
  });
});

describe("how a figure is printed", () => {
  it("groups the Indian way and keeps one decimal of a measurement", () => {
    expect(formatCount(125000)).toBe("1,25,000");
    expect(formatCount(200.5)).toBe("200.5");
    expect(formatCount(12.345)).toBe("12.3");
    expect(formatCount(14)).toBe("14");
  });
});
