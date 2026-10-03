import { Panel, Notice } from "../ui";
import { useEffect, useState, useContext } from "react";
import type { Audit } from "../../shared/types";
import { api } from "../api";
import { useText, Language, runtimeText } from "../i18n";
export default function ChangeHistory() {
  const t = useText(),
    lang = useContext(Language);
  const [rows, setRows] = useState<Audit[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api<Audit[]>("/history")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="page-heading ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-x-l ux4g-mb-l">
        <div>
          <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
            {t("ACCOUNTABILITY", "जवाबदेही")}
          </div>
          <h1 className="ux4g-heading-xl-strong">
            {t("Change history", "परिवर्तन इतिहास")}
          </h1>
          <p>
            {t(
              "Latest 200 recorded actions. Shared logins identify the office account, not individual staff.",
              "नवीनतम 200 दर्ज कार्रवाइयाँ। साझा लॉगिन कार्यालय खाते की पहचान करता है, व्यक्तिगत कर्मचारी की नहीं।",
            )}
          </p>
        </div>
      </div>
      {error && (
        <Notice className="message" role="alert">
          {runtimeText(error, lang)}
        </Notice>
      )}
      <Panel className="panel table-wrap">
        <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows">
          <thead>
            <tr>
              {[
                t("Date & time", "तिथि और समय"),
                t("Office", "कार्यालय"),
                t("Account", "खाता"),
                t("Action", "कार्रवाई"),
                t("Reason", "कारण"),
                t("Record changes", "रिकॉर्ड परिवर्तन"),
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {new Date(r.at).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                  })}
                </td>
                <td>
                  {t("Anchal", "अंचल")} {r.officeId}
                </td>
                <td>{r.actor}</td>
                <td>{runtimeText(r.action, lang)}</td>
                <td>{r.reason || "—"}</td>
                <td>
                  <details>
                    <summary className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-l">
                      {t("View before / after", "पहले / बाद देखें")}
                    </summary>
                    <div className="audit-values">
                      <strong>{t("Before", "पहले")}</strong>
                      <pre>
                        {r.before
                          ? JSON.stringify(JSON.parse(r.before), null, 2)
                          : "—"}
                      </pre>
                      <strong>{t("After", "बाद")}</strong>
                      <pre>{JSON.stringify(JSON.parse(r.after), null, 2)}</pre>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty ux4g-body-m-default ux4g-text-neutral-secondary ux4g-p-xl">
            {t("No actions recorded yet.", "अभी कोई कार्रवाई दर्ज नहीं है।")}
          </p>
        )}
      </Panel>
    </>
  );
}
