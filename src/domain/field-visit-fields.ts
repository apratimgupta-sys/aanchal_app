import definitions from "../shared/field-visit-fields.json" with { type: "json" };

// What a field visit asks for beyond the commons (date, ward, geo-location,
// description), by service. The eight field-work services each have their own
// list; every other service has none.
//
// TWIN: MonitoringFieldDefinitions in the backend repo holds the same keys, types,
// whole-number marker and option values and validates a submitted details object
// against them. The golden fixture tests/domain/shape-twin.fixture.json
// (fieldVisitFields) is committed identically in both repos and each side asserts
// its own copy against it. Labels and Hindi live here only.
//
// A unit is in the KEY as well as the label (quantityKg, not quantity). A label is
// read from today's definition for every row ever filed, so a unit changed in a label
// alone would re-read every old figure in the new unit. A unit change is a new key;
// rows filed under the old one keep it and are shown under it.
//
// Every field is optional and there is no flag for it: a `required` that nothing
// honoured was carried through both repos and the fixture for no effect.
export type VisitFieldType = "text" | "textarea" | "number" | "select";

export interface VisitFieldOption {
  value: string;
  en: string;
  hi: string;
}

export interface VisitField {
  key: string;
  type: VisitFieldType;
  // A number field that takes a whole number only: a count of dogs or trees, not a
  // measurement. The form's input and the server's validation both follow it.
  integer?: true;
  en: string;
  hi: string;
  options?: readonly VisitFieldOption[];
}

type RawField = (typeof definitions)[keyof typeof definitions][number];

const BY_SERVICE = new Map<number, readonly VisitField[]>(
  Object.entries(definitions).map(([id, fields]) => [
    Number(id),
    (fields as readonly (RawField & { integer?: boolean; options?: { value: string; label: { en: string; hi: string } }[] })[]).map(
      (f): VisitField => ({
        key: f.key,
        type: f.type as VisitFieldType,
        ...(f.integer ? { integer: true as const } : {}),
        en: f.label.en,
        hi: f.label.hi,
        ...(f.options
          ? { options: f.options.map((o) => ({ value: o.value, en: o.label.en, hi: o.label.hi })) }
          : {}),
      }),
    ),
  ]),
);

const NONE: readonly VisitField[] = [];

export function fieldsFor(serviceId: number): readonly VisitField[] {
  return BY_SERVICE.get(serviceId) ?? NONE;
}

/**
 * What goes into the request for one typed detail. A number is sent as a number; but
 * one that is not finite once parsed ("1e999", 400 digits, anything Number() cannot
 * read) would be Infinity or NaN, which JSON writes as null, which the server reads as
 * "left blank": a 201 with the figure gone. Such a value is sent as typed, so the
 * server refuses it on its own field and the officer is told.
 */
export function detailValue(field: Pick<VisitField, "type">, raw: string): string | number {
  if (field.type !== "number") return raw;
  const number = Number(raw);
  return Number.isFinite(number) ? number : raw;
}
