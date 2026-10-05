import { Field, Input, Panel, Notice } from "../ui";
import { useState, useContext, useRef } from "react";
import { mutationIntent, type MutationIntent } from "../mutation";
import services from "../../shared/services.json";
import { todayIST } from "../../domain/ledger";
import { api } from "../api";
import { Language, useText, runtimeText } from "../i18n";
export default function InitialBalances({ onSaved }: { onSaved: () => void }) {
  const t = useText(),
    lang = useContext(Language);
  const intent = useRef<MutationIntent | null>(null);
  const [date, setDate] = useState(todayIST()),
    [balances, setBalances] = useState(
      services.map((s) => ({
        serviceId: s.id,
        opening: { service: 0, complaints: 0, field: 0 },
      })),
    ),
    [confirmed, setConfirmed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Panel className="panel">
      <div className="section-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
        <div>
          <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
            {t("OFFICE SETUP", "कार्यालय सेटअप")}
          </div>
          <h2 className="ux4g-heading-m-strong">
            {t("Set opening balances", "प्रारंभिक शेष दर्ज करें")}
          </h2>
        </div>
      </div>
      <p>
        {t(
          "Confirm pending service work, complaints and field tasks for all 25 services before the reporting start date. These balances carry forward automatically.",
          "रिपोर्टिंग प्रारंभ तिथि से पहले सभी 25 सेवाओं के लंबित कार्य, शिकायतें और क्षेत्रीय कार्य की पुष्टि करें। ये शेष स्वतः आगे बढ़ेंगे।",
        )}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const command = {
              expectedVersion: null,
              startDate: date,
              balances,
              reason: null,
            };
            intent.current = mutationIntent(intent.current, command);
            await api("/office/setup", "PUT", {
              ...command,
              requestId: intent.current.requestId,
            });
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field className="short-field">
          {t("Reporting start date", "रिपोर्टिंग प्रारंभ तिथि")}
          <input
            type="date"
            required
            max={todayIST()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <div className="table-wrap ux4g-table-responsive">
          <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows">
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
                    <span className="service-number ux4g-label-m-default ux4g-text-neutral-secondary">
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
                        value={balances[i].opening[k]}
                        onChange={(e) =>
                          setBalances(
                            balances.map((b, j) =>
                              j === i
                                ? {
                                    ...b,
                                    opening: {
                                      ...b.opening,
                                      [k]:
                                        e.target.value === ""
                                          ? NaN
                                          : Number(e.target.value),
                                    },
                                  }
                                : b,
                            ),
                          )
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Field className="checkbox">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
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
        <button
          className="ux4g-btn ux4g-btn-l ux4g-btn-primary "
          disabled={!confirmed || busy}
        >
          {busy
            ? t("Saving…", "सहेजा जा रहा है…")
            : t("Save opening balances", "प्रारंभिक शेष सहेजें")}
        </button>
      </form>
    </Panel>
  );
}
