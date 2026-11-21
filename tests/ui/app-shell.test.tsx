// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Language, type Lang } from "../../src/client/i18n";
import { AppShell } from "../../src/client/components/AppShell";

type Role = "office" | "commissioner" | "officer";

const EXPECTED: Record<Role, Record<Lang, string>> = {
  office: { en: "Anchal Office", hi: "अंचल कार्यालय" },
  commissioner: { en: "Commissioner Dashboard", hi: "आयुक्त डैशबोर्ड" },
  officer: { en: "Field Visits", hi: "क्षेत्रीय निरीक्षण" },
};

function mobileTitle(role: Role, lang: Lang) {
  const { container } = render(
    <Language.Provider value={lang}>
      <AppShell
        role={role}
        account="acct"
        items={[]}
        pathname="/"
        onNavigate={() => {}}
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
  return container.querySelector(".app-mobile-header strong")?.textContent;
}

describe("AppShell mobile header", () => {
  afterEach(cleanup);
  for (const role of Object.keys(EXPECTED) as Role[])
    for (const lang of ["en", "hi"] as Lang[])
      it(`names the ${role} role in ${lang}`, () => {
        expect(mobileTitle(role, lang)).toBe(EXPECTED[role][lang]);
      });
});
