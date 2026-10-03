import { Field, Panel, Notice } from "../ui";
import { useState, useContext } from "react";
import { api } from "../api";
import { useText, Language, runtimeText } from "../i18n";
export default function Login({ onLogin }: { onLogin: () => void }) {
  const t = useText(),
    lang = useContext(Language);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main id="main-content" tabIndex={-1} className="login-layout">
      <section className="login-intro">
        <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
          RANCHI MUNICIPAL CORPORATION
        </div>
        <h1 className="ux4g-display-s-strong">
          {t(
            "One place for daily reporting.",
            "दैनिक रिपोर्टिंग के लिए एक पोर्टल।",
          )}
        </h1>
        <p>{t("Anchal office monitoring", "अंचल कार्यालय निगरानी")}</p>
        <div className="intro-rule ux4g-divider-horizontal" />
        <p className="intro-note ux4g-body-m-default ux4g-text-neutral-secondary">
          {t(
            "Daily service entries, outstanding work and commissioner review.",
            "दैनिक सेवा प्रविष्टियाँ, लंबित कार्य और आयुक्त समीक्षा।",
          )}
        </p>
        <div className="intro-meta ux4g-label-l-default ux4g-text-neutral-secondary ux4g-d-flex ux4g-gap-x-l ux4g-mt-l">
          <span>06 {t("Anchal offices", "अंचल कार्यालय")}</span>
          <span>25 {t("Municipal services", "नगर निगम सेवाएँ")}</span>
        </div>
      </section>
      <Panel className="login-card">
        <div className="eyebrow ux4g-label-m-strong ux4g-text-neutral-secondary">
          {t("AUTHORIZED OFFICE ACCESS", "अधिकृत कार्यालय प्रवेश")}
        </div>
        <h2 className="ux4g-heading-m-strong">
          {t("Office sign in", "कार्यालय लॉगिन")}
        </h2>
        <p>
          {t(
            "Use your Anchal office or commissioner account.",
            "अपने अंचल कार्यालय या आयुक्त खाते से प्रवेश करें।",
          )}
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/login", "POST", { username, password });
              onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field>
            {t("Username", "उपयोगकर्ता नाम")}
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field>
            {t("Password", "पासवर्ड")}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <Notice className="message" role="alert">
              {runtimeText(error, lang)}
            </Notice>
          )}
          <button
            className="ux4g-btn ux4g-btn-l ux4g-btn-primary full ux4g-w-100"
            disabled={busy}
          >
            {busy
              ? t("Signing in…", "प्रवेश जारी…")
              : t("Sign in →", "लॉगिन →")}
          </button>
        </form>
        <p className="small ux4g-body-xs-default ux4g-text-neutral-secondary">
          {t(
            "Each Anchal uses one shared office account. Contact your portal administrator for access.",
            "प्रत्येक अंचल का एक साझा कार्यालय खाता है। प्रवेश के लिए पोर्टल प्रशासक से संपर्क करें।",
          )}
        </p>
      </Panel>
    </main>
  );
}
