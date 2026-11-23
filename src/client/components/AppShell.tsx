import { useEffect, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, Languages, LogOut, LayoutDashboard, ClipboardList, History, Users } from "lucide-react";
import { cn } from "../lib/utils";
import { Button, focusRing, leadingBody, leadingHelp } from "../ui";
import { useText } from "../i18n";
import type { UserSession } from "../../shared/types";
import { ROLE_MANAGER_USERS_ROUTE } from "../role-routes";
import rmcLogo from "../assets/rmc-logo.jpg";

type ShellRole = UserSession["role"];

// Keyed by role, not a ternary chain: a fourth role is a compile error here
// instead of a silent fall-through to the commissioner label.
const ROLE_TITLE: Record<ShellRole, [en: string, hi: string]> = {
  office: ["Anchal Office", "अंचल कार्यालय"],
  commissioner: ["Commissioner Dashboard", "आयुक्त डैशबोर्ड"],
  officer: ["Field Visits", "क्षेत्रीय निरीक्षण"],
  // Hindi pair flagged for client review.
  rolemanager: ["User Administration", "उपयोगकर्ता प्रबंधन"],
};

// The page frame: max width, side gutter (16px, 32px from sm) and vertical padding.
// Exported so a <main> rendered outside the shell (App.tsx) gets the same gutter.
export const mainFrame = "mx-auto w-full max-w-[100rem] flex-1 px-4 pb-8 pt-5 focus:outline-none sm:px-8 sm:pb-10 sm:pt-[26px]";

// Where the top navigation takes over from the drawer: Tailwind's `lg`.
const DESKTOP = "(min-width: 1024px)";

// One look for every row in the navigation, top bar or drawer. The current page
// is carried by weight and a border as well as colour, so it reads without hue.
const navItem = (active: boolean) =>
  cn(
    "flex min-h-[44px] w-full items-center gap-2.5 rounded-[7px] border border-transparent px-3 py-2 text-left text-[13.5px] font-medium text-muted-foreground transition-colors motion-reduce:transition-none",
    "hover:bg-accent hover:text-foreground lg:w-auto lg:shrink-0 lg:whitespace-nowrap",
    focusRing,
    active && "border-primary/30 bg-accent font-semibold text-accent-foreground",
  );

export type ShellNavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export function AppShell({
  role,
  account,
  items,
  pathname,
  onNavigate,
  onLanguageToggle,
  onSignOut,
  languageLabel,
  signOutLabel,
  children,
  footer,
}: {
  role: ShellRole;
  account: string;
  items: ShellNavItem[];
  pathname: string;
  onNavigate: (href: string) => void;
  onLanguageToggle: () => void;
  onSignOut: () => void;
  languageLabel: string;
  signOutLabel: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const t = useText();
  const [open, setOpen] = useState(false);
  const navigate = (href: string) => {
    onNavigate(href);
    setOpen(false);
  };
  // The drawer only exists below the desktop breakpoint. If the window grows past
  // it while open, the modal would keep its scroll lock behind a hidden overlay.
  useEffect(() => {
    const query = window.matchMedia?.(DESKTOP);
    if (!query) return;
    const close = (e: { matches: boolean }) => e.matches && setOpen(false);
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);

  const emblem = (
    <img
      className="size-10 shrink-0 rounded-full object-cover"
      src={rmcLogo}
      alt={t("Ranchi Municipal Corporation emblem", "रांची नगर निगम का प्रतीक")}
    />
  );
  const brand = (subtitle: string) => (
    <div className="flex min-w-0 items-center gap-3">
      {emblem}
      <div className="min-w-0">
        <strong className="block text-[13.5px] font-semibold">{t("Ranchi Municipal Corporation", "रांची नगर निगम")}</strong>
        <span className={`block text-xs ${leadingHelp} text-muted-foreground`}>{subtitle}</span>
      </div>
    </div>
  );
  const navButtons = items.map(({ href, label, icon: Icon }) => (
    <button key={href} className={navItem(pathname === href)} aria-current={pathname === href ? "page" : undefined} onClick={() => navigate(href)}>
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      <span>{label}</span>
    </button>
  ));
  const navLabel = t("Portal navigation", "पोर्टल नेविगेशन");
  const iconButton = "size-11 shrink-0 px-0";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="hidden items-center gap-6 border-b border-border bg-card px-8 py-[14px] lg:sticky lg:top-0 lg:z-20 lg:flex">
          {brand(t("Anchal Office Monitoring", "अंचल कार्यालय निगरानी"))}
          {/* Scrolls rather than overlapping the actions if long Hindi labels run out of room; p-1 keeps the focus outline from being clipped. */}
          <nav aria-label={navLabel} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto p-1">
            {navButtons}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <span className="px-2 text-[13px] text-muted-foreground">{account}</span>
            <Button variant="outline" onClick={onLanguageToggle}>{languageLabel}</Button>
            <Button variant="outline" onClick={onSignOut}>
              <LogOut aria-hidden="true" className="size-4" />
              <span>{signOutLabel}</span>
            </Button>
          </div>
        </header>
        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-2 lg:hidden">
          <Dialog.Trigger asChild>
            <Button variant="outline" className={iconButton} aria-label={t("Open navigation", "नेविगेशन खोलें")}>
              <Menu aria-hidden="true" className="size-5" />
            </Button>
          </Dialog.Trigger>
          <div className="min-w-0 flex-1">
            <strong className={`block text-sm ${leadingBody} font-semibold`}>{t(...ROLE_TITLE[role])}</strong>
            <span className={`block text-xs ${leadingHelp} text-muted-foreground [overflow-wrap:anywhere]`}>{account}</span>
          </div>
          <Button variant="outline" className="shrink-0 px-3" onClick={onLanguageToggle}>{languageLabel}</Button>
        </header>
        <main id="main-content" tabIndex={-1} className={mainFrame}>
          {children}
        </main>
        {footer}
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-30 bg-foreground/40 lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-40 flex w-[min(19rem,88vw)] flex-col gap-4 overflow-y-auto border-r border-border bg-card p-5 shadow-xl focus:outline-none lg:hidden"
        >
          <Dialog.Title className="sr-only">{t("Portal menu", "पोर्टल मेनू")}</Dialog.Title>
          <div className="flex items-start justify-between gap-2">
            {brand(t("Anchal Office Monitoring Portal", "अंचल कार्यालय निगरानी पोर्टल"))}
            <Dialog.Close asChild>
              <Button variant="outline" className={iconButton} aria-label={t("Close navigation", "नेविगेशन बंद करें")}>
                <X aria-hidden="true" className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="rounded-[7px] border border-border bg-muted px-3 py-2.5 text-[13px] font-semibold text-muted-foreground [overflow-wrap:anywhere]">
            {account}
          </div>
          <nav aria-label={navLabel} className="grid gap-1">
            {navButtons}
          </nav>
          <div className="mt-auto grid gap-1 border-t border-border pt-4">
            <button className={navItem(false)} onClick={onLanguageToggle}>
              <Languages aria-hidden="true" className="size-[18px] shrink-0" />
              <span>{languageLabel}</span>
            </button>
            <button className={navItem(false)} onClick={onSignOut}>
              <LogOut aria-hidden="true" className="size-[18px] shrink-0" />
              <span>{signOutLabel}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const officeNav = (labels: { today: string; backdate: string }): ShellNavItem[] => [
  { href: "/office/today", label: labels.today, icon: ClipboardList },
  { href: "/office/backdate", label: labels.backdate, icon: ClipboardList },
];

export const officerNav = (labels: { visit: string; mine: string }): ShellNavItem[] => [
  { href: "/officer/visit", label: labels.visit, icon: ClipboardList },
  { href: "/officer/visits", label: labels.mine, icon: History },
];

export const commissionerNav = (labels: {
  dashboard: string;
  visits: string;
}): ShellNavItem[] => [
  { href: "/commissioner/dashboard", label: labels.dashboard, icon: LayoutDashboard },
  { href: "/commissioner/visits", label: labels.visits, icon: History },
];

export const roleManagerNav = (labels: { users: string }): ShellNavItem[] => [
  { href: ROLE_MANAGER_USERS_ROUTE, label: labels.users, icon: Users },
];
