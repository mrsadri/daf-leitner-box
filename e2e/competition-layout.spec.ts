import { test, expect } from '@playwright/test';
import { openApp, noHorizontalScroll } from './helpers';

for (const lang of ['fa', 'en'] as const) {
  test(`competition separates rank, score and periods (${lang})`, async ({ page }, info) => {
    const { errors, external } = await openApp(page, lang, '/?go=leaderboard');
    await expect(page.getByTestId('personal-rank')).toHaveText(lang === 'fa' ? '۲' : '2');
    await expect(page.getByTestId('personal-score')).toHaveText(lang === 'fa' ? '۹۶۰' : '960');
    await expect(page.locator('thead th')).toHaveCount(3);
    await page.getByRole('radio').nth(1).click();
    await expect(page.getByTestId('personal-score')).toContainText(lang === 'fa' ? '۸۵' : '85');
    await expect(page.locator('tbody tr').last().locator('td').last().locator('bdi')).toHaveAttribute('dir', 'ltr');
    await page.locator('tbody summary').last().click();
    await page.setViewportSize({ width: 320, height: 740 });
    await noHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath('competition-small.png'), fullPage: true });
    await page.getByRole('tab', { name: lang === 'fa' ? /صفت‌ها/ : /adjectives/i }).click();
    await expect(page.getByTestId('personal-rank')).toHaveText(lang === 'fa' ? '۳' : '3');
    await expect(page.getByTestId('personal-score')).toHaveText('–');
    await expect(page.locator('table')).toContainText('Demo');
    await page.emulateMedia({ colorScheme: 'dark' });
    await noHorizontalScroll(page);
    await page.screenshot({ path: info.outputPath('competition-dark.png'), fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
