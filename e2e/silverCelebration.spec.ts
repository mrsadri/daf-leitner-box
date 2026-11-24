/**
 * Silver card celebration (demo build): the 16th correct answer of the day opens today's silver card during review,
 * with its fact and the sprinkles; once closed it doesn't come back, and older cards never pop up.
 */
import { test, expect, type Page } from '@playwright/test';
import { openApp } from './helpers';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran' }).format(new Date());

async function seedSilver(page: Page, correctToday: number, total: number, seen: number | null) {
  await page.evaluate(v => {
    localStorage.setItem('daf_silver_demo-user', JSON.stringify({ day: v.day, correctToday: v.correctToday, earnedToday: false, total: v.total, protocol: 'verified' }));
    if (v.seen === null) localStorage.removeItem('daf_silver_seen_demo-user');
    else localStorage.setItem('daf_silver_seen_demo-user', String(v.seen));
  }, { day: today(), correctToday, total, seen });
  await page.reload();
  await expect(page.getByRole('banner')).toBeVisible();
}

/** Answer review cards with "Knew it" (skipping cards that need a Perfekt first) until one correct answer counts. */
async function answerOneCorrect(page: Page) {
  const knew = page.getByRole('button', { name: /Knew it/ }).first();
  const forgot = page.getByRole('button', { name: /Didn't know/ }).first();
  for (let i = 0; i < 20; i++) {
    await expect(knew.or(forgot).first()).toBeVisible();
    if (await knew.isEnabled()) { await knew.click(); return; }
    await forgot.click();
  }
  throw new Error('no card could be answered correctly');
}

test('the 16th correct answer of the day opens the silver card, once', async ({ page }) => {
  const { errors } = await openApp(page, 'en');
  await seedSilver(page, 15, 2, 2);

  await page.getByRole('button', { name: /Start today's review/ }).click();
  await answerOneCorrect(page);

  const dialog = page.getByTestId('silver-earned');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('dialog')).toContainText('You earned a silver card!');
  await expect(dialog).toContainText('Silver card 3 of 60');
  await expect(dialog).toContainText('One language, six countries!');   // the fact of card 3
  await expect(dialog.getByTestId('silver-sprinkles')).toHaveAttribute('aria-hidden', 'true');

  // Focus starts on "Continue"; closing it returns to the review
  await expect(dialog.getByRole('button', { name: 'Continue' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('daf_silver_seen_demo-user'))).toBe('3');

  // More correct answers the same day, and a reload: no second celebration
  await answerOneCorrect(page);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('silver-earned')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('banner')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('silver-earned')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('daf_silver_seen_demo-user'))).toBe('3');
  expect(errors).toEqual([]);
});

test('the first launch after the update does not celebrate cards earned before it', async ({ page }) => {
  await openApp(page, 'en');
  await page.evaluate(day => {
    localStorage.setItem('daf_silver_demo-user', JSON.stringify({ day, correctToday: 20, earnedToday: true, total: 5, protocol: 'verified' }));
    localStorage.removeItem('daf_silver_seen_demo-user');
  }, today());
  await page.reload();
  await expect(page.getByRole('banner')).toBeVisible();
  await page.getByRole('button', { name: /Start today's review/ }).click();
  await answerOneCorrect(page);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('silver-earned')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('daf_silver_seen_demo-user'))).toBe('5');
});

test('the collection shows the newest card first', async ({ page }) => {
  await openApp(page, 'en');
  await seedSilver(page, 0, 3, 3);
  await page.getByRole('button', { name: /My collection/ }).click();
  const cards = page.getByTestId('silver-earned-list').locator(':scope > div');
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText('Silver card 3 of 60');
  await expect(cards.nth(2)).toContainText('Silver card 1 of 60');
  await expect(page.getByTestId('silver-locked-list').locator('li')).toHaveCount(57);
});
