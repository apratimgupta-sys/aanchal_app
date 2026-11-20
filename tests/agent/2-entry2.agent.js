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
const fieldErrs = async () => page.evaluate(() => [...document.querySelectorAll('.field-error')].map(e => e.textContent.trim()).join(' / '));
const pick = async (id) => { await page.locator('[aria-label="Municipal services"] li').nth(id - 1).locator('button').click(); await page.waitForTimeout(400); };
const fields = async () => page.evaluate(() => [...document.querySelectorAll('.entry-panel form input, .entry-panel form textarea')].map(el => { const id = el.getAttribute('id'); const lab = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null; return (el.getAttribute('aria-label') ?? lab?.textContent ?? '').replace(/\s*\*\s*$/, '').trim(); }));
// The three rules that used to live here — within-SLA vs completed, resolved vs
// received complaints, completed vs received field tasks — are gone, because no
// shape asks for either side of them. What is checked instead is that each shape
// asks only its own questions, and that the one surviving rule fires only where
// both of its operands are collected.
await check('counter shape (01) keeps the disposed-vs-received rule', async () => {
  await pick(1);
  await f('Ward number / name', 'Ward 1'); await f('Received', '5'); await f('Disposed', '9');
  await sub.click(); await page.waitForTimeout(800);
  return /cannot exceed received/i.test(await fieldErrs()) && writes.length === 0;
});
await check('revenue shape (02) asks for payments and an amount, never a disposal', async () => {
  await pick(2);
  const shown = await fields();
  if (!(shown.includes('Payments') && shown.includes('Amount Collected (₹)') && !shown.includes('Disposed') && !shown.includes('Received'))) throw new Error('shows ' + shown.join(', '));
  return shown.join(', ');
});
await check('field-work shape (09) asks only what was done, under its own label', async () => {
  await pick(9);
  const shown = await fields();
  if (!(shown.includes('Routes') && !shown.includes('Received') && !shown.includes('Amount Collected (₹)'))) throw new Error('shows ' + shown.join(', '));
  return shown.join(', ');
});
await check('field work with no request behind it is not blocked', async () => {
  // A crew can fog a route nobody asked for. The disposed-vs-received rule must
  // not fire on a shape that never collects a received figure.
  await f('Ward number / name', 'Ward 1'); await f('Routes', '7');
  writes.length = 0; await sub.click(); await page.waitForTimeout(1200);
  const errs = await fieldErrs();
  if (!(errs === '' && writes.length === 1)) throw new Error(`errors "${errs}", requests ${writes.length}`);
  return 'submitted, no field error';
});
await check('neither balance strip renders on a shape with no queue', async () => {
  return (await page.locator('.balance-strip').count()) === 0 && (await page.locator('.closing-strip').count()) === 0;
});
await page.unrouteAll({ behavior: 'ignoreErrors' });

return report();
}
