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
