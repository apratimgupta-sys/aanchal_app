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
await signedOut();
const submit = page.getByRole('button', { name: /Sign in/ });
await check('empty submit shows both required messages', async () => {
  await submit.click(); await page.waitForTimeout(400);
  const t = await body(); return /Username is required/.test(t) && /Password is required/.test(t);
});
await check('wrong password: stays signed out and shows a visible error', async () => {
  await page.getByLabel('Username').fill('anchal1'); await page.getByLabel('Password').fill('not-the-password');
  await submit.click(); await page.waitForTimeout(2500);
  const t = await body(); const m = t.match(/[^|]*(invalid|incorrect|wrong|failed|unauthori)[^|]*/i);
  if (path() !== '/anchal/') return false;
  return m ? m[0].trim() : false;
});
await check('unknown user is rejected', async () => {
  await page.getByLabel('Username').fill('nobody'); await page.getByLabel('Password').fill('x');
  await submit.click(); await page.waitForTimeout(2500); return path() === '/anchal/';
});
await check('very long username/password do not crash the form', async () => {
  await page.getByLabel('Username').fill('a'.repeat(5000)); await page.getByLabel('Password').fill('b'.repeat(5000));
  await submit.click(); await page.waitForTimeout(2500); return path() === '/anchal/' && (await page.getByLabel('Username').count()) === 1;
});

return report();
}
