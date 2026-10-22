import { Field, Input, Panel, Notice } from "../ui";
import { useState, useContext, useRef } from "react";
import { useForm, type Path } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { mutationIntent, type MutationIntent } from "../mutation";
import services from "../../shared/services.json";
import { todayIST } from "../../domain/ledger";
import { api, RequestError } from "../api";
import { setupErrorTarget } from "../field-errors";
import { Language, useText, runtimeText } from "../i18n";
const validCalendarDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const balanceNumber = z
  .number({ message: "Enter a whole number from 0 to 1,000,000,000" })
  .int("Enter a whole number")
  .min(0, "Enter a number of 0 or more")
  .max(1_000_000_000, "Enter a number up to 1,000,000,000");
export const balanceSchema = z.object({
  date: z
    .string()
    .min(1, "Reporting start date is required")
    .refine((value) => value === "" || validCalendarDate(value), "Enter a valid date")
    .refine((value) => !validCalendarDate(value) || value <= todayIST(), "Reporting start date cannot be in the future"),
  confirmed: z.boolean().refine((value) => value, "Please confirm the opening balances"),
  balances: z.array(z.object({
    serviceId: z.number(),
    opening: z.object({
      service: balanceNumber,
      complaints: balanceNumber,
      field: balanceNumber,
    }),
  })).length(25),
});
type BalanceForm = z.infer<typeof balanceSchema>;
export default function InitialBalances({ onSaved }: { onSaved: () => void }) {
  const t = useText(),
    lang = useContext(Language);
  const intent = useRef<MutationIntent | null>(null);
  const [error, setError] = useState("");
  const { register, handleSubmit, watch, setError: setFieldError, formState: { isSubmitting, errors } } = useForm<BalanceForm>({
    resolver: zodResolver(balanceSchema),
    defaultValues: { date: todayIST(), confirmed: false, balances: services.map((s) => ({ serviceId: s.id, opening: { service: 0, complaints: 0, field: 0 } })) },
  });
  const date = watch("date");
  const balances = watch("balances");
  const confirmed = watch("confirmed");
  const onSubmit = async (values: BalanceForm) => {
    setError("");
    try {
      const command = { expectedVersion: null, startDate: values.date, balances: values.balances, reason: null };
      intent.current = mutationIntent(intent.current, command);
      await api("/office/setup", "PUT", { ...command, requestId: intent.current.requestId });
      toast.success(t("Opening balances saved", "प्रारंभिक शेष सहेजे गए"));
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof RequestError)
        for (const [key, message] of Object.entries(e.detail.fieldErrors ?? {})) {
          const target = setupErrorTarget(key);
          if (target) setFieldError(target as Path<BalanceForm>, { message });
        }
      toast.error(t("Could not save opening balances", "प्रारंभिक शेष सहेजे नहीं जा सके"));
    }
  };
  const onInvalid = () => {
    setError(t("Please correct the highlighted fields.", "कृपया चिह्नित फ़ील्ड ठीक करें।"));
    toast.error(t("Could not save opening balances", "प्रारंभिक शेष सहेजे नहीं जा सके"));
  };
  return (
    <Panel className="panel setup-panel">
      <div className="section-heading setup-heading">
        <div>
          <div className="eyebrow">
            {t("OFFICE SETUP", "कार्यालय सेटअप")}
          </div>
          <h2 className="section-title">
            {t("Set opening balances", "प्रारंभिक शेष दर्ज करें")}
          </h2>
        </div>
      </div>
      <p className="setup-intro">
        {t(
          "Confirm pending service work, complaints and field tasks for all 25 services before the reporting start date. These balances carry forward automatically.",
          "रिपोर्टिंग प्रारंभ तिथि से पहले सभी 25 सेवाओं के लंबित कार्य, शिकायतें और क्षेत्रीय कार्य की पुष्टि करें। ये शेष स्वतः आगे बढ़ेंगे।",
        )}
      </p>
      <form className="setup-form" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
        <Field className="short-field setup-date">
          {t("Reporting start date", "रिपोर्टिंग प्रारंभ तिथि")}
          <input
            type="date"
            required
            max={todayIST()}
            aria-invalid={errors.date ? true : undefined}
            {...register("date")}
          />
          {errors.date && (
            <small className="field-error">{runtimeText(errors.date.message ?? "", lang)}</small>
          )}
        </Field>
        <div className="table-wrap setup-table-wrap" tabIndex={0} aria-label={t("Opening balances table", "प्रारंभिक शेष तालिका")}>
          <table className="setup-table">
            <thead>
              <tr>
                <th>{t("Service", "सेवा")}</th>
                <th>{t("Pending work", "लंबित कार्य")}</th>
                <th>{t("Pending complaints", "लंबित शिकायतें")}</th>
                <th>{t("Pending field tasks", "लंबित क्षेत्रीय कार्य")}</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={s.id}>
                  <td>
                    <span className="service-number">
                      {String(s.id).padStart(2, "0")}
                    </span>
                    {lang === "hi" ? s.name : s.en}
                  </td>
                  {(["service", "complaints", "field"] as const).map((k) => (
                    <td key={k}>
                      <Input
                        aria-label={`${s.id} ${k}`}
                        type="number"
                        required
                        min="0"
                        max="1000000000"
                        step="1"
                        aria-invalid={errors.balances?.[i]?.opening?.[k] ? true : undefined}
                        {...register(`balances.${i}.opening.${k}`, { valueAsNumber: true })}
                      />
                      {errors.balances?.[i]?.opening?.[k] && (
                        <small className="field-error">
                          {runtimeText(errors.balances[i]?.opening?.[k]?.message ?? "", lang)}
                        </small>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Field className="checkbox setup-confirmation">
          <input
            type="checkbox"
            {...register("confirmed")}
          />
          {t(
            "I confirm all opening balances, including zero balances.",
            "मैं शून्य शेष सहित सभी प्रारंभिक शेष की पुष्टि करता/करती हूँ।",
          )}
        </Field>
        {error && (
          <Notice role="alert" className="message">
            {runtimeText(error, lang)}
          </Notice>
        )}
        <div className="setup-actions">
          <button className="ui-button ui-button-primary" disabled={!confirmed || isSubmitting}>
          {isSubmitting
            ? t("Saving…", "सहेजा जा रहा है…")
            : t("Save opening balances", "प्रारंभिक शेष सहेजें")}
          </button>
        </div>
      </form>
    </Panel>
  );
}
