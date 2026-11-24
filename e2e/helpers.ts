/** Shared setup for the browser tests: a fresh demo profile in the chosen language, with console errors collected. */
import { expect, type Page } from '@playwright/test';

export type Lang = 'fa' | 'en';

export async function openApp(page: Page, lang: Lang = 'fa', path = '/') {
  const errors: string[] = [];
  /** Requests that leave the app's own origin (fonts and media must be served by the app itself) */
  const external: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost') && !r.url().startsWith('data:')) external.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(l => {
    if (sessionStorage.getItem('e2e-init')) return;
    sessionStorage.setItem('e2e-init', '1');
    localStorage.clear();
    localStorage.setItem('daf_lang', l);
    localStorage.setItem('daf_demo_overdue_seen', '1');
  }, lang);
  await page.goto(path);
  await expect(page.getByRole('banner').or(page.getByTestId('story-reader'))).toBeVisible();
  await closeDialogs(page);
  return { errors, external };
}

/** First-visit notices open on their own; close them so they don't cover the page. */
export async function closeDialogs(page: Page) {
  for (let i = 0; i < 3 && await page.locator('[role="dialog"]').count(); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
}

/** The tab bar: the bottom bar on phones, the header bar on desktop. */
export function tabBar(page: Page) {
  const phone = (page.viewportSize()?.width ?? 1280) < 1280;
  return phone ? page.locator('nav').last() : page.locator('header nav').first();
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}
