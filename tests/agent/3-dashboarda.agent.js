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
// Four tiles since 20 Nov 2026. Within SLA, complaints pending and field tasks
// pending went with the fields the form stopped collecting; work done replaced
// the field-tasks balance, which no longer moves.
await check('dashboard loads with the four metric tiles', async () => { const t = await main(); return ['Total pending', 'Disposal', 'Total collection', 'Work done this period'].every(k => t.includes(k)); });
await check('the three retired tiles are gone', async () => { const t = await main(); const left = ['Within SLA', 'Complaints pending', 'Field tasks pending'].filter(k => t.includes(k)); if (left.length) throw new Error('still shows ' + left.join(', ')); return 'none of the three'; });
// The grid is four across above 1439px and two across below it, so the row
// count is only meaningful next to a viewport width.
const tileLayout = async () => page.evaluate(() => { const tiles = [...document.querySelectorAll('[data-metric]')]; const grid = document.querySelector('[data-metric]').parentElement; return { tiles: tiles.length, rows: new Set(tiles.map(t => t.getBoundingClientRect().top.toFixed(0))).size, overflow: grid.scrollWidth > grid.clientWidth }; });
await check('four tiles sit in one row on a wide screen, with no overflow', async () => {
  await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(300);
  const l = await tileLayout();
  if (!(l.tiles === 4 && l.rows === 1 && !l.overflow)) throw new Error(JSON.stringify(l));
  return '4 tiles, 1 row at 1600px';
});
await check('the same four tiles wrap to two rows at 1280px, still without overflow', async () => {
  await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300);
  const l = await tileLayout();
  if (!(l.tiles === 4 && l.rows === 2 && !l.overflow)) throw new Error(JSON.stringify(l));
  return '4 tiles, 2 rows at 1280px';
});
await check('the performance table drops SLA, complaints and field-task columns', async () => { const h = await page.evaluate(() => [...document.querySelectorAll('main table thead th')].map(e => e.textContent.trim())); const left = ['SLA %', 'Complaints Pending', 'Field Tasks Pending'].filter(k => h.includes(k)); if (left.length) throw new Error('still shows ' + left.join(', ')); return h.join(', '); });
await check('View offers Single day / Date range / Monthly', async () => { const o = await view.locator('option').allInnerTexts(); return ['Single day', 'Date range', 'Monthly'].every(x => o.includes(x)) ? o.join(',') : false; });
await check('Anchal filter lists all offices and 6 anchals', async () => (await page.getByLabel('Anchal', { exact: true }).locator('option').count()) === 7);
await check('Service filter lists 25 services plus All', async () => (await page.getByLabel('Service', { exact: true }).locator('option').count()) === 26);
await check('Refresh triggers a new dashboard request', async () => { const n = reqs.length; await refresh.click(); await page.waitForTimeout(1500); return reqs.length > n; });
await check('Anchal filter adds officeId to the request', async () => { await page.getByLabel('Anchal', { exact: true }).selectOption({ label: 'Anchal 2' }); await page.waitForTimeout(1500); return reqs.some(q => q.includes('officeId=2')); });
await check('Service filter adds serviceId to the request', async () => { await page.getByLabel('Service', { exact: true }).selectOption({ index: 1 }); await page.waitForTimeout(1500); return reqs.some(q => q.includes('serviceId=')); });
await check('resetting filters removes them from the request', async () => { await page.getByLabel('Anchal', { exact: true }).selectOption({ index: 0 }); await page.getByLabel('Service', { exact: true }).selectOption({ index: 0 }); const n = reqs.length; await page.waitForTimeout(1500); return !reqs.slice(-1)[0].includes('officeId'); });

return report();
}
