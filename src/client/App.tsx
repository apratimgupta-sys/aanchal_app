import { lazy, Suspense, useState, useEffect, useRef } from "react";
import type { OfficerProfile, Setup, UserSession } from "../shared/types";
import { api, RequestError, setPasswordChangeRequiredHandler } from "./api";
import { Language, type Lang } from "./i18n";
import Login from "./pages/Login";
import { leadingBody, leadingHelp } from "./ui";
import { AppShell, commissionerNav, mainFrame, officeNav, officerNav, roleManagerNav } from "./components/AppShell";
import { COMMISSIONER_VISITS_ROUTE, adminLanding } from "./role-routes";
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
  const loadingText = text("Loading page…", "पृष्ठ लोड हो रहा है…");
  // Inside the shell the shell's own <main> is the landmark, so the fallback is a
  // plain block; with no shell (the forced password change) it is the page's <main>.
  const pageFallback = <div className={`grid min-h-48 place-content-center ${leadingBody} text-muted-foreground`}><p>{loadingText}</p></div>;
  const barePageFallback = <main id="main-content" tabIndex={-1} className={`${mainFrame} grid min-h-48 place-content-center ${leadingBody} text-muted-foreground`}><p>{loadingText}</p></main>;
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
  // The session says whether a password change is owed, but only when it is read. A reset
  // that lands while someone is signed in is learned from a 403, so one re-read answers it,
  // once: not while a read is already running, and not when the screen already asks for it.
  // The server signs a user out when their password change succeeds, so the login screen
  // is what they land on. This outlives the change-password screen and is dropped as soon
  // as anyone is signed in again, so it cannot greet an unrelated later visit.
  const [passwordChanged, setPasswordChanged] = useState(false);
  const reading = useRef(false);
  const mustChange = useRef(false);
  mustChange.current = session?.mustChangePassword === true;
  async function refresh() {
    reading.current = true;
    try {
      const next = await api<UserSession>("/session");
      setSession(next);
      setPasswordChanged(false);
      if (next.role === "office") {
        try {
          setSetup(await api<Setup | null>("/office/setup"));
        } catch (error) {
          // The session of an office login does not say it still carries a temporary
          // password, but the server refuses everything else until it is changed.
          if (error instanceof RequestError && error.detail.code === "password_change_required") {
            setSession({ ...next, mustChangePassword: true });
            setSetup(null);
          } else throw error;
        }
      } else setSetup(null);
    } catch {
      setSession(null);
      setSetup(undefined);
    } finally {
      reading.current = false;
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    setPasswordChangeRequiredHandler(() => {
      if (!reading.current && !mustChange.current) void refresh();
    });
    return () => setPasswordChangeRequiredHandler(null);
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
    } else {
      const target = adminLanding(session, pathname);
      if (target) navigate(target, true);
    }
  }, [loading, session, setup, pathname]);
  return (
    <Language.Provider value={lang}>
      <a href="#main-content" className={`fixed left-0 top-0 z-50 -translate-y-[150%] bg-card px-4 py-3 text-sm ${leadingBody} font-medium text-primary underline focus:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring`}>
        {text("Skip to main content", "मुख्य सामग्री पर जाएँ")}
      </a>
      {loading ? (
        <main id="main-content" tabIndex={-1} className={mainFrame}>
          <p>{text("Loading portal…", "पोर्टल लोड हो रहा है…")}</p>
        </main>
      ) : !session ? (
        <Login
          onLogin={() => void refresh()}
          onLanguageToggle={() => setLang(lang === "en" ? "hi" : "en")}
          languageLabel={lang === "en" ? "हिन्दी" : "English"}
          passwordChanged={passwordChanged}
        />
      ) : session.mustChangePassword ? (
        <Suspense fallback={barePageFallback}>
          <ChangePassword office={session.role !== "officer"} onChanged={() => { setPasswordChanged(true); void refresh(); }} />
        </Suspense>
      ) : session.role === "office" && setup === undefined ? (
        <main id="main-content" tabIndex={-1} className={mainFrame}>
          <p>
            {text("Loading office setup…", "कार्यालय सेटअप लोड हो रहा है…")}
          </p>
        </main>
      ) : session.role === "office" && !setup ? (
        <main id="main-content" tabIndex={-1} className={mainFrame}>
          {pathname === "/office/setup" && (
            <Suspense fallback={pageFallback}><InitialSetup onSaved={() => void refresh()} /></Suspense>
          )}
        </main>
      ) : (
        <AppShell
          role={session.role}
          account={session.role === "commissioner" ? text("Commissioner", "आयुक्त") : session.role === "rolemanager" ? text("Role manager", "भूमिका प्रबंधक") : session.role === "officer" ? `${session.officer?.name ?? ""} · ${text("Anchal", "अंचल")} ${session.officer?.homeOfficeId ?? ""}` : `${text("Anchal", "अंचल")} ${session.officeId}`}
          pathname={pathname}
          items={session.role === "commissioner" ? commissionerNav({ dashboard: text("Commissioner dashboard", "आयुक्त डैशबोर्ड"), visits: text("Field visits", "क्षेत्रीय निरीक्षण") }) : session.role === "rolemanager" ? roleManagerNav({ users: text("User administration", "उपयोगकर्ता प्रबंधन") }) : session.role === "officer" ? officerNav({ visit: text("Record a visit", "निरीक्षण दर्ज करें"), mine: text("My visits", "मेरे निरीक्षण") }) : officeNav({ today: text("Today’s Entry", "आज की प्रविष्टि"), backdate: text("Backdate Entry", "पिछली तिथि की प्रविष्टि") })}
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
          footer={<footer className={`flex flex-wrap gap-x-8 gap-y-2 border-t border-border px-4 py-5 text-xs ${leadingHelp} text-muted-foreground sm:px-8`}><span>© {new Date().getFullYear()} {text("Ranchi Municipal Corporation", "रांची नगर निगम")}</span><span>{text("Anchal Office Monitoring", "अंचल कार्यालय निगरानी")}</span></footer>}
        >
            <Suspense fallback={pageFallback}>{session.role === "commissioner" ? (
              pathname === COMMISSIONER_VISITS_ROUTE ? <VisitRegister /> : <Dashboard />
            ) : session.role === "rolemanager" ? (
              <Officers />
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
  // An unknown officer route renders nothing; the shell's own <main> is already there.
  return null;
}

function InitialSetup({ onSaved }: { onSaved: () => void }) {
  return <InitialBalances onSaved={onSaved} />;
}
