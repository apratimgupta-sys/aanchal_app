import { test, expect, type Page } from "@playwright/test";

// A count's label and its box are a pair: the label wraps inside the box's own
// column, so it never runs wider than the box it names and the next field never
// starts far to the right of it. Measured in Chromium, which jsdom cannot do.
// The font here is whatever the machine has (Plex is a web font), so the line
// budget is a ceiling, not an exact figure.

async function stub(page: Page, lang: "en" | "hi") {
  await page.addInitScript((l) => localStorage.setItem("rmc-language", l), lang);
  await page.route("**/v1/api/anchal/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/session"))
      return route.fulfill({ json: { userId: "u", username: "anchal1", role: "office", officeId: 1, expiresAt: Date.now() + 3_600_000 } });
    if (path.endsWith("/office/setup"))
      return route.fulfill({
        json: {
          officeId: 1,
          startDate: "2026-10-01",
          version: 1,
          balances: Array.from({ length: 25 }, (_, i) => ({ serviceId: i + 1, opening: { service: 0, complaints: 0, field: 0 } })),
        },
      });
    if (path.endsWith("/office/entries")) return route.fulfill({ json: { setup: null, entries: [], openings: [] } });
    return route.fulfill({ json: [] });
  });
}

const SERVICES = {
  grievance: { en: "Public Grievance Application Reporting", hi: "जन शिकायत आवेदन की रिपोर्टिंग" },
  birthDeath: { en: "Birth and Death Registration Reporting", hi: "जन्म एवं मृत्यु निबंधन की रिपोर्टिंग" },
} as const;

for (const lang of ["en", "hi"] as const)
  for (const width of [390, 768, 1280])
    for (const svc of ["grievance", "birthDeath"] as const)
      test(`count labels stay inside their box: ${svc} ${lang} ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await stub(page, lang);
        await page.goto("/anchal/office/today");
        await page.locator("ul[aria-label] button", { hasText: SERVICES[svc][lang] }).first().click();
        const rows = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLInputElement>("input[type=number]")].map((input) => {
            const field = input.closest("div.grid")!;
            const label = field.querySelector("label")!;
            const range = document.createRange();
            range.selectNodeContents(label);
            const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
            const l = label.getBoundingClientRect();
            const i = input.getBoundingClientRect();
            const f = field.getBoundingClientRect();
            return { text: label.textContent, lines, labelRight: l.right, inputRight: i.right, inputWidth: i.width, fieldWidth: f.width, scrollW: label.scrollWidth, clientW: label.clientWidth };
          }),
        );
        expect(rows.length).toBeGreaterThan(0);
        for (const r of rows) {
          // The relationship: nothing the label says reaches past the box it names.
          expect(r.labelRight, r.text ?? "").toBeLessThanOrEqual(r.inputRight + 0.5);
          expect(r.fieldWidth, r.text ?? "").toBeLessThanOrEqual(r.inputWidth + 0.5);
          expect(r.scrollW, r.text ?? "").toBeLessThanOrEqual(r.clientW + 0.5);
          // Two lines is the aim; a third would be a column too narrow for the words.
          expect(r.lines, r.text ?? "").toBeLessThanOrEqual(2);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
