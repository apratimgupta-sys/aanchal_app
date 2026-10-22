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
const fieldErrs = async () => page.evaluate(() => [...document.querySelectorAll('.field-error')].map(e => e.textContent.trim()).join(' / '));
const fill = async (o = {}) => {
  const v = { 'Ward number / name': 'Ward 1', 'Received / Transactions': '5', 'Disposed / Completed': '3', 'SLA Within Time': '2', 'Complaints Received': '1', 'Complaints Resolved': '1', 'Field Tasks Received': '2', 'Field Tasks Completed': '1', 'Amount Collected (₹)': '100', 'Avg Disposal Days': '1.5', ...o };
  for (const [k, x] of Object.entries(v)) await f(k, x);
};
await check('negative number is blocked natively', async () => { await fill({ 'Received / Transactions': '-1' }); await sub.click(); await page.waitForTimeout(500); return writes.length === 0 && (await page.locator('input:invalid').count()) > 0; });
await check('decimal count is blocked natively', async () => { await fill({ 'Received / Transactions': '1.5' }); await sub.click(); await page.waitForTimeout(500); return writes.length === 0 && (await page.locator('input:invalid').count()) > 0; });
await check('non-numeric amount shows an error and no reload button', async () => { await fill({ 'Amount Collected (₹)': 'abc' }); await sub.click(); await page.waitForTimeout(800); return /rupees/i.test(await alerts()) && (await reload.count()) === 0 && writes.length === 0; });
await check('amount with 3 decimals is rejected', async () => { await fill({ 'Amount Collected (₹)': '10.123' }); await sub.click(); await page.waitForTimeout(800); return /rupees/i.test(await alerts()) && writes.length === 0; });
await check('huge numbers do not crash the page', async () => { await fill({ 'Received / Transactions': '99999999999999999999' }); await sub.click(); await page.waitForTimeout(800); return (await page.getByLabel('Received / Transactions').count()) === 1; });
await check('Avg Disposal Days shows a required marker once completed > 0', async () => { await fill(); return /\*/.test(await page.locator('label', { hasText: 'Avg Disposal Days' }).first().innerText()); });
await check('Avg Disposal Days empty with completed > 0 is blocked', async () => { await fill({ 'Avg Disposal Days': '' }); await sub.click(); await page.waitForTimeout(500); return writes.length === 0; });
await page.unrouteAll({ behavior: 'ignoreErrors' });

return report();
}
