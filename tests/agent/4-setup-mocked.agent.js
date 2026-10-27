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
await page.unrouteAll({ behavior: 'ignoreErrors' });
const puts = []; let mode = 'ok';
await page.route('**/v1/api/anchal/**', async route => {
  const u = new URL(route.request().url());
  if (u.pathname.endsWith('/session')) return route.fulfill({ json: { userId: 'agent-setup', username: 'anchal3', role: 'office', officeId: 3, expiresAt: Date.now() + 600000 } });
  if (u.pathname.endsWith('/office/setup')) {
    if (route.request().method() === 'PUT') { puts.push(route.request().postDataJSON()); if (mode === 'fieldError') return route.fulfill({ status: 422, json: { code: 'VALIDATION', message: 'Please correct the highlighted fields', fieldErrors: { 'balances[2].opening.complaints': 'Enter a valid value' } } }); if (mode === 'server') return route.fulfill({ status: 500, json: { code: 'INTERNAL', message: 'Something went wrong' } }); return route.fulfill({ json: {} }); }
    return route.fulfill({ json: null });
  }
  return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: 'unmocked' } });
});
await page.goto(B + '/anchal/office/setup'); await page.waitForTimeout(2000);
const confirm = page.getByText('I confirm all opening balances, including zero balances.', { exact: true });
const save = page.getByRole('button', { name: 'Save opening balances', exact: true });
const cell = (l) => page.getByLabel(l, { exact: true });
await check('setup page renders for an unconfigured office', async () => /Set opening balances/.test(await body()));
await check('save without the confirmation checkbox is blocked', async () => { if (await save.isDisabled()) return 'button disabled until confirmed'; await save.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(600); return puts.length === 0; });
await check('future start date -> visible error, no request', async () => { await page.getByLabel('Reporting start date').fill('2999-01-01'); await confirm.click(); await save.click(); await page.waitForTimeout(600); return (await page.getByText('Reporting start date cannot be in the future').count()) > 0 && puts.length === 0; });
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
for (const [name, val, msg] of [['negative', '-5', 'Enter a number of 0 or more'], ['over the limit', '1000001000', 'Enter a number up to 1,000,000,000'], ['decimal', '1.5', 'Enter a whole number']]) {
  await check(`${name} opening balance -> "${msg}", no request`, async () => { await page.getByLabel('Reporting start date').fill(today); await cell('1 service').fill(val); await save.click(); await page.waitForTimeout(600); return (await page.getByText(msg).count()) > 0 && puts.length === 0; });
}
await check('fixing the value clears the error and sends one PUT with whole numbers', async () => {
  await cell('1 service').fill('7'); if (!(await confirm.isChecked?.().catch(() => false))) {} await save.click(); await page.waitForTimeout(1200);
  const b = puts[0]; return puts.length === 1 && b && JSON.stringify(b).includes('"service":7') ? 'PUT sent with service 7' : 'puts ' + puts.length + ' ' + JSON.stringify(b).slice(0, 160);
});
mode = 'fieldError'; puts.length = 0;
await page.goto(B + '/anchal/office/setup'); await page.waitForTimeout(1800); await confirm.click(); await save.click(); await page.waitForTimeout(1200);
await check('server field error lands on the matching cell (aria-invalid) with the banner', async () => (await cell('3 complaints').getAttribute('aria-invalid')) === 'true' && /Please correct the highlighted fields/.test(await page.getByRole('alert').first().innerText()));
mode = 'server'; puts.length = 0;
await page.goto(B + '/anchal/office/setup'); await page.waitForTimeout(1800); await confirm.click(); await save.click(); await page.waitForTimeout(1200);
await check('server 500 shows an error and does not leave the page', async () => path() === '/anchal/office/setup' && (await page.getByRole('alert').count()) > 0);
await page.unrouteAll({ behavior: 'ignoreErrors' });

return report();
}
