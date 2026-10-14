import { useState, useEffect } from "react";
import type { Setup, UserSession } from "../shared/types";
import { api } from "./api";
import { Language, type Lang } from "./i18n";
import Login from "./pages/Login";
import DailyEntry from "./pages/DailyEntry";
import Dashboard from "./pages/Dashboard";
import ChangeHistory from "./pages/ChangeHistory";
import InitialBalances from "./pages/InitialBalances";
import { portalPath, portalRoute } from "./portal-path";
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
        !["/office/today", "/office/backdate", "/office/history"].includes(
          pathname,
        )
      )
        navigate("/office/today", true);
    } else if (pathname.startsWith("/office/") || pathname === "/") {
      navigate("/commissioner/dashboard", true);
    } else if (
      !["/commissioner/dashboard", "/commissioner/history"].includes(pathname)
    ) {
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
            <InitialSetup onSaved={() => void refresh()} />
          )}
        </main>
      ) : (
        <>
          <nav
            className="ux4g-navbar portal-nav"
            aria-label={text("Portal navigation", "पोर्टल नेविगेशन")}
          >
            <div className="ux4g-navbar-wrap portal-nav-wrap ux4g-flex-wrap ux4g-jc-start ux4g-w-100">
              {session.role === "commissioner" ? (
                <>
                  <RouteTab
                    active={pathname === "/commissioner/dashboard"}
                    onClick={() => navigate("/commissioner/dashboard")}
                    label={text("Commissioner dashboard", "आयुक्त डैशबोर्ड")}
                  />
                  <RouteTab
                    active={pathname === "/commissioner/history"}
                    onClick={() => navigate("/commissioner/history")}
                    label={text("Change history", "परिवर्तन इतिहास")}
                  />
                </>
              ) : (
                <>
                  <RouteTab
                    active={pathname === "/office/today"}
                    onClick={() => navigate("/office/today")}
                    label={text("Today’s Entry", "आज की प्रविष्टि")}
                  />
                  <RouteTab
                    active={pathname === "/office/backdate"}
                    onClick={() => navigate("/office/backdate")}
                    label={text("Backdate Entry", "पिछली तिथि की प्रविष्टि")}
                  />
                  <RouteTab
                    active={pathname === "/office/history"}
                    onClick={() => navigate("/office/history")}
                    label={text("Change History", "परिवर्तन इतिहास")}
                  />
                </>
              )}
              <span>
                {text(
                  "RMC / Office monitoring",
                  "रांची नगर निगम / कार्यालय निगरानी",
                )}
              </span>
            </div>
          </nav>
          <main id="main-content" tabIndex={-1} className="workspace">
            {pathname === "/office/history" ||
            pathname === "/commissioner/history" ? (
              <ChangeHistory />
            ) : session.role === "commissioner" ? (
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

function RouteTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`ux4g-btn ux4g-btn-l ${active ? "ux4g-btn-tonal-primary" : "ux4g-btn-text-neutral"}`}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function InitialSetup({ onSaved }: { onSaved: () => void }) {
  return <InitialBalances onSaved={onSaved} />;
}
