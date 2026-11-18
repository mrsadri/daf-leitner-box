/**
 * Stories end to end in demo mode: bookshelf, a book, read story 1 to the quiz, one wrong answer with its page,
 * finish, story 2 opens and stays open after a reload. A tapped word opens the word sheet and adds the card.
 */
import { test, expect } from '@playwright/test';
import { openApp, tabBar, noHorizontalScroll } from './helpers';

for (const lang of ['fa', 'en'] as const) {
  test(`read a story and answer its quiz (${lang})`, async ({ page }) => {
    const { errors, external } = await openApp(page, lang);
    await tabBar(page).getByRole('button', { name: lang === 'fa' ? /داستان/ : /stories/i }).click();
    await expect(page.getByTestId('stories-shelf')).toBeVisible();
    await page.getByTestId('open-collection').click();
    await expect(page.getByTestId('book-cover')).toHaveCount(10);
    await noHorizontalScroll(page);

    await page.getByTestId('book-cover').first().click();
    const items = page.getByTestId('story-item');
    await expect(items).toHaveCount(6);
    await expect(items.nth(0)).toHaveAttribute('data-state', 'open');
    await expect(items.nth(1)).toHaveAttribute('data-state', 'locked');
    await expect(items.nth(1)).toBeDisabled();

    await items.nth(0).click();
    await expect(page.getByTestId('story-cover')).toBeVisible();
    await page.getByTestId('story-start').click();

    // German text is LTR in both interfaces, with gender underlines
    const text = page.locator('[lang="de"].font-story').first();
    await expect(text).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('[data-gender]').first()).toBeVisible();
    await noHorizontalScroll(page);

    // Tap a word from the list and add it to the box
    await page.locator('[data-gender="m"]').first().click();
    const sheet = page.getByTestId('word-sheet').getByRole('dialog');
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: lang === 'fa' ? /افزودن به جعبه/ : /add to my leitner box/i }).click();
    await expect(sheet.getByRole('status')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);

    // Turn pages with the arrow key and the button until the quiz
    await page.keyboard.press('ArrowRight');
    for (let i = 0; i < 10 && await page.getByTestId('story-next').count(); i++) await page.getByTestId('story-next').click();
    await expect(page.getByTestId('story-quiz')).toBeVisible();

    // Question 1: pick a wrong option, open the page, then go on
    const options = page.getByTestId('quiz-option');
    await expect(options).toHaveCount(4);
    await options.nth(0).click();
    await expect(page.locator('[data-correct]')).toHaveCount(1);
    if (await page.getByTestId('show-page').count()) {
      await page.getByTestId('show-page').click();
      await expect(page.getByTestId('quiz-page').getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
    }
    for (let q = 0; q < 3; q++) {
      if (q > 0) await options.nth(2).click();
      await page.getByTestId('quiz-next').click();
    }
    await expect(page.getByRole('dialog', { name: lang === 'fa' ? 'سکانس تمام شد!' : 'Scene completed!' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('story-result')).toBeVisible();
    await expect(page.getByTestId('next-story')).toBeVisible();

    // Story 2 is open, also after a reload
    await page.reload();
    await expect(page).toHaveURL(/story=S01-Q1/);
    await page.goto('/?go=stories&book=1');
    await expect(page.getByTestId('story-item').nth(0)).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('story-item').nth(1)).toHaveAttribute('data-state', 'open');

    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('a deep link from an old dictation reminder opens Stories', async ({ page }) => {
  await openApp(page, 'en', '/?go=dictation');
  await expect(page.getByTestId('stories-shelf')).toBeVisible();
});


test('story URLs support browser history and reject locked or invalid links', async ({ page }) => {
  await openApp(page, 'en', '/?go=stories&book=1');
  await expect(page.getByTestId('stories-book')).toBeVisible();
  await page.getByTestId('story-item').first().click();
  await expect(page).toHaveURL(/story=S01-Q1/);
  await page.goBack();
  await expect(page.getByTestId('stories-book')).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId('story-cover')).toBeVisible();
  await page.goto('/?go=stories&book=1&story=S01-Q6');
  await expect(page.getByTestId('stories-book')).toBeVisible();
  await page.goto('/?go=stories&book=999');
  await expect(page.getByTestId('stories-shelf')).toBeVisible();
});
