import { useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { OfficerProfile } from "../../shared/types";
import {
  createOfficer,
  listOfficers,
  resetOfficerPassword,
  setOfficerActive,
  type NewOfficer,
} from "../officers";
import { Language, runtimeText, useText } from "../i18n";
import { Field, Notice, Panel } from "../legacy-ui";
import { RequestError } from "../api";

const ANCHALS = [1, 2, 3, 4, 5, 6];

export default function Officers() {
  const text = useText();
  const lang = useContext(Language);
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const failed = (fallback: string) => (error: unknown) =>
    setActionError(
      error instanceof RequestError ? runtimeText(error.detail.message, lang) : fallback,
    );
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [homeOfficeId, setHomeOfficeId] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<OfficerProfile | null>(null);
  const [resetting, setResetting] = useState<OfficerProfile | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["officers"],
    queryFn: listOfficers,
  });

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["officers"] });

  const create = useMutation({
    mutationFn: (officer: NewOfficer) => createOfficer(officer),
    onError: failed(text("Could not add the officer. Try again.", "अधिकारी जोड़ा नहीं जा सका। पुनः प्रयास करें।")),
    onSuccess: (result) => {
      setActionError(null);
      setTemporaryPassword(result.temporaryPassword);
      setUsername("");
      setName("");
      setDesignation("");
      refresh();
    },
  });

  const active = useMutation({
    mutationFn: ({ id, next }: { id: string; next: boolean }) => setOfficerActive(id, next),
    onError: failed(text("Could not change the officer. Try again.", "अधिकारी नहीं बदला जा सका। पुनः प्रयास करें।")),
    onSuccess: () => {
      setActionError(null);
      setDeactivating(null);
      refresh();
    },
  });

  const reset = useMutation({
    mutationFn: (id: string) => resetOfficerPassword(id),
    onError: failed(text("Could not reset the password. Try again.", "पासवर्ड रीसेट नहीं हो सका। पुनः प्रयास करें।")),
    onSuccess: (result) => {
      setActionError(null);
      setResetting(null);
      setTemporaryPassword(result.temporaryPassword);
    },
  });

  function add() {
    const found: Record<string, string> = {};
    if (!username.trim()) found.username = text("Enter a username", "उपयोगकर्ता नाम दर्ज करें");
    if (!name.trim()) found.name = text("Enter the officer's name", "अधिकारी का नाम दर्ज करें");
    if (!designation.trim())
      found.designation = text("Enter a designation", "पदनाम दर्ज करें");
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    create.mutate({
      username: username.trim(),
      name: name.trim(),
      designation: designation.trim(),
      homeOfficeId,
    });
  }

  return (
    <main id="main-content" tabIndex={-1} className="workspace">
      <Panel>
        <h1>{text("Field officers", "क्षेत्रीय अधिकारी")}</h1>

        {actionError && <Notice>{actionError}</Notice>}

        {temporaryPassword && (
          <Notice role="status">
            <p>{text("Temporary password", "अस्थायी पासवर्ड")}</p>
            <p className="temp-password"><code>{temporaryPassword}</code></p>
            <p>
              {text(
                "Hand this to the officer now. It will not be shown again.",
                "यह अभी अधिकारी को दें। इसे दोबारा नहीं दिखाया जाएगा।",
              )}
            </p>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
              onClick={() => setTemporaryPassword(null)}
            >
              {text("Dismiss", "बंद करें")}
            </button>
          </Notice>
        )}

        <h2>{text("Add an officer", "अधिकारी जोड़ें")}</h2>
        <Field>
          {text("Username", "उपयोगकर्ता नाम")}
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
          {errors.username && <span className="field-error">{errors.username}</span>}
        </Field>
        <Field>
          {text("Name", "नाम")}
          <input value={name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </Field>
        <Field>
          {text("Designation", "पदनाम")}
          <input value={designation} onChange={(e) => setDesignation(e.target.value)} />
          {errors.designation && <span className="field-error">{errors.designation}</span>}
        </Field>
        <Field>
          {text("Home Anchal", "मूल अंचल")}
          <select value={homeOfficeId} onChange={(e) => setHomeOfficeId(Number(e.target.value))}>
            {ANCHALS.map((id) => (
              <option key={id} value={id}>{`${text("Anchal", "अंचल")} ${id}`}</option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="ux4g-btn ux4g-btn-l ux4g-btn-primary"
          onClick={add}
          disabled={create.isPending}
        >
          {text("Add officer", "अधिकारी जोड़ें")}
        </button>

        {isPending && <p>{text("Loading…", "लोड हो रहा है…")}</p>}
        {isError && (
          <Notice>{text("Could not load officers. Try again.", "अधिकारी लोड नहीं हो सके। पुनः प्रयास करें।")}</Notice>
        )}
        {data && (
          <ul className="officer-list">
            {data.map((row) => (
              <li key={row.id} className={row.active ? "" : "is-inactive"}>
                <strong>{row.name}</strong>
                <span>{row.designation}</span>
                <span>{`${text("Anchal", "अंचल")} ${row.homeOfficeId}`}</span>
                <span>{row.username}</span>
                <span>
                  {row.active ? text("Active", "सक्रिय") : text("Inactive", "निष्क्रिय")}
                </span>
                {row.active ? (
                  <button
                    type="button"
                    className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
                    onClick={() => setDeactivating(row)}
                  >
                    {text("Deactivate", "निष्क्रिय करें")}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
                    onClick={() => active.mutate({ id: row.id, next: true })}
                  >
                    {text("Reactivate", "पुनः सक्रिय करें")}
                  </button>
                )}
                <button
                  type="button"
                  className="ux4g-btn ux4g-btn-s ux4g-btn-outline-neutral"
                  onClick={() => {
                    setActionError(null);
                    setResetting(row);
                  }}
                >
                  {text("Reset password", "पासवर्ड रीसेट करें")}
                </button>
              </li>
            ))}
          </ul>
        )}

        {resetting && (
          <div className="void-dialog" role="dialog" aria-label={text("Reset password", "पासवर्ड रीसेट करें")}>
            <p>
              {text(
                `${resetting.name} will not be able to sign in with their current password. Hand them the new one.`,
                `${resetting.name} अपने वर्तमान पासवर्ड से लॉगिन नहीं कर सकेंगे। उन्हें नया पासवर्ड दें।`,
              )}
            </p>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-l ux4g-btn-primary"
              onClick={() => reset.mutate(resetting.id)}
              disabled={reset.isPending}
            >
              {text("Confirm", "पुष्टि करें")}
            </button>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
              onClick={() => setResetting(null)}
            >
              {text("Cancel", "रद्द करें")}
            </button>
          </div>
        )}

        {deactivating && (
          <div className="void-dialog" role="dialog" aria-label={text("Deactivate officer", "अधिकारी निष्क्रिय करें")}>
            <p>
              {text(
                `${deactivating.name} will not be able to sign in or record visits.`,
                `${deactivating.name} न तो लॉगिन कर सकेंगे न निरीक्षण दर्ज कर सकेंगे।`,
              )}
            </p>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-l ux4g-btn-primary"
              onClick={() => active.mutate({ id: deactivating.id, next: false })}
            >
              {text("Confirm", "पुष्टि करें")}
            </button>
            <button
              type="button"
              className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
              onClick={() => setDeactivating(null)}
            >
              {text("Cancel", "रद्द करें")}
            </button>
          </div>
        )}
      </Panel>
    </main>
  );
}
