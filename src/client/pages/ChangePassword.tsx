import { useState, type FormEvent } from "react";
import { api, RequestError } from "../api";
import { useText } from "../i18n";
import { validatePasswordChange } from "../../domain/password";
import { Field, Input, Notice, Panel } from "../ui";

export default function ChangePassword({ onChanged }: { onChanged: () => void }) {
  const text = useText();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const messages: Record<string, string> = {
    "Enter your current password": text("Enter your current password", "अपना वर्तमान पासवर्ड दर्ज करें"),
    "Choose a password you have not used here before": text(
      "Choose a password you have not used here before",
      "ऐसा पासवर्ड चुनें जो आपने यहाँ पहले उपयोग न किया हो",
    ),
    "Both passwords must match": text("Both passwords must match", "दोनों पासवर्ड समान होने चाहिए"),
  };
  const translate = (message: string) =>
    messages[message] ??
    (message.startsWith("Use at least")
      ? text(message, message.replace(/Use at least (\d+) characters/, "कम से कम $1 अक्षर रखें"))
      : message);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    const found = validatePasswordChange(currentPassword, newPassword, confirmPassword);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await api("/password", "POST", { currentPassword, newPassword });
      onChanged();
    } catch (error) {
      setServerError(
        error instanceof RequestError
          ? error.detail.message
          : text("Could not change the password. Try again.", "पासवर्ड नहीं बदला जा सका। पुनः प्रयास करें।"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="workspace">
      <Panel>
        <h1>{text("Change your password", "पासवर्ड बदलें")}</h1>
        <p>
          {text(
            "Set a password of your own before you record any visit.",
            "कोई भी निरीक्षण दर्ज करने से पहले अपना पासवर्ड निर्धारित करें।",
          )}
        </p>
        {serverError && <Notice>{serverError}</Notice>}
        <form onSubmit={submit} noValidate>
          <Field>
            {text("Current password", "वर्तमान पासवर्ड")}
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            {errors.currentPassword && (
              <span className="field-error">{translate(errors.currentPassword)}</span>
            )}
          </Field>
          <Field>
            {text("New password", "नया पासवर्ड")}
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            {errors.newPassword && (
              <span className="field-error">{translate(errors.newPassword)}</span>
            )}
          </Field>
          <Field>
            {text("Confirm new password", "नया पासवर्ड दोहराएँ")}
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {errors.confirmPassword && (
              <span className="field-error">{translate(errors.confirmPassword)}</span>
            )}
          </Field>
          <button className="ux4g-btn ux4g-btn-l ux4g-btn-primary" type="submit" disabled={saving}>
            {saving ? text("Saving…", "सहेजा जा रहा है…") : text("Change password", "पासवर्ड बदलें")}
          </button>
        </form>
      </Panel>
    </main>
  );
}
