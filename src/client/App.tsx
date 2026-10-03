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
      <div className="utility">
        <span>
          {text(
            "Government of Jharkhand · Urban Development",
            "झारखण्ड सरकार · नगर विकास",
          )}
        </span>
        <span>{text("First iteration", "प्रथम संस्करण")}</span>
      </div>
      <header className="masthead">
        <div className="wordmark">
          <span className="monogram">RMC</span>
          <div>
            <strong>
              {text("Ranchi Municipal Corporation", "रांची नगर निगम")}
            </strong>
            <span>
              {text(
                "Anchal Office Monitoring Portal",
                "अंचल कार्यालय निगरानी पोर्टल",
              )}
            </span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")}>
            {lang === "en" ? "हिन्दी" : "English"}
          </button>
          {session && (
            <>
              <span className="account">
                {session.role === "commissioner"
                  ? text("Commissioner", "आयुक्त")
                  : `${text("Anchal", "अंचल")} ${session.officeId}`}
              </span>
              <button
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
        <main>
          <p>{text("Loading portal…", "पोर्टल लोड हो रहा है…")}</p>
        </main>
      ) : !session ? (
        <Login onLogin={() => void refresh()} />
      ) : (
        <>
          <nav>
            <button
              className={page === "main" ? "active" : ""}
              onClick={() => setPage("main")}
            >
              {session.role === "commissioner"
                ? text("Commissioner dashboard", "आयुक्त डैशबोर्ड")
                : text("Daily entry", "दैनिक प्रविष्टि")}
            </button>
            <button
              className={page === "history" ? "active" : ""}
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
          </nav>
          <main className="workspace">
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
      <footer>
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
      </footer>
    </Language.Provider>
  );
}
