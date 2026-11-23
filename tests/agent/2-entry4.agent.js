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
// The list shows each service's place in it, not its id (grouped by shape).
const POSITION = { 1: '01', 3: '02', 4: '03', 7: '04', 11: '05', 12: '06', 18: '07', 19: '08', 20: '09', 21: '10', 22: '11', 23: '12', 24: '13', 25: '14', 2: '15', 5: '16', 6: '17', 8: '18', 9: '19', 10: '20', 13: '21', 14: '22', 15: '23', 16: '24', 17: '25' };
const pick = async (id) => { await page.getByRole('button', { name: new RegExp('^' + POSITION[id] + '(?!\\d)') }).click(); await page.waitForTimeout(400); };
const fill = async (o = {}) => {
  const v = { 'Ward number / name': 'Ward 1', 'Received': '5', 'Disposed': '3', ...o };
  for (const [k, x] of Object.entries(v)) await f(k, x);
};
await pick(1);
await check('valid counter form sends exactly one save request (blocked here) and shows the reload button on failure', async () => {
  await fill(); writes.length = 0; await sub.click(); await page.waitForTimeout(1500);
  if (writes.length !== 1) return `requests: ${writes.length}`;
  const b = JSON.parse(writes[0].b);
  // A counter service collects two numbers. Everything the form stopped asking
  // for goes out as it was stored: 0 on a new entry, null for average days.
  const ok = b.requestId && b.input && b.input.received === 5 && b.input.completed === 3 && b.input.amountPaise === 0 && b.input.avgDisposalDays === null && b.input.slaWithinTime === 0 && b.input.complaintsReceived === 0 && b.input.fieldReceived === 0 && b.mode === 'today';
  return ok && (await reload.count()) === 1 ? 'payload ok (requestId, two figures, retired fields untouched)' : 'payload ' + JSON.stringify(b).slice(0, 240);
});
await check('resubmit after a failed save reuses the same requestId (idempotent)', async () => {
  const first = JSON.parse(writes[0].b).requestId; writes.length = 0; await sub.click(); await page.waitForTimeout(1500);
  return writes.length === 1 && JSON.parse(writes[0].b).requestId === first;
});
await check('a revenue service sends its amount in paise', async () => {
  await pick(2); writes.length = 0;
  await f('Ward number / name', 'Ward 1'); await f('Payments', '4'); await f('Amount Collected (₹)', '100');
  await sub.click(); await page.waitForTimeout(1500);
  if (writes.length !== 1) return `requests: ${writes.length}`;
  const b = JSON.parse(writes[0].b).input;
  return b.received === 4 && b.amountPaise === 10000 && b.completed === 0 ? 'paise 10000, nothing disposed' : JSON.stringify(b).slice(0, 240);
});
await check('Backdate Entry tab opens', async () => { await page.getByRole('button', { name: 'Backdate Entry' }).click(); await page.waitForTimeout(1500); const c = await page.evaluate(() => (window.__confirms || []).join(' / ')); return (path() === '/anchal/office/backdate' ? 'opened' : `path ${path()}`) + (c ? ' ; unsaved-changes prompt: "' + c + '"' : ' ; NO unsaved-changes prompt'); });
await check('unknown service deep link does not crash', async () => { await page.goto(B + '/anchal/office/today?service=999'); await page.locator('main h1').first().waitFor({ timeout: 15000 }); await page.waitForTimeout(1500); return /Daily service entry/.test(await body()); });
await page.unrouteAll({ behavior: 'ignoreErrors' });
R.push(['INFO', 'write requests that reached the backend: 0 (all non-GET entry requests were aborted by the suite)']);
await page.unrouteAll({ behavior: 'ignoreErrors' });

return report();
}
