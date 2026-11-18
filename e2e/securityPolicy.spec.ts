import { test, expect } from '@playwright/test';

// Synthetic browser probes only: no OAuth credentials, real database or notification delivery.
test('enforced policy allows worker and Supabase transport but blocks injected scripts and other transports', async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', event => {
      document.documentElement.dataset.lastViolation = event.effectiveDirective;
    });
  });
  const root = await page.goto('/');
  const policy = root!.headers()['content-security-policy'];
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("script-src 'self'");
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__injectedByProbe = true';
    document.body.appendChild(script);
  });
  await expect(page.locator('html')).toHaveAttribute('data-last-violation', 'script-src-elem');
  expect(await page.evaluate(() => '__injectedByProbe' in window)).toBe(false);

  await page.route('https://policy-probe.supabase.co/**', route => route.fulfill({
    status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"synthetic":true}',
  }));
  expect(await page.evaluate(async () => (await fetch('https://policy-probe.supabase.co/rest/v1/probe')).json())).toEqual({ synthetic: true });
  let escaped = false;
  await page.route('https://forbidden.invalid/**', route => { escaped = true; return route.abort(); });
  expect(await page.evaluate(async () => {
    try { await fetch('https://forbidden.invalid/'); return false; } catch { return true; }
  })).toBe(true);
  expect(escaped).toBe(false);
  await expect(page.locator('html')).toHaveAttribute('data-last-violation', 'connect-src');

  expect(await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    return new URL(registration.scope).origin === location.origin;
  })).toBe(true);
});
