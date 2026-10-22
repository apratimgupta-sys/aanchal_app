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
await login('commissioner');
const reqs = []; page.on('request', r => { if (r.url().includes('/v1/api/anchal/dashboard')) reqs.push(new URL(r.url()).search); });
const view = page.getByLabel('View'), refresh = page.getByRole('button', { name: 'Refresh' });
const dates = () => page.locator('main input[type=date]');
const main = async () => (await page.locator('main').innerText()).replace(/\n+/g, ' | ');
const pending = async () => { const m = (await main()).match(/Total pending \| ([\d,]+)/); return m ? m[1] : null; };
await check('dashboard loads with the metric tiles', async () => { const t = await main(); return ['Total pending', 'Disposal', 'Within SLA', 'Total collection', 'Complaints pending', 'Field tasks pending'].every(k => t.includes(k)); });
await check('View offers Single day / Date range / Monthly', async () => { const o = await view.locator('option').allInnerTexts(); return ['Single day', 'Date range', 'Monthly'].every(x => o.includes(x)) ? o.join(',') : false; });
await check('Anchal filter lists all offices and 6 anchals', async () => (await page.getByLabel('Anchal').locator('option').count()) === 7);
await check('Service filter lists 25 services plus All', async () => (await page.getByLabel('Service', { exact: true }).locator('option').count()) === 26);
await check('Refresh triggers a new dashboard request', async () => { const n = reqs.length; await refresh.click(); await page.waitForTimeout(1500); return reqs.length > n; });
await check('Anchal filter adds officeId to the request', async () => { await page.getByLabel('Anchal').selectOption({ label: 'Anchal 2' }); await page.waitForTimeout(1500); return reqs.some(q => q.includes('officeId=2')); });
await check('Service filter adds serviceId to the request', async () => { await page.getByLabel('Service', { exact: true }).selectOption({ index: 1 }); await page.waitForTimeout(1500); return reqs.some(q => q.includes('serviceId=')); });
await check('resetting filters removes them from the request', async () => { await page.getByLabel('Anchal').selectOption({ index: 0 }); await page.getByLabel('Service', { exact: true }).selectOption({ index: 0 }); const n = reqs.length; await page.waitForTimeout(1500); return !reqs.slice(-1)[0].includes('officeId'); });

return report();
}
