import { describe, expect, it } from "vitest";
import { fieldsFor } from "../../src/domain/field-visit-fields";
import services from "../../src/shared/services.json";

// The keys and types the spec's "eight forms" table lists, in its order. The
// golden twin fixture (shape-twin.test.ts) pins the same structure against the
// backend; this file pins what the reader does with it and what every field
// must carry.
const KEYS: Record<number, [string, string][]> = {
  8: [["vehicleLabour", "text"], ["street", "text"], ["wasteType", "select"], ["quantityKg", "number"]],
  9: [["team", "text"], ["vehicleNumber", "text"], ["street", "text"], ["route", "text"]],
  10: [["teamLabour", "text"], ["dogsPicked", "number"], ["dogsNeutered", "number"], ["actionLocation", "text"]],
  13: [["technician", "text"], ["street", "text"], ["poleNumber", "text"], ["workType", "select"]],
  14: [["street", "text"], ["structureType", "select"], ["lengthMetres", "number"]],
  15: [["reportingOfficer", "text"], ["areaCutSqMetres", "number"]],
  16: [["vehicle", "text"], ["team", "text"], ["street", "text"], ["treeCount", "number"]],
  17: [["team", "text"]],
};

const optionValues = (id: number, key: string) =>
  fieldsFor(id).find((f) => f.key === key)?.options?.map((o) => o.value);

describe("fieldsFor", () => {
  it.each(Object.entries(KEYS))("service %s lists its fields in the spec's order", (id, expected) => {
    expect(fieldsFor(Number(id)).map((f) => [f.key, f.type])).toEqual(expected);
  });

  it("returns [] for a counter service and for an unknown id", () => {
    expect(fieldsFor(1)).toEqual([]);
    expect(fieldsFor(12)).toEqual([]);
    expect(fieldsFor(999)).toEqual([]);
    expect(fieldsFor(0)).toEqual([]);
  });

  it("returns nothing for a service outside the eight, whatever its id", () => {
    const outside = services.map((s) => s.id).filter((id) => !(id in KEYS));
    expect(outside).toHaveLength(17);
    for (const id of outside) expect(fieldsFor(id)).toEqual([]);
  });

  it("pins the three dropdowns' options exactly, in order", () => {
    expect(optionValues(8, "wasteType")).toEqual(["wet", "dry", "mixed"]);
    expect(optionValues(13, "workType")).toEqual(["repair", "replace", "shift"]);
    expect(optionValues(14, "structureType")).toEqual(["road", "drain"]);
  });

  it("gives every select at least two options and no other type any", () => {
    for (const id of Object.keys(KEYS).map(Number))
      for (const f of fieldsFor(id)) {
        if (f.type === "select") expect(f.options?.length ?? 0).toBeGreaterThanOrEqual(2);
        else expect(f.options).toBeUndefined();
      }
  });

  it("gives every field and option a non-empty English and Hindi label", () => {
    for (const id of Object.keys(KEYS).map(Number))
      for (const f of fieldsFor(id)) {
        expect(f.en.trim(), `${id}.${f.key} en`).not.toBe("");
        expect(f.hi.trim(), `${id}.${f.key} hi`).not.toBe("");
        for (const o of f.options ?? []) {
          expect(o.en.trim(), `${id}.${f.key}.${o.value} en`).not.toBe("");
          expect(o.hi.trim(), `${id}.${f.key}.${o.value} hi`).not.toBe("");
        }
      }
  });

  it("has no duplicate key inside a service, and every field is optional", () => {
    for (const id of Object.keys(KEYS).map(Number)) {
      const keys = fieldsFor(id).map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of fieldsFor(id)) expect(f.required, `${id}.${f.key}`).toBe(false);
    }
  });

  // A label comes from today's definition for every row ever filed, so a unit that
  // lives only in a label would be re-read in the new unit by every old figure (4,200
  // kg shown under "Quantity (tonnes)"). The unit is therefore part of the key: a
  // unit change is a NEW key, old rows keep the old key and the old label.
  it("puts the unit of every measurement in its key as well as its label", () => {
    const measured = [8, 9, 10, 13, 14, 15, 16, 17].flatMap((id) =>
      fieldsFor(id).filter((f) => /\([^)]+\)\s*$/.test(f.en)).map((f) => ({ id, f })),
    );
    expect(measured.map(({ f }) => f.key)).toEqual(["quantityKg", "lengthMetres", "areaCutSqMetres"]);
    for (const { id, f } of measured) {
      const unit = /\(([^)]+)\)\s*$/.exec(f.en)![1].replace(/\s+/g, "").toLowerCase();
      expect(f.key.toLowerCase().endsWith(unit), `${id}.${f.key} should end in its label's unit "${unit}"`).toBe(true);
    }
  });

  it("names the guessed units in the labels", () => {
    expect(fieldsFor(8).find((f) => f.key === "quantityKg")?.en).toBe("Quantity (kg)");
    expect(fieldsFor(14).find((f) => f.key === "lengthMetres")?.en).toBe("Length (metres)");
    expect(fieldsFor(15).find((f) => f.key === "areaCutSqMetres")?.en).toBe("Area cut (sq metres)");
  });
});

describe("whole-number counts", () => {
  it("marks exactly the three counts as integer, and no measurement", () => {
    const marked = [8, 9, 10, 13, 14, 15, 16, 17].flatMap((id) =>
      fieldsFor(id).filter((f) => f.integer).map((f) => `${id}:${f.key}`),
    );
    expect(marked).toEqual(["10:dogsPicked", "10:dogsNeutered", "16:treeCount"]);
    expect(fieldsFor(8).find((f) => f.key === "quantityKg")?.integer).toBeFalsy();
  });
});
