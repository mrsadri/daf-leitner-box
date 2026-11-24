/**
 * The adjective drill end to end in demo mode: home card -> start -> answer a couple of rounds -> time
 * runs out (Playwright's mocked clock, no real 5-minute wait) -> end screen -> «رقابت» -> «صفت‌ها» shows
 * the run. A second test checks the leave-mid-run confirmation when navigating away via the navbar.
 */
import { test, expect } from '@playwright/test';
import { openApp, noHorizontalScroll } from './helpers';

const RECORDS_TAB = { fa: /صفت‌ها/, en: /adjectives/i };
const VIEW_RECORDS_BUTTON = { fa: /مشاهده جدول رکوردها/, en: /view the records board/i };
const CANCEL_LEAVE = { fa: /ادامه مسابقه/, en: /keep playing/i };
const CONFIRM_LEAVE = { fa: /خروج و رها کردن/, en: /leave and abandon/i };

for (const lang of ['fa', 'en'] as const) {
  test(`play the adjective drill to the end and see it on the records board (${lang})`, async ({ page }) => {
    const { errors, external } = await openApp(page, lang, '/?go=dashboard');
    await page.clock.install();

    await page.getByTestId('dashboard-adjective').click();
    await expect(page.getByTestId('adjective-start')).toBeVisible();
    await noHorizontalScroll(page);

    await page.getByTestId('adjective-start-button').click();
    await expect(page.getByTestId('adjective-running')).toBeVisible();

    // Answer a couple of rounds: any ending works here, this isn't testing grammar
    for (let round = 0; round < 2; round++) {
      const groups = page.getByTestId('ending-group');
      const count = await groups.count();
      for (let i = 0; i < count; i++) {
        await groups.nth(i).locator('[role="radio"]').first().click();
      }
      await expect(page.getByTestId('adjective-next')).toBeVisible();
      await page.getByTestId('adjective-next').click();
    }

    // Time runs out: the fixed-end-time timer, not accumulated ticks, so a single jump is enough
    await page.clock.fastForward('05:30');
    await expect(page.getByTestId('adjective-finished')).toBeVisible();

    await page.getByRole('button', { name: VIEW_RECORDS_BUTTON[lang] }).click();
    await expect(page.getByRole('tab', { name: RECORDS_TAB[lang] })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('table')).toContainText('Demo');

    expect(errors).toEqual([]);
    expect(external, 'requests to other hosts').toEqual([]);
  });

  test(`leaving mid-run via the navbar asks to confirm (${lang})`, async ({ page }) => {
    const { errors, external } = await openApp(page, lang, '/?go=dashboard');

    await page.getByTestId('dashboard-adjective').click();
    await page.getByTestId('adjective-start-button').click();
    await expect(page.getByTestId('adjective-running')).toBeVisible();

    // Cancel: still running
    await page.getByTestId('nav-brand').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: CANCEL_LEAVE[lang] }).click();
    await expect(page.getByTestId('adjective-running')).toBeVisible();

    // Confirm: the run is abandoned, back on the home screen (Stories)
    await page.getByTestId('nav-brand').click();
    await page.getByRole('dialog').getByRole('button', { name: CONFIRM_LEAVE[lang] }).click();
    await expect(page.getByTestId('stories-shelf')).toBeVisible();
    await expect(page.getByTestId('adjective-running')).toHaveCount(0);

    expect(errors).toEqual([]);
    expect(external, 'requests to other hosts').toEqual([]);
  });
}

test('a deep link opens the adjective drill', async ({ page }) => {
  await openApp(page, 'en', '/?go=adjective');
  await expect(page.getByTestId('adjective-start')).toBeVisible();
});
