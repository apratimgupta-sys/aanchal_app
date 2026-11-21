import { Button, Field, FieldError, Input, Notice, Panel } from "../ui";
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
export default function Login({
  onLogin,
  onLanguageToggle,
  languageLabel,
}: {
  onLogin: () => void;
  onLanguageToggle: () => void;
  languageLabel: string;
}) {
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
    <main id="main-content" tabIndex={-1} className="w-full px-4 py-10 focus:outline-none sm:py-16">
      <Panel className="mx-auto grid w-full max-w-[26.25rem] gap-5 p-6 sm:p-8">
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onLanguageToggle}>
            {languageLabel}
          </Button>
        </div>
        <div className="grid gap-2">
          <div className="text-[11px] font-medium uppercase leading-[1.6] tracking-[0.08em] text-muted-foreground [html[lang=hi]_&]:tracking-normal">
            {t("AUTHORIZED OFFICE ACCESS", "अधिकृत कार्यालय प्रवेश")}
          </div>
          <h2 className="text-[23px] font-semibold leading-[1.4] text-foreground">
            {t("Office sign in", "कार्यालय लॉगिन")}
          </h2>
          <p className="text-[13.5px] leading-[1.6] text-muted-foreground">
            {t(
              "Use your Anchal office or commissioner account.",
              "अपने अंचल कार्यालय या आयुक्त खाते से प्रवेश करें।",
            )}
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
          <Field>
            {t("Username", "उपयोगकर्ता नाम")}
            <Input autoComplete="username" {...register("username")} />
            {errors.username && <FieldError>{t("Username is required", "उपयोगकर्ता नाम आवश्यक है")}</FieldError>}
          </Field>
          <Field>
            {t("Password", "पासवर्ड")}
            <Input type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <FieldError>{t("Password is required", "पासवर्ड आवश्यक है")}</FieldError>}
          </Field>
          {errors.root && <Notice role="alert">{runtimeText(errors.root.message ?? "", lang)}</Notice>}
          <Button disabled={isSubmitting} className="w-full">
            {isSubmitting ? t("Signing in…", "प्रवेश जारी…") : t("Sign in →", "लॉगिन →")}
          </Button>
        </form>
        <p className="text-xs leading-[1.6] text-muted-foreground">
          {t(
            "Each Anchal uses one shared office account. Contact your portal administrator for access.",
            "प्रत्येक अंचल का एक साझा कार्यालय खाता है। प्रवेश के लिए पोर्टल प्रशासक से संपर्क करें।",
          )}
        </p>
      </Panel>
    </main>
  );
}
