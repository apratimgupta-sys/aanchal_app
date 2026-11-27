import definitions from "../shared/field-visit-fields.json" with { type: "json" };

// What a field visit asks for beyond the commons (date, ward, geo-location,
// description), by service. The eight field-work services each have their own
// list; every other service has none.
//
// TWIN: MonitoringFieldDefinitions in the backend repo holds the same keys, types,
// requiredness and option values and will validate a submitted details object
// against them. The golden fixture tests/domain/shape-twin.fixture.json
// (fieldVisitFields) is committed identically in both repos and each side asserts
// its own copy against it. Labels and Hindi live here only.
//
// The unit in a label is in the label on purpose: the units are RMC's to confirm,
// and correcting one is a label edit, not a migration.
export type VisitFieldType = "text" | "textarea" | "number" | "select";

export interface VisitFieldOption {
  value: string;
  en: string;
  hi: string;
}

export interface VisitField {
  key: string;
  type: VisitFieldType;
  required: boolean;
  en: string;
  hi: string;
  options?: readonly VisitFieldOption[];
}

type RawField = (typeof definitions)[keyof typeof definitions][number];

const BY_SERVICE = new Map<number, readonly VisitField[]>(
  Object.entries(definitions).map(([id, fields]) => [
    Number(id),
    (fields as readonly (RawField & { options?: { value: string; label: { en: string; hi: string } }[] })[]).map(
      (f): VisitField => ({
        key: f.key,
        type: f.type as VisitFieldType,
        required: f.required,
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
