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
    <main className="login-layout">
      <section className="login-intro">
        <div className="eyebrow">RANCHI MUNICIPAL CORPORATION</div>
        <h1>
          {t(
            "One place for daily reporting.",
            "दैनिक रिपोर्टिंग के लिए एक पोर्टल।",
          )}
        </h1>
        <p>{t("Anchal office monitoring", "अंचल कार्यालय निगरानी")}</p>
        <div className="intro-rule" />
        <p className="intro-note">
          {t(
            "Daily service entries, outstanding work and commissioner review.",
            "दैनिक सेवा प्रविष्टियाँ, लंबित कार्य और आयुक्त समीक्षा।",
          )}
        </p>
        <div className="intro-meta">
          <span>06 {t("Anchal offices", "अंचल कार्यालय")}</span>
          <span>25 {t("Municipal services", "नगर निगम सेवाएँ")}</span>
        </div>
      </section>
      <section className="login-card">
        <div className="eyebrow">
          {t("AUTHORIZED OFFICE ACCESS", "अधिकृत कार्यालय प्रवेश")}
        </div>
        <h2>{t("Office sign in", "कार्यालय लॉगिन")}</h2>
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
          <label>
            {t("Username", "उपयोगकर्ता नाम")}
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            {t("Password", "पासवर्ड")}
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="message" role="alert">
              {runtimeText(error, lang)}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy
              ? t("Signing in…", "प्रवेश जारी…")
              : t("Sign in →", "लॉगिन →")}
          </button>
        </form>
        <p className="small">
          {t(
            "Each Anchal uses one shared office account. Contact your portal administrator for access.",
            "प्रत्येक अंचल का एक साझा कार्यालय खाता है। प्रवेश के लिए पोर्टल प्रशासक से संपर्क करें।",
          )}
        </p>
      </section>
    </main>
  );
}
