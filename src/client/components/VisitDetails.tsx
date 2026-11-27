import { fieldsFor } from "../../domain/field-visit-fields";
import { useContext } from "react";
import { Language } from "../i18n";
import type { FieldVisitView } from "../../shared/types";

// The service-specific details a visit carries, as label / value pairs. Labels and
// order come from fieldsFor, so a stored key and its label cannot drift apart.
//
// A stored key the service no longer defines is SHOWN, after the defined ones, under
// its raw key: a person typed that value, and editing the field list later must not
// make it disappear from the record. A blank value, or no details at all (every row
// filed before details existed), renders nothing: no heading, no placeholder.
export default function VisitDetails({
  serviceId,
  details,
  className = "",
}: Pick<FieldVisitView, "serviceId" | "details"> & { className?: string }) {
  const lang = useContext(Language);
  if (!details || typeof details !== "object") return null;

  const present = (key: string) => {
    const value = details[key];
    return value !== undefined && value !== null && String(value).trim() !== "";
  };
  const defined = fieldsFor(serviceId);
  const known = new Set(defined.map((f) => f.key));

  const rows: { key: string; label: string; value: string }[] = [];
  for (const field of defined) {
    if (!present(field.key)) continue;
    const stored = String(details[field.key]);
    const option = field.options?.find((o) => o.value === stored);
    rows.push({
      key: field.key,
      label: lang === "hi" ? field.hi : field.en,
      value: option ? (lang === "hi" ? option.hi : option.en) : stored,
    });
  }
  for (const key of Object.keys(details)) {
    if (!known.has(key) && present(key)) rows.push({ key, label: key, value: String(details[key]) });
  }
  if (rows.length === 0) return null;

  return (
    <dl data-testid="visit-details" className={`m-0 grid min-w-0 gap-x-3 gap-y-0.5 text-[13px] [overflow-wrap:anywhere] sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] ${className}`}>
      {rows.map((row) => (
        <div key={row.key} className="grid min-w-0 grid-cols-subgrid sm:col-span-2">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="m-0 min-w-0">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
