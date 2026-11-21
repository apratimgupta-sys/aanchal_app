// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Language, type Lang } from "../../src/client/i18n";
import { AppShell, commissionerNav } from "../../src/client/components/AppShell";

type Role = "office" | "commissioner" | "officer";

const EXPECTED: Record<Role, Record<Lang, string>> = {
  office: { en: "Anchal Office", hi: "अंचल कार्यालय" },
  commissioner: { en: "Commissioner Dashboard", hi: "आयुक्त डैशबोर्ड" },
  officer: { en: "Field Visits", hi: "क्षेत्रीय निरीक्षण" },
};

const items = commissionerNav({ dashboard: "Dashboard", visits: "Visits", officers: "Officers" });

function renderShell({
  role = "commissioner",
  lang = "en",
  onNavigate = () => {},
  pathname = "/",
}: { role?: Role; lang?: Lang; onNavigate?: (href: string) => void; pathname?: string } = {}) {
  return render(
    <Language.Provider value={lang}>
      <AppShell
        role={role}
        account="acct"
        items={items}
        pathname={pathname}
        onNavigate={onNavigate}
        onLanguageToggle={() => {}}
        onSignOut={() => {}}
        languageLabel="x"
        signOutLabel="y"
        footer={null}
      >
        body
      </AppShell>
    </Language.Provider>,
  );
}

// The phone header is the one whose button opens the drawer. Found by that
// relationship, not by a class name the stylesheet used to define.
function mobileTitle(role: Role, lang: Lang) {
  const { container } = renderShell({ role, lang });
  return container.querySelector('header button[aria-haspopup="dialog"]')?.closest("header")?.querySelector("strong")?.textContent;
}

afterEach(cleanup);

describe("AppShell mobile header", () => {
  for (const role of Object.keys(EXPECTED) as Role[])
    for (const lang of ["en", "hi"] as Lang[])
      it(`names the ${role} role in ${lang}`, () => {
        expect(mobileTitle(role, lang)).toBe(EXPECTED[role][lang]);
      });
});

describe("AppShell drawer", () => {
  const OPEN = { en: "Open navigation", hi: "नेविगेशन खोलें" };

  it("is not in the page until it is opened", async () => {
    renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: OPEN.en }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "Visits" })).toBeTruthy();
  });

  it("closes on Escape and hands focus back to the button that opened it", async () => {
    renderShell();
    const menu = screen.getByRole("button", { name: OPEN.en });
    await userEvent.click(menu);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(menu);
  });

  it("navigates and closes when an item is chosen", async () => {
    const onNavigate = vi.fn();
    renderShell({ onNavigate });
    await userEvent.click(screen.getByRole("button", { name: OPEN.en }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Visits" }));
    expect(onNavigate).toHaveBeenCalledWith("/commissioner/visits");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes when the window grows past the drawer breakpoint, so it cannot strand a desktop reader behind a hidden overlay", async () => {
    const added: unknown[] = [];
    const removed: unknown[] = [];
    let onChange: ((e: { matches: boolean }) => void) | undefined;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: (_: string, fn: typeof onChange) => {
        added.push(fn);
        onChange = fn;
      },
      removeEventListener: (_: string, fn: unknown) => removed.push(fn),
    }));
    try {
      const { unmount } = renderShell();
      await userEvent.click(screen.getByRole("button", { name: OPEN.en }));
      await screen.findByRole("dialog");
      act(() => onChange?.({ matches: true }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      // And the listener is released with the shell, by the same reference.
      unmount();
      expect(added.length).toBeGreaterThan(0);
      expect(removed).toEqual(added);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("marks the current page in whichever navigation is showing", () => {
    renderShell({ pathname: "/commissioner/visits" });
    const current = screen.getAllByRole("button", { name: "Visits" });
    expect(current.length).toBeGreaterThan(0);
    for (const b of current) expect(b.getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("button", { name: "Officers" })[0].getAttribute("aria-current")).toBeNull();
  });
});

describe("AppShell is bilingual end to end", () => {
  it("names the open and close buttons and the emblem in Hindi", async () => {
    const { container } = renderShell({ lang: "hi" });
    await userEvent.click(screen.getByRole("button", { name: "नेविगेशन खोलें" }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "नेविगेशन बंद करें" })).toBeTruthy();
    expect(within(drawer).getByRole("img", { name: "रांची नगर निगम का प्रतीक" })).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("रांची नगर निगम का प्रतीक");
  });

  it("leaves no English in an attribute a screen reader reads, nor in the brand, in Hindi", async () => {
    const { container } = renderShell({ lang: "hi" });
    await userEvent.click(screen.getByRole("button", { name: "नेविगेशन खोलें" }));
    await screen.findByRole("dialog");
    const scope = Array.from(document.querySelectorAll("[aria-label], img[alt]"));
    expect(scope.length).toBeGreaterThan(3);
    const english = scope
      .flatMap((el) => [el.getAttribute("aria-label"), el.getAttribute("alt")])
      .filter((v): v is string => !!v && /[A-Za-z]/.test(v));
    expect(english).toEqual([]);
    expect(document.body.textContent).not.toMatch(/Ranchi Municipal Corporation|Anchal Office Monitoring/);
    expect(container.textContent).toMatch(/रांची नगर निगम/);
  });

  it("labels the same controls in English", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByRole("button", { name: "Close navigation" })).toBeTruthy();
    expect(within(drawer).getByRole("img", { name: "Ranchi Municipal Corporation emblem" })).toBeTruthy();
  });
});

describe("AppShell styling contract", () => {
  it("uses no class that styles.css defines", async () => {
    const { container } = renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    await screen.findByRole("dialog");
    const legacy = /^(ux4g-|app-|ui-|visit-|portal-|skip-)/;
    const used = new Set<string>();
    for (const root of [container, document.body])
      root.querySelectorAll("[class]").forEach((el) => el.classList.forEach((c) => legacy.test(c) && used.add(c)));
    expect([...used]).toEqual([]);
  });

  it("carries the Hindi line-height lift on <body>, for text that sets no leading of its own", () => {
    const html = readFileSync("index.html", "utf8");
    const body = html.match(/<body[^>]*class="([^"]*)"/)?.[1] ?? "";
    expect(body).toContain("leading-body");
    expect(body).toMatch(/\[html\[lang=hi\]_&\]:leading-\[1\.[6-9]\d?\]/);
  });

  // The element-level `html[lang="hi"] button, label, span ...` rule in styles.css
  // beats a utility on specificity, so it was silently supplying Hindi leading for
  // every component. Pin that each explicit leading has its own Hindi counterpart,
  // so deleting that rule changes nothing.
  it("gives every explicit leading-* in the component layer a Hindi counterpart", () => {
    const files = ["src/client/ui.tsx", "src/client/pages/FieldVisit.tsx", "src/client/pages/Dashboard.tsx", "src/client/pages/Login.tsx", "src/client/components/AppShell.tsx", "src/client/App.tsx"];
    const bare = /(?<![:\w-])leading-[\w.[\]-]+/g;
    const offenders: string[] = [];
    for (const f of files)
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        if (line.match(bare) && !/\[html\[lang=hi\]_&\]:leading-\[/.test(line)) offenders.push(`${f}:${i + 1}`);
      });
    expect(offenders).toEqual([]);
  });

  // text-xs / text-sm / ... each carry a fixed line-height of their own (xs is 16px,
  // a 1.33 ratio at 12px) that only a leading-* alongside them overrides. Found by
  // measuring: the shell's 12px Hindi spans fell from 1.65 to 1.33 once the legacy rule
  // stopped covering them.
  it("never lets a named text size fix the line height without a leading-* beside it", () => {
    const files = ["src/client/ui.tsx", "src/client/pages/FieldVisit.tsx", "src/client/pages/Dashboard.tsx", "src/client/pages/Login.tsx", "src/client/components/AppShell.tsx", "src/client/App.tsx"];
    const sized = /(?<![:\w-])text-(xs|sm|base|lg|xl|[2-9]xl)(?![\w-])/;
    const offenders: string[] = [];
    for (const f of files)
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*\/\//.test(line)) return;
        if (sized.test(line) && !/leading/i.test(line)) offenders.push(`${f}:${i + 1}`);
      });
    expect(offenders).toEqual([]);
  });

  it("keeps Hindi at or above the 1.65 the legacy rule gave body and help text, and headings between their Latin value and body", () => {
    const ui = readFileSync("src/client/ui.tsx", "utf8");
    const hi = (name: string) => Number(ui.match(new RegExp(`${name} = "[^"]*leading-\\[([\\d.]+)\\]`))?.[1]);
    expect(hi("leadingBody")).toBeGreaterThanOrEqual(1.65);
    expect(hi("leadingHelp")).toBeGreaterThanOrEqual(1.65);
    expect(hi("leadingHeading")).toBeGreaterThan(1.4);
    expect(hi("leadingHeading")).toBeLessThan(hi("leadingBody"));
  });

  it("no longer carries the global body, font, gradient or shell rules in styles.css", () => {
    const css = readFileSync("src/client/styles.css", "utf8");
    expect(css).not.toMatch(/(^|\n)\s*body\s*\{/);
    expect(css).not.toMatch(/font-family:\s*"IBM Plex Sans Devanagari"/);
    // The per-element Hindi line heights stay only for the unmigrated screens
    // whose own rules set tight Latin line heights; the body-level one has moved.
    expect(css).not.toMatch(/html\[lang="hi"\] body/);
    expect(css).not.toMatch(/\.app-(?!crash)/);
    expect(css).not.toMatch(/shell-enter|\.skip-link|\.portal-footer-new|\.legacy-header|\.utility\b|\.masthead/);
  });
});
