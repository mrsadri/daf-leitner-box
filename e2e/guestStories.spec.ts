/**
 * Signed out (demo build, ?guest=1): visitors land on Stories, read the first story of a book with word meanings and
 * its quiz; the next story, saving a word and the header button ask them to sign in. "Sign in" (the demo account here)
 * returns to Stories with the guest's progress carried over. Plus: the default language for new visitors.
 */
import { test, expect } from '@playwright/test';
import { openApp, noHorizontalScroll } from './helpers';

test('a guest reads the first story, then is asked to sign in to continue; progress moves into the account', async ({ page }) => {
  const { errors, external } = await openApp(page, 'en', '/?guest=1');
  await expect(page.getByTestId('guest-app')).toBeVisible();
  await expect(page.getByTestId('stories-shelf')).toBeVisible();
  await expect(page.getByTestId('guest-note')).toBeVisible();
  await expect(page.locator('nav')).toHaveCount(0);
  await noHorizontalScroll(page);

  // The header button explains what signing in gives
  await page.getByTestId('guest-sign-in').click();
  const prompt = page.getByTestId('sign-in-prompt').getByRole('dialog');
  await expect(prompt).toContainText('Signing in keeps your story progress');
  await prompt.getByRole('button', { name: 'Not now' }).click();
  await expect(prompt).toHaveCount(0);

  await page.getByTestId('book-cover').first().click();
  await page.getByTestId('story-item').first().click();
  await expect(page.getByTestId('story-text')).toBeVisible();

  // Word meanings work without an account; saving asks to sign in
  await page.locator('[data-gender="m"]').first().click();
  const sheet = page.getByTestId('word-sheet').getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByTestId('word-sign-in').click();
  await expect(prompt).toContainText('Leitner box');
  await page.keyboard.press('Escape');

  // The quiz: no points dialog for guests
  await page.getByTestId('story-to-quiz').scrollIntoViewIfNeeded();
  await page.getByTestId('story-to-quiz').click();
  const options = page.getByTestId('quiz-option');
  for (let q = 0; q < 3; q++) {
    await options.nth(1).click();
    await page.getByTestId('quiz-next').click();
  }
  await expect(page.getByTestId('story-result')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Continue: sign in
  await page.getByTestId('next-story').click();
  await expect(prompt).toContainText('finished the first story');
  await prompt.getByTestId('prompt-google').click();

  // Signed in (demo account): Stories, with the guest's reading carried over
  await expect(page.getByTestId('nav-brand')).toBeVisible();
  await page.goto('/?go=stories&book=1');
  await expect(page.getByTestId('story-item').nth(0)).toHaveAttribute('data-state', 'done');
  await expect(page.getByTestId('story-item').nth(1)).toHaveAttribute('data-state', 'open');
  expect(await page.evaluate(() => localStorage.getItem('daf_stories_progress_guest'))).toBeNull();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('guests cannot open later stories by link: the book is shown instead', async ({ page }) => {
  await openApp(page, 'en', '/?guest=1&book=1&story=S01-Q2');
  await expect(page.getByTestId('stories-book')).toBeVisible();
  await expect(page.getByTestId('story-text')).toHaveCount(0);
});

test('signed in, the app opens on Stories and Stories is the first tab', async ({ page }) => {
  await openApp(page, 'en');
  await expect(page.getByTestId('stories-shelf')).toBeVisible();
  const { tabBar } = await import('./helpers');
  await expect(tabBar(page).getByRole('button').first()).toContainText(/stories/i);
});

test.describe('default language', () => {
  test('a new visitor gets English', async ({ page }) => {
    await page.goto('/?guest=1');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => localStorage.getItem('daf_lang'))).toBe('en');
  });
  test('a device that used the app before keeps Persian', async ({ page }) => {
    await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.clear(); localStorage.setItem('daf_cards_cache_someone', '[]'); } });
    await page.goto('/?guest=1');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
