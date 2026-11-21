import { lazy, Suspense, useState, useEffect } from "react";
import type { OfficerProfile, Setup, UserSession } from "../shared/types";
import { api } from "./api";
import { Language, type Lang } from "./i18n";
import Login from "./pages/Login";
import { leadingBody, leadingHelp } from "./ui";
import { AppShell, commissionerNav, officeNav, officerNav } from "./components/AppShell";
import { OFFICER_VISITS_ROUTE, OFFICER_VISIT_ROUTE, officerLanding } from "./officer-routes";
import { indiaToday } from "./lib/dates";
import { clearSessionCaches } from "./session-caches";
import { queryClient } from "./query";
import { portalPath, portalRoute } from "./portal-path";
const DailyEntry = lazy(() => import("./pages/DailyEntry"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const VisitRegister = lazy(() => import("./pages/VisitRegister"));
const Officers = lazy(() => import("./pages/Officers"));
const InitialBalances = lazy(() => import("./pages/InitialBalances"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const FieldVisit = lazy(() => import("./pages/FieldVisit"));
const MyVisits = lazy(() => import("./pages/MyVisits"));
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
      (session?.role === "office" || session?.role === "officer") &&
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
    if (session.role === "officer") {
      const target = officerLanding(session, pathname);
      if (target) navigate(target, true);
      return;
    }
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
    } else if (
      ![
        "/commissioner/dashboard",
        "/commissioner/visits",
        "/commissioner/officers",
      ].includes(pathname)
    ) {
      navigate("/commissioner/dashboard", true);
    }
  }, [loading, session, setup, pathname]);
  return (
    <Language.Provider value={lang}>
      <a href="#main-content" className={`fixed left-0 top-0 z-50 -translate-y-[150%] bg-card px-4 py-3 text-sm ${leadingBody} font-medium text-primary underline focus:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring`}>
        {text("Skip to main content", "मुख्य सामग्री पर जाएँ")}
      </a>
      {loading ? (
        <main id="main-content" tabIndex={-1}>
          <p>{text("Loading portal…", "पोर्टल लोड हो रहा है…")}</p>
        </main>
      ) : !session ? (
        <Login
          onLogin={() => void refresh()}
          onLanguageToggle={() => setLang(lang === "en" ? "hi" : "en")}
          languageLabel={lang === "en" ? "हिन्दी" : "English"}
        />
      ) : session.role === "officer" && session.mustChangePassword ? (
        <Suspense fallback={pageFallback}>
          <ChangePassword onChanged={() => void refresh()} />
        </Suspense>
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
          account={session.role === "commissioner" ? text("Commissioner", "आयुक्त") : session.role === "officer" ? `${session.officer?.name ?? ""} · ${text("Anchal", "अंचल")} ${session.officer?.homeOfficeId ?? ""}` : `${text("Anchal", "अंचल")} ${session.officeId}`}
          pathname={pathname}
          items={session.role === "commissioner" ? commissionerNav({ dashboard: text("Commissioner dashboard", "आयुक्त डैशबोर्ड"), visits: text("Field visits", "क्षेत्रीय निरीक्षण"), officers: text("Field officers", "क्षेत्रीय अधिकारी") }) : session.role === "officer" ? officerNav({ visit: text("Record a visit", "निरीक्षण दर्ज करें"), mine: text("My visits", "मेरे निरीक्षण") }) : officeNav({ today: text("Today’s Entry", "आज की प्रविष्टि"), backdate: text("Backdate Entry", "पिछली तिथि की प्रविष्टि") })}
          onNavigate={(path) => navigate(path)}
          onLanguageToggle={() => setLang(lang === "en" ? "hi" : "en")}
          onSignOut={async () => {
            if (!mayNavigate("/")) return;
            await api("/logout", "POST", {});
            clearSessionCaches(queryClient);
            setSession(null);
            setSetup(undefined);
            navigate("/", true);
          }}
          languageLabel={lang === "en" ? "हिन्दी" : "English"}
          signOutLabel={text("Sign out", "लॉगआउट")}
          footer={<footer className={`flex flex-wrap gap-x-8 gap-y-2 border-t border-border px-4 py-5 text-xs ${leadingHelp} text-muted-foreground sm:px-8`}><span>© {new Date().getFullYear()} {text("Ranchi Municipal Corporation", "रांची नगर निगम")}</span><span>{text("Anchal Office Monitoring · First iteration", "अंचल कार्यालय निगरानी · प्रथम संस्करण")}</span></footer>}
        >
            <Suspense fallback={pageFallback}>{session.role === "commissioner" ? (
              pathname === "/commissioner/visits" ? <VisitRegister /> : pathname === "/commissioner/officers" ? <Officers /> : <Dashboard />
            ) : session.role === "officer" ? (
              <OfficerPages pathname={pathname} officer={session.officer!} />
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

function OfficerPages({
  pathname,
  officer,
}: {
  pathname: string;
  officer: OfficerProfile;
}) {
  if (pathname === OFFICER_VISITS_ROUTE) return <MyVisits officerId={officer.id} />;
  if (pathname === OFFICER_VISIT_ROUTE)
    return <FieldVisit officer={officer} today={indiaToday()} />;
  return <main id="main-content" tabIndex={-1} className="workspace" />;
}

function InitialSetup({ onSaved }: { onSaved: () => void }) {
  return <InitialBalances onSaved={onSaved} />;
}
