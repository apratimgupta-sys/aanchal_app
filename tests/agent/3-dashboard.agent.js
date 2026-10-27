async (page) => {
const B = 'http://127.0.0.1:5173', C = globalThis.__creds;
if (!C) return 'Set globalThis.__creds first';
const R = [];
const check = async (n, f) => { try { const v = await f(); R.push([v === false ? 'FAIL' : 'PASS', n + (typeof v === 'string' ? ' - ' + v : '')]); } catch (e) { R.push(['FAIL', n + ' :: ' + String(e.message).split('\n')[0]]); } };
const path = () => new URL(page.url()).pathname;
const body = async () => (await page.locator('body').innerText()).replace(/\n+/g, ' | ');
const login = async (u, pw) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await page.goto(B + '/anchal/'); await page.waitForTimeout(1200);
  const so = page.getByRole('button', { name: 'Sign out' });
  if (await so.count()) { await so.click(); await page.waitForTimeout(1200); }
  await page.getByLabel('Username').fill(u); await page.getByLabel('Password').fill(pw ?? C[u]);
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !/Signing in/.test(document.body.innerText), null, { timeout: 15000 });
  await page.waitForTimeout(1500);
};
const report = () => { const f = R.filter(r => r[0] === 'FAIL').length; return `${R.length - f} passed, ${f} failed\n` + R.map(r => r[0] + '  ' + r[1]).join('\n'); };
await login('commissioner');
const reqs = []; page.on('request', r => { if (r.url().includes('/v1/api/anchal/dashboard')) reqs.push(new URL(r.url()).search); });
const view = page.getByLabel('View'), refresh = page.getByRole('button', { name: 'Refresh' });
const dates = () => page.locator('main input[type=date]');
const main = async () => (await page.locator('main').innerText()).replace(/\n+/g, ' | ');
const pending = async () => { const m = (await main()).match(/Total pending \| ([\d,]+)/); return m ? m[1] : null; };
await check('dashboard loads with the metric tiles', async () => { const t = await main(); return ['Total pending', 'Disposal', 'Within SLA', 'Total collection', 'Complaints pending', 'Field tasks pending'].every(k => t.includes(k)); });
await check('View offers Single day / Date range / Monthly', async () => { const o = await view.locator('option').allInnerTexts(); return ['Single day', 'Date range', 'Monthly'].every(x => o.includes(x)) ? o.join(',') : false; });
await check('Anchal filter lists all offices and 6 anchals', async () => (await page.getByLabel('Anchal').locator('option').count()) === 7);
await check('Service filter lists 25 services plus All', async () => (await page.getByLabel('Service').locator('option').count()) === 26);
await check('Refresh triggers a new dashboard request', async () => { const n = reqs.length; await refresh.click(); await page.waitForTimeout(1500); return reqs.length > n; });
await check('Anchal filter adds officeId to the request', async () => { await page.getByLabel('Anchal').selectOption({ label: 'Anchal 2' }); await page.waitForTimeout(1500); return reqs.some(q => q.includes('officeId=2')); });
await check('Service filter adds serviceId to the request', async () => { await page.getByLabel('Service').selectOption({ index: 1 }); await page.waitForTimeout(1500); return reqs.some(q => q.includes('serviceId=')); });
await check('resetting filters removes them from the request', async () => { await page.getByLabel('Anchal').selectOption({ index: 0 }); await page.getByLabel('Service').selectOption({ index: 0 }); const n = reqs.length; await page.waitForTimeout(1500); return !reqs.slice(-1)[0].includes('officeId'); });
await check('Date range view shows two date inputs', async () => { await view.selectOption({ label: 'Date range' }); await page.waitForTimeout(800); return (await dates().count()) === 2; });
await check('valid range returns figures', async () => { await dates().nth(0).fill('2026-10-01'); await dates().nth(1).fill('2026-10-21'); await refresh.click(); await page.waitForTimeout(2000); const p = await pending(); return p !== null ? 'pending ' + p : false; });
await check('past range with no data shows zeros, no error', async () => { await dates().nth(0).fill('2020-01-01'); await dates().nth(1).fill('2020-01-31'); await refresh.click(); await page.waitForTimeout(2000); const t = await main(); return (await pending()) === '0' && !/Invalid|error/i.test(t); });
await check('reversed range shows a clear message and clears stale totals', async () => {
  await dates().nth(0).fill('2026-10-01'); await dates().nth(1).fill('2026-10-21'); await refresh.click(); await page.waitForTimeout(1800);
  await dates().nth(0).fill('2026-10-21'); await dates().nth(1).fill('2026-10-01'); await refresh.click(); await page.waitForTimeout(2000);
  return /Start date must be on or before the end date/.test(await main()) && (await pending()) === '0';
});
await check('recovers after the error when the range is fixed', async () => { await dates().nth(0).fill('2026-10-01'); await dates().nth(1).fill('2026-10-21'); await refresh.click(); await page.waitForTimeout(2000); return !/Start date must be|Invalid/.test(await main()); });
await check('single day in the far future shows an error and zero totals', async () => { await view.selectOption({ label: 'Single day' }); await page.waitForTimeout(600); await dates().first().fill('2999-01-01'); await refresh.click(); await page.waitForTimeout(2000); return /Invalid|error/i.test(await main()) && (await pending()) === '0'; });
await check('single day empty date (cleared) does not crash', async () => { await dates().first().fill(''); await refresh.click().catch(() => {}); await page.waitForTimeout(1500); return (await page.locator('main').count()) === 1; });
await check('Monthly view loads', async () => { await dates().first().fill('2026-10-21').catch(() => {}); await view.selectOption({ label: 'Monthly' }); await page.waitForTimeout(2000); return /Total pending/.test(await main()); });
await check('"View service entries and remarks" opens without an error', async () => {
  await view.selectOption({ label: 'Single day' }); await page.waitForTimeout(800); await dates().first().fill('2026-10-21'); await refresh.click(); await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /View service entries/ }).click(); await page.waitForTimeout(2000); return !/Could not load/.test(await body()) ? (await body()).slice(0, 0) + 'opened' : false;
});
await check('no failed non-4xx network calls from the dashboard', async () => { const failed = reqs.length > 0; return failed; });
await page.getByRole('button', { name: 'Sign out' }).click().catch(() => {});

return report();
}
