import { useState, useEffect } from "react";
import type { UserSession } from "../shared/types";
import { api } from "./api";
import { Language, type Lang } from "./i18n";
import Login from "./pages/Login";
import DailyEntry from "./pages/DailyEntry";
import Dashboard from "./pages/Dashboard";
import ChangeHistory from "./pages/ChangeHistory";
export default function App() {
  const [lang, setLang] = useState<Lang>(() =>
    localStorage.getItem("rmc-language") === "hi" ? "hi" : "en",
  );
  const [session, setSession] = useState<UserSession | null>(null),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState("main");
  const text = (en: string, hi: string) => (lang === "hi" ? hi : en);
  async function refresh() {
    try {
      setSession(await api<UserSession>("/session"));
    } catch {
      setSession(null);
    }
    setLoading(false);
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("rmc-language", lang);
  }, [lang]);
  return (
    <Language.Provider value={lang}>
      <a href="#main-content" className="skip-link">
        {text("Skip to main content", "मुख्य सामग्री पर जाएँ")}
      </a>
      <div className="utility ux4g-bg-neutral-subtle ux4g-body-xs-default ux4g-d-flex ux4g-jc-between ux4g-gap-x-l">
        <span>
          {text(
            "Government of Jharkhand · Urban Development",
            "झारखण्ड सरकार · नगर विकास",
          )}
        </span>
        <span>
          {text("First iteration · Demonstration", "प्रथम संस्करण · प्रदर्शन")}
        </span>
      </div>
      <header className="masthead ux4g-bg-neutral-elevated ux4g-d-flex ux4g-jc-between ux4g-ai-center ux4g-gap-x-l">
        <div className="wordmark ux4g-title-s-strong ux4g-d-flex ux4g-ai-center ux4g-gap-x-l">
          <span className="monogram ux4g-bg-primary-strong ux4g-text-neutral-inverse ux4g-heading-s-strong ux4g-radius-m">
            RMC
          </span>
          <div>
            <strong className="ux4g-d-block">
              {text("Ranchi Municipal Corporation", "रांची नगर निगम")}
            </strong>
            <span className="ux4g-d-block ux4g-body-xs-default">
              {text(
                "Anchal Office Monitoring Portal",
                "अंचल कार्यालय निगरानी पोर्टल",
              )}
            </span>
          </div>
        </div>
        <div className="header-actions ux4g-d-flex ux4g-ai-center ux4g-flex-wrap ux4g-gap-x-s">
          <button
            className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
          >
            {lang === "en" ? "हिन्दी" : "English"}
          </button>
          {session && (
            <>
              <span className="account ux4g-label-l-default">
                {session.role === "commissioner"
                  ? text("Commissioner", "आयुक्त")
                  : `${text("Anchal", "अंचल")} ${session.officeId}`}
              </span>
              <button
                className="ux4g-btn ux4g-btn-l ux4g-btn-outline-neutral"
                onClick={async () => {
                  await api("/logout", "POST", {});
                  setSession(null);
                  setPage("main");
                }}
              >
                {text("Sign out", "लॉगआउट")}
              </button>
            </>
          )}
        </div>
      </header>
      {loading ? (
        <main id="main-content" tabIndex={-1}>
          <p>{text("Loading portal…", "पोर्टल लोड हो रहा है…")}</p>
        </main>
      ) : !session ? (
        <Login onLogin={() => void refresh()} />
      ) : (
        <>
          <nav
            className="ux4g-navbar portal-nav"
            aria-label={text("Portal navigation", "पोर्टल नेविगेशन")}
          >
            <div className="ux4g-navbar-wrap portal-nav-wrap ux4g-flex-wrap ux4g-jc-start ux4g-w-100">
              <button
                className={`ux4g-btn ux4g-btn-l ${page === "main" ? "ux4g-btn-tonal-primary" : "ux4g-btn-text-neutral"}`}
                aria-current={page === "main" ? "page" : undefined}
                onClick={() => setPage("main")}
              >
                {session.role === "commissioner"
                  ? text("Commissioner dashboard", "आयुक्त डैशबोर्ड")
                  : text("Daily entry", "दैनिक प्रविष्टि")}
              </button>
              <button
                className={`ux4g-btn ux4g-btn-l ${page === "history" ? "ux4g-btn-tonal-primary" : "ux4g-btn-text-neutral"}`}
                aria-current={page === "history" ? "page" : undefined}
                onClick={() => setPage("history")}
              >
                {text("Change history", "परिवर्तन इतिहास")}
              </button>
              <span>
                {text(
                  "RMC / Office monitoring",
                  "रांची नगर निगम / कार्यालय निगरानी",
                )}
              </span>
            </div>
          </nav>
          <main id="main-content" tabIndex={-1} className="workspace">
            {page === "history" ? (
              <ChangeHistory />
            ) : session.role === "commissioner" ? (
              <Dashboard />
            ) : (
              <DailyEntry officeId={session.officeId!} />
            )}
          </main>
        </>
      )}
      <footer className="ux4g-footer ux4g-bg-neutral-subtle">
        <div className="portal-footer ux4g-footer-row ux4g-body-xs-default ux4g-d-flex ux4g-flex-wrap ux4g-gap-x-l">
          <span>
            © {new Date().getFullYear()}{" "}
            {text("Ranchi Municipal Corporation", "रांची नगर निगम")}
          </span>
          <span>
            {text(
              "Anchal Office Monitoring · First iteration",
              "अंचल कार्यालय निगरानी · प्रथम संस्करण",
            )}
          </span>
        </div>
      </footer>
    </Language.Provider>
  );
}
