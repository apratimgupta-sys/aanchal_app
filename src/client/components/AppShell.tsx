import { useState, type ReactNode } from "react";
import { Menu, X, Languages, LogOut, LayoutDashboard, ClipboardList, History } from "lucide-react";
import { cn } from "../lib/utils";
import rmcLogo from "../assets/rmc-logo.jpg";

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
  role: "office" | "commissioner";
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
  const [open, setOpen] = useState(false);
  const navigate = (href: string) => {
    onNavigate(href);
    setOpen(false);
  };
  const navigation = (
    <div className="app-sidebar-inner">
      <div className="app-brand">
        <img className="app-brand-mark" src={rmcLogo} alt="Ranchi Municipal Corporation emblem" />
        <div>
          <strong>Ranchi Municipal Corporation</strong>
          <span>Anchal Office Monitoring Portal</span>
        </div>
      </div>
      <div className="app-role">{account}</div>
      <nav aria-label="Portal navigation" className="app-nav">
        {items.map(({ href, label, icon: Icon }) => (
          <button
            key={href}
            className={cn("app-nav-item", pathname === href && "is-active")}
            aria-current={pathname === href ? "page" : undefined}
            onClick={() => navigate(href)}
          >
            <Icon aria-hidden="true" size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="app-sidebar-actions">
        <button className="app-utility-button" onClick={onLanguageToggle}>
          <Languages aria-hidden="true" size={18} />
          <span>{languageLabel}</span>
        </button>
        <button className="app-utility-button" onClick={onSignOut}>
          <LogOut aria-hidden="true" size={18} />
          <span>{signOutLabel}</span>
        </button>
      </div>
    </div>
  );
  return (
    <div className="app-shell">
      {open && <button className="app-drawer-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <aside className={cn("app-mobile-drawer", open && "is-open")} aria-label="Mobile portal navigation">
        <button className="app-drawer-close" aria-label="Close navigation" onClick={() => setOpen(false)}><X size={20} /></button>
        {navigation}
      </aside>
      <div className="app-content">
        <header className="app-topbar">
          <div className="app-topbar-brand">
            <img className="app-brand-mark" src={rmcLogo} alt="Ranchi Municipal Corporation emblem" />
            <div><strong>Ranchi Municipal Corporation</strong><span>Anchal Office Monitoring</span></div>
          </div>
          <nav aria-label="Portal navigation" className="app-topnav">
            {items.map(({ href, label, icon: Icon }) => (
              <button key={href} className={cn("app-nav-item", pathname === href && "is-active")} aria-current={pathname === href ? "page" : undefined} onClick={() => navigate(href)}>
                <Icon aria-hidden="true" size={17} /><span>{label}</span>
              </button>
            ))}
          </nav>
          <div className="app-topbar-actions">
            <span className="app-topbar-account">{account}</span>
            <button className="app-language-button" onClick={onLanguageToggle}>{languageLabel}</button>
            <button className="app-signout-button" onClick={onSignOut}><LogOut aria-hidden="true" size={16} /><span>{signOutLabel}</span></button>
          </div>
        </header>
        <header className="app-mobile-header">
          <button className="app-menu-button" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <div><strong>{role === "office" ? "Anchal Office" : "Commissioner Dashboard"}</strong><span>{account}</span></div>
          <button className="app-language-button" onClick={onLanguageToggle}>{languageLabel}</button>
        </header>
        <main id="main-content" tabIndex={-1} className="app-main">{children}</main>
        {footer}
      </div>
    </div>
  );
}

export const officeNav = (labels: { today: string; backdate: string }): ShellNavItem[] => [
  { href: "/office/today", label: labels.today, icon: ClipboardList },
  { href: "/office/backdate", label: labels.backdate, icon: ClipboardList },
];

export const commissionerNav = (labels: { dashboard: string }): ShellNavItem[] => [
  { href: "/commissioner/dashboard", label: labels.dashboard, icon: LayoutDashboard },
];
