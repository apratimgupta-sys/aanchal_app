import { Button, Field, FieldError, Input, Notice, Panel, Table, Td, Th, cardTable, cardTableWrap, cardTitle, leadingBody, leadingHeading, leadingHelp, useScrollRegion } from "../ui";
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
    lang = useContext(Language),
    scrollRegion = useScrollRegion();
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
  const heads = [t("Service", "सेवा"), t("Pending work", "लंबित कार्य"), t("Pending complaints", "लंबित शिकायतें"), t("Pending field tasks", "लंबित क्षेत्रीय कार्य")];
  return (
    <div className="grid min-w-0 gap-6">
      <header className="grid gap-1.5">
        <div className={`text-[11px] font-medium uppercase tracking-[0.05em] [html[lang=hi]_&]:tracking-normal ${leadingBody} text-muted-foreground`}>
          {t("OFFICE SETUP", "कार्यालय सेटअप")}
        </div>
        <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>
          {t("Set opening balances", "प्रारंभिक शेष दर्ज करें")}
        </h1>
        <p className={`max-w-3xl text-[13.5px] ${leadingBody} text-muted-foreground`}>
          {t(
            "Confirm pending service work, complaints and field tasks for all 25 services before the reporting start date. These balances carry forward automatically.",
            "रिपोर्टिंग प्रारंभ तिथि से पहले सभी 25 सेवाओं के लंबित कार्य, शिकायतें और क्षेत्रीय कार्य की पुष्टि करें। ये शेष स्वतः आगे बढ़ेंगे।",
          )}
        </p>
      </header>
      <form className="grid min-w-0 gap-6" onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
        <Panel className="sm:max-w-sm">
          <Field>
            {t("Reporting start date", "रिपोर्टिंग प्रारंभ तिथि")}
            <input
              type="date"
              required
              max={todayIST()}
              aria-invalid={errors.date ? true : undefined}
              {...register("date")}
            />
            {errors.date && <FieldError>{runtimeText(errors.date.message ?? "", lang)}</FieldError>}
          </Field>
        </Panel>
        <Table
          role="table"
          className={cardTable}
          containerClassName={cardTableWrap}
          containerProps={scrollRegion(t("Opening balances table", "प्रारंभिक शेष तालिका"))}
        >
          <thead role="rowgroup">
            <tr role="row">
              {heads.map((h, i) => (
                <Th key={h} className={i === 0 ? "lg:w-[42%]" : "lg:text-right"}>{h}</Th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup">
            {services.map((s, i) => (
              <tr role="row" key={s.id}>
                <Td label={heads[0]} className={`${cardTitle} lg:align-middle`}>
                  <span className="flex items-baseline gap-3 lg:min-h-[44px] lg:items-center">
                    <span className={`font-mono text-xs ${leadingHelp} tabular-nums text-muted-foreground`}>
                      {String(s.id).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 [overflow-wrap:anywhere]">{lang === "hi" ? s.name : s.en}</span>
                  </span>
                </Td>
                {(["service", "complaints", "field"] as const).map((k, n) => (
                  <Td key={k} label={heads[n + 1]}>
                    <div className="grid min-w-0 justify-items-end gap-1">
                      <Input
                        width="count"
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
                        <FieldError className="text-right">
                          {runtimeText(errors.balances[i]?.opening?.[k]?.message ?? "", lang)}
                        </FieldError>
                      )}
                    </div>
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        <Panel className="bg-muted">
          <Field>
            <input type="checkbox" {...register("confirmed")} />
            {t(
              "I confirm all opening balances, including zero balances.",
              "मैं शून्य शेष सहित सभी प्रारंभिक शेष की पुष्टि करता/करती हूँ।",
            )}
          </Field>
        </Panel>
        {error && <Notice role="alert">{runtimeText(error, lang)}</Notice>}
        <div className="flex justify-end max-sm:[&>button]:w-full">
          <Button disabled={!confirmed || isSubmitting}>
            {isSubmitting
              ? t("Saving…", "सहेजा जा रहा है…")
              : t("Save opening balances", "प्रारंभिक शेष सहेजें")}
          </Button>
        </div>
      </form>
    </div>
  );
}
