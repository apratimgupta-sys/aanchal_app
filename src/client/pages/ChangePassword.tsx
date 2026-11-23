import { useContext, useState, type FormEvent } from "react";
import { api, RequestError } from "../api";
import { Language, runtimeText, useText } from "../i18n";
import { validatePasswordChange } from "../../domain/password";
import { Button, Field, FieldError, Input, Notice, Panel, leadingBody, leadingHeading } from "../ui";

export default function ChangePassword({ onChanged, office = false }: { onChanged: () => void; office?: boolean }) {
  const text = useText();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const lang = useContext(Language);
  const translate = (message: string) => runtimeText(message, lang);

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
          ? translate(error.detail.message)
          : text("Could not change the password. Try again.", "पासवर्ड नहीं बदला जा सका। पुनः प्रयास करें।"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Rendered before the shell exists (a first-login officer has no navigation yet),
  // so this page owns the one <main>, the way Login does, and is laid out like it.
  return (
    <main id="main-content" tabIndex={-1} className="flex w-full flex-1 items-center px-4 py-10 focus:outline-none sm:py-16">
      <Panel className="mx-auto grid w-full max-w-[26.25rem] gap-5 p-6 sm:p-8">
        <div className="grid gap-2">
          <h1 className={`text-[23px] font-semibold ${leadingHeading} text-foreground`}>{text("Change your password", "पासवर्ड बदलें")}</h1>
          <p className={`text-[13.5px] ${leadingBody} text-muted-foreground`}>
            {office
              ? text(
                  "Set a password of your own before you continue.",
                  "आगे बढ़ने से पहले अपना पासवर्ड निर्धारित करें।",
                )
              : text(
                  "Set a password of your own before you record any visit.",
                  "कोई भी निरीक्षण दर्ज करने से पहले अपना पासवर्ड निर्धारित करें।",
                )}
          </p>
        </div>
        {serverError && <Notice>{serverError}</Notice>}
        <form onSubmit={submit} noValidate className="grid gap-4">
          <Field>
            {text("Current password", "वर्तमान पासवर्ड")}
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
            {errors.currentPassword && <FieldError>{translate(errors.currentPassword)}</FieldError>}
          </Field>
          <Field>
            {text("New password", "नया पासवर्ड")}
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
            {errors.newPassword && <FieldError>{translate(errors.newPassword)}</FieldError>}
          </Field>
          <Field>
            {text("Confirm new password", "नया पासवर्ड दोहराएँ")}
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            {errors.confirmPassword && <FieldError>{translate(errors.confirmPassword)}</FieldError>}
          </Field>
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? text("Saving…", "सहेजा जा रहा है…") : text("Change password", "पासवर्ड बदलें")}
          </Button>
        </form>
      </Panel>
    </main>
  );
}
