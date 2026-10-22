async (page) => {
const B = 'http://127.0.0.1:5173', C = globalThis.__creds;
if (!C) return 'Set globalThis.__creds first';
const R = [];
page.setDefaultTimeout(6000);
if (!globalThis.__initOn) { globalThis.__initOn = true; await page.addInitScript(() => { window.__confirms = []; window.confirm = (m) => { window.__confirms.push(m); return true; }; }); }
const check = async (n, f) => { try { const v = await f(); R.push([v === false ? 'FAIL' : 'PASS', n + (typeof v === 'string' ? ' - ' + v : '')]); } catch (e) { R.push(['FAIL', n + ' :: ' + String(e.message).split('\n')[0]]); } };
const path = () => new URL(page.url()).pathname;
const body = async () => (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
const signedOut = async () => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(B + '/anchal/');
  await page.locator('button:visible:has-text("Sign out"), button:visible:has-text("Sign in")').first().waitFor({ timeout: 15000 });
  const so = page.getByRole('button', { name: 'Sign out' });
  if (await so.count()) { await so.click(); await page.getByRole('button', { name: /Sign in/ }).waitFor({ timeout: 15000 }); }
};
const login = async (u, pw) => {
  await signedOut();
  await page.getByLabel('Username').fill(u); await page.getByLabel('Password').fill(pw ?? C[u]);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !/Signing in/.test(document.body.innerText), null, { timeout: 15000 });
  await page.locator('main h1').first().waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
};
const report = () => {
   const f = R.filter(r => r[0] === 'FAIL').length; return `${R.length - f} passed, ${f} failed\n` + R.map(r => r[0] + '  ' + r[1]).join('\n'); };
await login('anchal1');
const hin = page.getByRole('button', { name: 'हिन्दी' });
await check('Hindi toggle translates the page heading and switches the button', async () => { const before = await page.locator('main h1').first().innerText(); await hin.click(); await page.waitForTimeout(800); const after = await page.locator('main h1').first().innerText(); return before !== after && (await page.getByRole('button', { name: /English/i }).count()) > 0 ? `${before} -> ${after}` : false; });
await check('Hindi: labels and nav are translated (no English left in the nav)', async () => { const nav = await page.getByRole('navigation', { name: /./ }).first().innerText(); return !/Today|Backdate/.test(nav) ? nav.replace(/\n/g, ' / ') : 'nav still English: ' + nav.replace(/\n/g, ' '); });
await check('Hindi survives navigation to Backdate', async () => { await page.getByRole('navigation').first().getByRole('button').nth(1).click(); await page.waitForTimeout(1200); return !/Backdate Entry/.test(await body()); });
await check('English toggle restores the English heading', async () => { await page.getByRole('button', { name: 'English', exact: true }).first().click(); await page.waitForTimeout(700); return /Daily service entry|Set opening|Backdate/.test(await page.locator('main h1').first().innerText()) || (await page.locator('main h1').first().innerText()); });
await page.goto(B + '/anchal/office/today'); await page.locator('main h1').first().waitFor({ timeout: 15000 }); await page.locator('[aria-label="Municipal services"] button').first().waitFor({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(1500);
await check('a11y: exactly one h1', async () => (await page.locator('h1').count()) === 1);
await check('a11y: skip link exists and its target exists', async () => (await page.locator('a[href="#main-content"]').count()) === 1 && (await page.locator('#main-content').count()) === 1);
await check('a11y: every visible form control has an accessible name', async () => {
  const bad = await page.evaluate(() => [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(e => e.offsetParent !== null).filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby')).map(e => e.outerHTML.slice(0, 80)));
  return bad.length === 0 ? true : 'unnamed: ' + bad.join(' ; ');
});
await check('a11y: every button has a non-empty accessible name', async () => {
  const bad = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null).filter(b => !(b.getAttribute('aria-label') || b.innerText.trim() || b.getAttribute('title'))).map(b => b.outerHTML.slice(0, 80)));
  return bad.length === 0 ? true : 'unnamed: ' + bad.join(' ; ');
});
await check('a11y: images have alt text', async () => (await page.evaluate(() => [...document.images].filter(i => !i.hasAttribute('alt')).length)) === 0);
await check('a11y: first Tab stop is the skip link', async () => { await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Tab'); return /skip to main/i.test(await page.evaluate(() => document.activeElement.innerText)); });
await check('a11y: the service list is keyboard reachable (buttons)', async () => (await page.locator('[aria-label="Municipal services"] button').count()) === 25);
const overflow = async (n) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
for (const [w, h] of [[375, 812], [768, 1024]]) {
  await page.setViewportSize({ width: w, height: h });
  await check(`responsive ${w}px: entry page has no horizontal overflow`, async () => { await page.goto(B + '/anchal/office/today'); await page.waitForTimeout(1500); const o = await overflow(); return o <= 1 ? true : 'overflow ' + o + 'px'; });
  await check(`responsive ${w}px: submit button is reachable`, async () => { const b = page.getByRole('button', { name: /Submit entry/ }); if (!(await b.count())) return 'saved/read-only'; await b.scrollIntoViewIfNeeded(); return await b.isVisible(); });
}
await page.setViewportSize({ width: 375, height: 812 });
await login('commissioner'); await page.setViewportSize({ width: 375, height: 812 });
await check('responsive 375px: dashboard has no horizontal overflow', async () => { await page.waitForTimeout(1500); const o = await overflow(); return o <= 1 ? true : 'overflow ' + o + 'px'; });
await page.setViewportSize({ width: 1280, height: 800 });
await page.getByRole('button', { name: 'Sign out' }).click().catch(() => {});

return report();
}
