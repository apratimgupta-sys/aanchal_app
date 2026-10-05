import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("history presents readable changes without technical metadata", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { setup: null, entries: [], openings: [] };
    if (path === "/api/session")
      data = { username: "anchal1", role: "office", officeId: 1 };
    if (path === "/api/history")
      data = [
        {
          id: "one",
          officeId: 1,
          actor: "anchal1",
          at: "2026-10-03T12:13:24Z",
          action: "Entry corrected",
          reason: "Correction",
          before: JSON.stringify({
            serviceId: 1,
            serviceDate: "2026-09-15",
            received: 6,
            version: 1,
          }),
          after: JSON.stringify({
            serviceId: 1,
            serviceDate: "2026-09-15",
            received: 7,
            version: 2,
          }),
        },
        {
          id: "two",
          officeId: 1,
          actor: "anchal1",
          at: "2026-10-03T12:13:24Z",
          action: "Entry corrected",
          reason: "Review",
          before: '{"received":0,"version":1}',
          after: '{"received":0,"version":2,"opening":{"service":10}}',
        },
      ];
    await route.fulfill({ json: data });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Change history", exact: true })
    .click();
  await expect(
    page.getByText("No entry values changed.", { exact: true }),
  ).toBeVisible();
  const disclosure = page.getByText("View 1 changed field", { exact: true });
  await disclosure.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("cell", { name: "6", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "7", exact: true }),
  ).toBeVisible();
  await expect(page.locator("pre")).toHaveCount(0);
  await expect(
    page.getByText("New holding application", { exact: true }),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(async (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      document.body.getBoundingClientRect();
      await Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => {})),
      );
    }, theme);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
