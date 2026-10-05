import { Panel, Notice } from "../ui";
import { useEffect, useState, useContext } from "react";
import type { Audit } from "../../shared/types";
import { api } from "../api";
import {
  auditComparison,
  auditFields,
  auditValue,
  serviceName,
} from "../audit";
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
                  <RecordChanges record={r} lang={lang} />
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

function RecordChanges({ record, lang }: { record: Audit; lang: string }) {
  const t = useText();
  const comparison = auditComparison(record.before, record.after);
  if (!comparison.valid)
    return (
      <p>
        {t("Change details unavailable.", "परिवर्तन विवरण उपलब्ध नहीं है।")}
      </p>
    );
  return (
    <div>
      {comparison.after?.serviceId != null && (
        <strong>{serviceName(comparison.after.serviceId, lang)}</strong>
      )}
      {comparison.after?.serviceDate != null && (
        <p>
          {t("Service date", "सेवा तिथि")}:{" "}
          {auditValue("serviceDate", comparison.after.serviceDate, lang)}
        </p>
      )}
      {!comparison.changes.length ? (
        <p>
          {t(
            "No entry values changed.",
            "प्रविष्टि के मानों में कोई परिवर्तन नहीं हुआ।",
          )}
        </p>
      ) : (
        <details>
          <summary className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-l">
            {record.before
              ? t(
                  `View ${comparison.changes.length} changed field${comparison.changes.length === 1 ? "" : "s"}`,
                  `${comparison.changes.length} परिवर्तित विवरण देखें`,
                )
              : t("View recorded values", "दर्ज मान देखें")}
          </summary>
          <div className="ux4g-table-responsive">
            <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows">
              <caption>{t("Record changes", "रिकॉर्ड परिवर्तन")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Field", "विवरण")}</th>
                  {record.before && (
                    <th scope="col">{t("Previous", "पहले")}</th>
                  )}
                  <th scope="col">
                    {record.before
                      ? t("Updated", "बाद")
                      : t("Recorded value", "दर्ज मान")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.changes.map((change) => (
                  <tr key={`${change.serviceId ?? "entry"}.${change.key}`}>
                    <th scope="row">
                      {change.serviceId != null && (
                        <div>{serviceName(change.serviceId, lang)}</div>
                      )}
                      {t(...auditFields[change.key])}
                    </th>
                    {record.before && (
                      <td>{auditValue(change.key, change.before, lang)}</td>
                    )}
                    <td>
                      <strong>
                        {auditValue(change.key, change.after, lang)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
