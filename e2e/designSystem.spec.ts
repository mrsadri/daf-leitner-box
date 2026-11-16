/** The design-system gallery renders without errors, and the shared Dialog behaves (Esc, focus trap, focus return, scroll lock). */
import { test, expect } from '@playwright/test';
import { noHorizontalScroll } from './helpers';

test('gallery renders without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?gallery=1');
  await expect(page.getByRole('heading', { name: 'Design system' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('radio', { name: 'LTR' }).click();
  await noHorizontalScroll(page);
  expect(errors).toEqual([]);
});

for (const placement of ['dialog', 'sheet'] as const) {
  test(`dialog (${placement}): Esc closes, focus stays inside and returns`, async ({ page }) => {
    await page.goto('/?gallery=1');
    const opener = page.getByTestId(`open-${placement}`);
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Dialog title' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm' })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    // Tab never leaves the dialog
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
  });
}
