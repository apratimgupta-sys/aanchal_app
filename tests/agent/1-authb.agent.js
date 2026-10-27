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
await check('anchal1 signs in and lands on Today\'s Entry', async () => {
  await login('anchal1'); return path() === '/anchal/office/today' && /Daily service entry/.test(await body());
});
await check('session API returns the office user', async () => {
  const r = await page.evaluate(async () => { const x = await fetch('/v1/api/anchal/session'); return { s: x.status, j: await x.json().catch(() => null) }; });
  return r.s === 200 && r.j && r.j.role === 'office' ? `officeId=${r.j.officeId}` : false;
});
await check('office user is blocked from the commissioner API (403)', async () => {
  const s = await page.evaluate(async () => (await fetch('/v1/api/anchal/dashboard?from=2026-10-21&to=2026-10-21')).status); return s === 403 ? true : `status ${s}`;
});
for (const p of ['/anchal/commissioner', '/anchal/commissioner/dashboard', '/anchal/office/setup', '/anchal/office/history', '/anchal/nope']) {
  await check(`office user opening ${p} ends on Today's Entry`, async () => { await page.goto(B + p); await page.waitForTimeout(1500); return path() === '/anchal/office/today'; });
}
await check('sign out returns to sign-in and the session is gone (401)', async () => {
  await page.getByRole('button', { name: 'Sign out' }).click(); await page.waitForTimeout(1500);
  const s = await page.evaluate(async () => (await fetch('/v1/api/anchal/session')).status);
  return path() === '/anchal/' && s === 401 ? true : `path ${path()} status ${s}`;
});
await check('API without a session is rejected (401)', async () => {
  const s = await page.evaluate(async () => (await fetch('/v1/api/anchal/office/entries?date=2026-10-21&mode=today')).status); return s === 401 ? true : `status ${s}`;
});
await check('commissioner signs in and lands on the dashboard', async () => {
  await login('commissioner'); return path() === '/anchal/commissioner/dashboard' && /Office monitoring dashboard/.test(await body());
});
await check('commissioner is blocked from the office API (403)', async () => {
  const s = await page.evaluate(async () => (await fetch('/v1/api/anchal/office/entries?date=2026-10-21&mode=today')).status); return s === 403 ? true : `status ${s}`;
});
for (const p of ['/anchal/office/today', '/anchal/office/setup', '/anchal/nope']) {
  await check(`commissioner opening ${p} ends on the dashboard`, async () => { await page.goto(B + p); await page.waitForTimeout(1500); return path() === '/anchal/commissioner/dashboard'; });
}
await page.getByRole('button', { name: 'Sign out' }).click().catch(() => {});

return report();
}
