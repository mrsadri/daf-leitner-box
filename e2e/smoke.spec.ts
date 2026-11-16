/** Every tab opens without errors and without sideways scrolling, in both languages, on phone and desktop. */
import { test, expect } from '@playwright/test';
import { openApp, tabBar, noHorizontalScroll, closeDialogs } from './helpers';

for (const lang of ['fa', 'en'] as const) {
  test(`every tab opens (${lang})`, async ({ page }) => {
    const { errors, external } = await openApp(page, lang);
    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'fa' ? 'rtl' : 'ltr');
    const tabs = tabBar(page).locator('button');
    const count = await tabs.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i++) {
      await tabBar(page).locator('button').nth(i).click();
      await expect(tabBar(page).locator('button').nth(i)).toHaveAttribute('aria-current', 'page');
      await closeDialogs(page);
      await noHorizontalScroll(page);
    }
    expect(errors).toEqual([]);
    expect(external, 'requests to other hosts').toEqual([]);
  });
}
