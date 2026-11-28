import { Field } from "../../ui";
import { useContext } from "react";
import { Language, useText } from "../../i18n";
import { ANCHAL_MAX, ANCHAL_MIN } from "../../../domain/visit";
import { DAILY_SERVICES, displayNumber } from "../../../domain/daily-entry-order";

export function AnchalFilter({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | undefined;
  onChange: (officeId: number | undefined) => void;
}) {
  const t = useText();
  const anchal = t("Anchal", "अंचल");
  const numbers = Array.from({ length: ANCHAL_MAX - ANCHAL_MIN + 1 }, (_, i) => ANCHAL_MIN + i);
  return (
    <Field>
      {anchal}
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}>
        <option value="">{t("All offices", "सभी कार्यालय")}</option>
        {numbers.map((n) => (
          <option key={n} value={n}>
            {anchal} {n}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function ServiceFilter({
  id,
  value,
  onChange,
  services,
  allLabel,
}: {
  id: string;
  value: number | undefined;
  onChange: (serviceId: number | undefined) => void;
  services: typeof DAILY_SERVICES;
  allLabel: string;
}) {
  const t = useText();
  const lang = useContext(Language);
  return (
    <Field>
      {t("Service", "सेवा")}
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}>
        <option value="">{allLabel}</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {`${displayNumber(s.id)} · ${lang === "hi" ? s.name : s.en}`}
          </option>
        ))}
      </select>
    </Field>
  );
}
