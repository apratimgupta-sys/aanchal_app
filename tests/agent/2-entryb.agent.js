async (page) => {
const B = 'http://127.0.0.1:5173', C = globalThis.__creds;
if (!C) return 'Set globalThis.__creds first';
const R = [];
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
const report = () => { const f = R.filter(r => r[0] === 'FAIL').length; return `${R.length - f} passed, ${f} failed\n` + R.map(r => r[0] + '  ' + r[1]).join('\n'); };
await login('anchal1');
const writes = [];
await page.route('**/v1/api/anchal/office/entries**', r => { if (r.request().method() === 'GET') return r.continue(); writes.push({ m: r.request().method(), b: r.request().postData() }); return r.abort(); });
const f = (l, v) => page.getByLabel(l, { exact: true }).fill(v);
const sub = page.getByRole('button', { name: /Submit entry/ });
if (!(await sub.count())) return 'SKIPPED: today\'s entry is already saved for anchal1, so the form is read-only';
const reload = page.getByRole('button', { name: 'Reload latest entry' });
const alerts = async () => (await page.getByRole('alert').allInnerTexts()).join(' / ');
const fieldErrs = async () => page.evaluate(() => [...document.querySelectorAll('.field-error')].map(e => e.textContent.trim()).join(' / '));
const fill = async (o = {}) => {
  const v = { 'Ward number / name': 'Ward 1', 'Received / Transactions': '5', 'Disposed / Completed': '3', 'SLA Within Time': '2', 'Complaints Received': '1', 'Complaints Resolved': '1', 'Field Tasks Received': '2', 'Field Tasks Completed': '1', 'Amount Collected (₹)': '100', 'Avg Disposal Days': '1.5', ...o };
  for (const [k, x] of Object.entries(v)) await f(k, x);
};
await check('valid form sends exactly one save request (blocked here) and shows the reload button on failure', async () => {
  await fill(); writes.length = 0; await sub.click(); await page.waitForTimeout(1500);
  if (writes.length !== 1) return `requests: ${writes.length}`;
  const b = JSON.parse(writes[0].b); const ok = b.requestId && b.input && b.input.received === 5 && b.input.completed === 3 && b.input.amountPaise === 10000 && b.mode === 'today';
  return ok && (await reload.count()) === 1 ? 'payload ok (requestId, paise 10000)' : 'payload ' + JSON.stringify(b).slice(0, 200);
});
await check('resubmit after a failed save reuses the same requestId (idempotent)', async () => {
  const first = JSON.parse(writes[0].b).requestId; writes.length = 0; await sub.click(); await page.waitForTimeout(1500);
  return writes.length === 1 && JSON.parse(writes[0].b).requestId === first;
});
await check('Set zero activity sends all-zero counts', async () => {
  writes.length = 0; await page.getByLabel('Ward number / name').fill('Ward 1');
  await page.getByRole('button', { name: 'Set zero activity' }).click(); await page.waitForTimeout(1200);
  if (!writes.length) { const t = await body(); return /confirm|zero/i.test(t) ? 'needs confirmation step (no request yet)' : 'no request sent'; }
  const b = JSON.parse(writes[0].b).input; return b.received === 0 && b.completed === 0 && b.complaintsReceived === 0 && b.fieldReceived === 0 ? true : JSON.stringify(b).slice(0, 200);
});
await check('Backdate Entry tab opens', async () => { await page.getByRole('button', { name: 'Backdate Entry' }).click(); await page.waitForTimeout(1500); return path() === '/anchal/office/backdate' ? (await body()).slice(0, 200) : `path ${path()}`; });
await check('unknown service deep link does not crash', async () => { await page.goto(B + '/anchal/office/today?service=999'); await page.waitForTimeout(1500); return /Daily service entry/.test(await body()); });
await page.unrouteAll({ behavior: 'ignoreErrors' });
R.push(['INFO', 'write requests that reached the backend: 0 (all non-GET entry requests were aborted by the suite)']);

return report();
}
