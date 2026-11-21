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
const writes = [];
await page.route('**/v1/api/anchal/office/entries**', r => { if (r.request().method() === 'GET') return r.continue(); writes.push({ m: r.request().method(), b: r.request().postData() }); return r.abort(); });
const f = (l, v) => page.getByLabel(l).fill(v);
const sub = page.getByRole('button', { name: /Submit entry/ });
if (!(await sub.count())) return 'SKIPPED: today\'s entry is already saved for anchal1, so the form is read-only';
const reload = page.getByRole('button', { name: 'Reload latest entry' });
const alerts = async () => (await page.getByRole('alert').allInnerTexts()).join(' / ');
const pick = async (id) => { await page.getByRole('button', { name: new RegExp('^' + String(id).padStart(2, '0') + '(?!\\d)') }).click(); await page.waitForTimeout(400); };
// Counter shape for the number checks; money lives on the revenue shape alone.
const fill = async (o = {}) => {
  const v = { 'Ward number / name': 'Ward 1', 'Received': '5', 'Disposed': '3', ...o };
  for (const [k, x] of Object.entries(v)) await f(k, x);
};
const money = async (o = {}) => {
  const v = { 'Ward number / name': 'Ward 1', 'Payments': '4', 'Amount Collected (₹)': '100', ...o };
  for (const [k, x] of Object.entries(v)) await f(k, x);
};
await pick(1);
await check('negative number is blocked natively', async () => { await fill({ 'Received': '-1' }); await sub.click(); await page.waitForTimeout(500); return writes.length === 0 && (await page.locator('input:invalid').count()) > 0; });
await check('decimal count is blocked natively', async () => { await fill({ 'Received': '1.5' }); await sub.click(); await page.waitForTimeout(500); return writes.length === 0 && (await page.locator('input:invalid').count()) > 0; });
await check('huge numbers do not crash the page', async () => { await fill({ 'Received': '99999999999999999999' }); await sub.click(); await page.waitForTimeout(800); return (await page.getByLabel('Received').count()) === 1; });
await pick(2);
await check('non-numeric amount shows an error and no reload button', async () => { writes.length = 0; await money({ 'Amount Collected (₹)': 'abc' }); await sub.click(); await page.waitForTimeout(800); return /rupees/i.test(await alerts()) && (await reload.count()) === 0 && writes.length === 0; });
await check('amount with 3 decimals is rejected', async () => { await money({ 'Amount Collected (₹)': '10.123' }); await sub.click(); await page.waitForTimeout(800); return /rupees/i.test(await alerts()) && writes.length === 0; });
// Average disposal days was dropped from every shape on 20 Nov 2026: it is
// neither asked for nor required, so nothing can be blocked on it any more.
await check('no shape asks for average disposal days', async () => {
  const on = [];
  for (const id of [1, 2, 9]) { await pick(id); if (await page.getByLabel('Avg Disposal Days').count()) on.push(id); }
  if (on.length) throw new Error('still on services ' + on.join(', '));
  return 'absent on counter, revenue and field work';
});
await page.unrouteAll({ behavior: 'ignoreErrors' });

return report();
}
