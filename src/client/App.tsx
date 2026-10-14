import { lazy, Suspense, useState, useEffect } from "react";
import type { Setup, UserSession } from "../shared/types";
import { api } from "./api";
import { Language, type Lang } from "./i18n";
import Login from "./pages/Login";
import { AppShell, commissionerNav, officeNav } from "./components/AppShell";
import rmcLogo from "./assets/rmc-logo.jpg";
import { portalPath, portalRoute } from "./portal-path";
const DailyEntry = lazy(() => import("./pages/DailyEntry"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const InitialBalances = lazy(() => import("./pages/InitialBalances"));
export default function App() {
  const [lang, setLang] = useState<Lang>(() =>
    localStorage.getItem("rmc-language") === "hi" ? "hi" : "en",
  );
  const [session, setSession] = useState<UserSession | null>(null),
    [loading, setLoading] = useState(true),
    [pathname, setPathname] = useState(() => portalRoute(window.location.pathname)),
    [setup, setSetup] = useState<Setup | null | undefined>(undefined),
    [entryDirty, setEntryDirty] = useState(false),
    [entryReset, setEntryReset] = useState(0),
    [preserveDraftSignal, setPreserveDraftSignal] = useState(0);
  const text = (en: string, hi: string) => (lang === "hi" ? hi : en);
  const pageFallback = <main id="main-content" tabIndex={-1} className="workspace page-loading"><p>{text("Loading page…", "पृष्ठ लोड हो रहा है…")}</p></main>;
  function mayNavigate(path: string, preserveDraft = false) {
    if (
      path !== pathname &&
      entryDirty &&
      session?.role === "office" &&
      !preserveDraft
    ) {
      if (
        !window.confirm(
          text(
            "Discard unsaved entry changes and leave this page?",
            "असहेजी प्रविष्टि छोड़कर इस पृष्ठ से जाएँ?",
          ),
        )
      )
        return false;
      setEntryDirty(false);
      setEntryReset((key) => key + 1);
    }
    if (preserveDraft) setPreserveDraftSignal((signal) => signal + 1);
    return true;
  }
  function navigate(path: string, replace = false, preserveDraft = false) {
    if (!mayNavigate(path, preserveDraft)) return;
    if (pathname !== path) {
      const nextUrl = portalPath(path);
      if (replace) window.history.replaceState({}, "", nextUrl);
      else window.history.pushState({}, "", nextUrl);
    }
    setPathname(path);
  }
  async function refresh() {
    try {
      const next = await api<UserSession>("/session");
      setSession(next);
      if (next.role === "office")
        setSetup(await api<Setup | null>("/office/setup"));
      else setSetup(null);
    } catch {
      setSession(null);
      setSetup(undefined);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("rmc-language", lang);
  }, [lang]);
  useEffect(() => {
    const onPopState = () => {
      const next = portalRoute(window.location.pathname);
      if (!mayNavigate(next)) {
        window.history.pushState({}, "", portalPath(pathname));
        return;
      }
      setPathname(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [pathname, entryDirty, session, lang]);
  useEffect(() => {
    if (loading || !session) return;
    if (session.role === "office") {
      if (setup === undefined) return;
      if (!setup && pathname !== "/office/setup")
        navigate("/office/setup", true);
      else if (setup && pathname === "/office/setup")
        navigate("/office/today", true);
      else if (
        setup &&
        !["/office/today", "/office/backdate"].includes(
          pathname,
        )
      )
        navigate("/office/today", true);
    } else if (pathname.startsWith("/office/") || pathname === "/") {
      navigate("/commissioner/dashboard", true);
    } else if (pathname !== "/commissioner/dashboard") {
      navigate("/commissioner/dashboard", true);
    }
  }, [loading, session, setup, pathname]);
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
      <header className="masthead ux4g-bg-neutral-elevated ux4g-d-flex ux4g-jc-between ux4g-ai-center ux4g-gap-x-l legacy-header">
        <div className="wordmark ux4g-title-s-strong ux4g-d-flex ux4g-ai-center ux4g-gap-x-l">
          <img className="rmc-logo" src={rmcLogo} alt="Ranchi Municipal Corporation emblem" />
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
                  if (!mayNavigate("/")) return;
                  await api("/logout", "POST", {});
                  setSession(null);
                  setSetup(undefined);
                  navigate("/", true);
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
      ) : session.role === "office" && setup === undefined ? (
        <main id="main-content" tabIndex={-1} className="workspace">
          <p>
            {text("Loading office setup…", "कार्यालय सेटअप लोड हो रहा है…")}
          </p>
        </main>
      ) : session.role === "office" && !setup ? (
        <main id="main-content" tabIndex={-1} className="workspace">
          {pathname === "/office/setup" && (
            <Suspense fallback={pageFallback}><InitialSetup onSaved={() => void refresh()} /></Suspense>
          )}
        </main>
      ) : (
        <AppShell
          role={session.role}
          account={session.role === "commissioner" ? text("Commissioner", "आयुक्त") : `${text("Anchal", "अंचल")} ${session.officeId}`}
          pathname={pathname}
          items={session.role === "commissioner" ? commissionerNav({ dashboard: text("Commissioner dashboard", "आयुक्त डैशबोर्ड") }) : officeNav({ today: text("Today’s Entry", "आज की प्रविष्टि"), backdate: text("Backdate Entry", "पिछली तिथि की प्रविष्टि") })}
          onNavigate={(path) => navigate(path)}
          onLanguageToggle={() => setLang(lang === "en" ? "hi" : "en")}
          onSignOut={async () => {
            if (!mayNavigate("/")) return;
            await api("/logout", "POST", {});
            setSession(null);
            setSetup(undefined);
            navigate("/", true);
          }}
          languageLabel={lang === "en" ? "हिन्दी" : "English"}
          signOutLabel={text("Sign out", "लॉगआउट")}
          footer={<footer className="portal-footer-new"><span>© {new Date().getFullYear()} {text("Ranchi Municipal Corporation", "रांची नगर निगम")}</span><span>{text("Anchal Office Monitoring · First iteration", "अंचल कार्यालय निगरानी · प्रथम संस्करण")}</span></footer>}
        >
            <Suspense fallback={pageFallback}>{session.role === "commissioner" ? (
              <Dashboard />
            ) : (
              <DailyEntry
                key={entryReset}
                officeId={session.officeId!}
                mode={pathname === "/office/backdate" ? "backdate" : "today"}
                startDate={setup!.startDate}
                onDirtyChange={setEntryDirty}
                preserveDraftSignal={preserveDraftSignal}
                onContinueDraftInBackdate={() =>
                  navigate("/office/backdate", false, true)
                }
              />
            )}</Suspense>
        </AppShell>
      )}
    </Language.Provider>
  );
}

function InitialSetup({ onSaved }: { onSaved: () => void }) {
  return <InitialBalances onSaved={onSaved} />;
}
