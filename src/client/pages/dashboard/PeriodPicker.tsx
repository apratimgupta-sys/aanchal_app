import { Button, Field } from "../../ui";
import { useText } from "../../i18n";
import { todayIST } from "../../../domain/ledger";
import type { PeriodKind, PeriodValue } from "../../../domain/period";

export const ALL_PERIODS: readonly PeriodKind[] = ["today", "week", "month", "custom"];
export const CHART_PERIODS: readonly PeriodKind[] = ["week", "month", "custom"];

export default function PeriodPicker({
  name,
  value,
  onChange,
  kinds = ALL_PERIODS,
}: {
  name: string;
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
  kinds?: readonly PeriodKind[];
}) {
  const t = useText();
  const label: Record<PeriodKind, string> = {
    today: t("Today", "आज"),
    week: t("Past 7 days", "पिछले 7 दिन"),
    month: t("This month", "इस माह"),
    custom: t("Custom", "कस्टम"),
  };
  return (
    <>
      <div role="group" aria-label={t("Period", "अवधि")} className="flex flex-wrap items-center gap-2">
        {kinds.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant={value.kind === kind ? undefined : "outline"}
            aria-pressed={value.kind === kind}
            onClick={() => onChange({ ...value, kind })}
          >
            {label[kind]}
          </Button>
        ))}
      </div>
      {value.kind === "custom" && (
        <>
          <Field>
            {t("From date", "प्रारंभ तिथि")}
            <input
              id={`${name}-from`}
              type="date"
              max={todayIST()}
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </Field>
          <Field>
            {t("To date", "अंतिम तिथि")}
            <input
              id={`${name}-to`}
              type="date"
              max={todayIST()}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </Field>
        </>
      )}
    </>
  );
}
