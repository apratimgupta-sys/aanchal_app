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
const fieldErrs = async () => page.evaluate(() => [...document.querySelectorAll('[data-field-error]')].map(e => e.textContent.trim()).join(' / '));
// The form takes three shapes now, so a service has to be chosen before it can be filled.
// The list shows each service's place in it, not its id (grouped by shape).
const POSITION = { 1: '01', 3: '02', 4: '03', 7: '04', 11: '05', 12: '06', 18: '07', 19: '08', 20: '09', 21: '10', 22: '11', 23: '12', 24: '13', 25: '14', 2: '15', 5: '16', 6: '17', 8: '18', 9: '19', 10: '20', 13: '21', 14: '22', 15: '23', 16: '24', 17: '25' };
const pick = async (id) => { await page.getByRole('button', { name: new RegExp('^' + POSITION[id] + '(?!\\d)') }).click(); await page.waitForTimeout(400); };
// Counter shape: ward, received, disposed. Nothing else is collected.
const fill = async (o = {}) => {
  const v = { 'Ward number / name': 'Ward 1', 'Received': '5', 'Disposed': '3', ...o };
  for (const [k, x] of Object.entries(v)) await f(k, x);
};
// The fields the form stopped collecting on 20 Nov 2026. None of them may render on any shape.
const RETIRED = ['SLA Within Time', 'Complaints Received', 'Complaints Resolved', 'Field Tasks Received', 'Field Tasks Completed', 'Avg Disposal Days'];
const retiredOn = async () => { const out = []; for (const l of RETIRED) if (await page.getByLabel(l).count()) out.push(l); return out; };
await check('header shows 25 services and progress 0 / 25', async () => /0 \/ 25/.test(await body()) && (await page.locator('[aria-label="Municipal services"] button:not([aria-expanded])').count()) === 25);
await check('service 01 takes the counter shape: received and disposed only', async () => {
  await pick(1);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.entry-panel form input, .entry-panel form textarea')].map(el => { const id = el.getAttribute('id'); const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null; return (el.getAttribute('aria-label') ?? lab?.textContent ?? '').replace(/\s*\*\s*$/, '').trim(); }));
  const want = ['Reporting / registration date', 'Ward number / name', 'Received', 'Disposed', 'Remarks'];
  if (JSON.stringify(shown) !== JSON.stringify(want)) throw new Error('shows ' + shown.join(', '));
  return shown.join(', ');
});
await check('no retired field renders on the counter shape', async () => { const on = await retiredOn(); if (on.length) throw new Error('still shows ' + on.join(', ')); return 'none of ' + RETIRED.length; });
await check('empty submit is blocked by required fields (no request)', async () => { await sub.click(); await page.waitForTimeout(500); return writes.length === 0 && (await page.locator('input:invalid').count()) > 0; });
await check('closing pending updates live (received 5, disposed 3)', async () => { await fill(); const t = (await page.locator('[data-closing]').innerText()).replace(/\n+/g, ' '); return /Closing pending\s+\d/.test(t) ? t : false; });
await check('disposed above received -> field error, no request, no reload button', async () => {
  await fill({ 'Disposed': '9' }); await sub.click(); await page.waitForTimeout(800);
  return /cannot exceed received/i.test(await fieldErrs()) && writes.length === 0 && (await reload.count()) === 0 ? await fieldErrs() : false;
});
await page.unrouteAll({ behavior: 'ignoreErrors' });

return report();
}
