import { Field, Panel, Notice } from "../ui";
import { useContext } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { api } from "../api";
import { useText, Language, runtimeText } from "../i18n";
const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
type LoginValues = z.infer<typeof loginSchema>;
export default function Login({ onLogin }: { onLogin: () => void }) {
  const t = useText(),
    lang = useContext(Language);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: "", password: "" } });
  const onSubmit = async (values: LoginValues) => {
    try {
      await api("/login", "POST", values);
      toast.success(t("Signed in successfully", "सफलतापूर्वक प्रवेश हुआ"));
      onLogin();
    } catch (e) {
      const message = (e as Error).message;
      setError("root", { message });
      toast.error(t("Sign in failed", "प्रवेश असफल"));
    }
  };
  return (
    <main id="main-content" tabIndex={-1} className="login-layout">
      <Panel className="login-card">
        <div className="eyebrow ui-eyebrow">
          {t("AUTHORIZED OFFICE ACCESS", "अधिकृत कार्यालय प्रवेश")}
        </div>
        <h2 className="ui-heading">
          {t("Office sign in", "कार्यालय लॉगिन")}
        </h2>
        <p>
          {t(
            "Use your Anchal office or commissioner account.",
            "अपने अंचल कार्यालय या आयुक्त खाते से प्रवेश करें।",
          )}
        </p>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field>
            {t("Username", "उपयोगकर्ता नाम")}
            <input
              autoComplete="username"
              {...register("username")}
            />
            {errors.username && <span className="field-error">{t("Username is required", "उपयोगकर्ता नाम आवश्यक है")}</span>}
          </Field>
          <Field>
            {t("Password", "पासवर्ड")}
            <input
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && <span className="field-error">{t("Password is required", "पासवर्ड आवश्यक है")}</span>}
          </Field>
          {errors.root && (
            <Notice className="message" role="alert">
              {runtimeText(errors.root.message ?? "", lang)}
            </Notice>
          )}
          <button
            className="ui-button ui-button-primary full"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("Signing in…", "प्रवेश जारी…")
              : t("Sign in →", "लॉगिन →")}
          </button>
        </form>
        <p className="small ui-muted-copy">
          {t(
            "Each Anchal uses one shared office account. Contact your portal administrator for access.",
            "प्रत्येक अंचल का एक साझा कार्यालय खाता है। प्रवेश के लिए पोर्टल प्रशासक से संपर्क करें।",
          )}
        </p>
      </Panel>
    </main>
  );
}
