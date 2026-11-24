import { test, expect } from '@playwright/test';
import { openApp, noHorizontalScroll } from './helpers';

for (const lang of ['fa', 'en'] as const) {
  test(`editorial library and distraction-free reader (${lang})`, async ({ page }, testInfo) => {
    // Book 5 is served without pictures, so the typographic fallback stays covered as illustrations are added.
    await page.context().route('**/data/stories/index.json', async route => {
      const index = await (await route.fetch()).json();
      for (const story of index.books[4].stories) story.image = null;
      await route.fulfill({ json: index });
    });
    const { errors, external } = await openApp(page, lang, '/?go=stories');
    await expect(page.getByTestId('book-cover')).toHaveCount(10);
    await noHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath('library.png'), fullPage: true });
    // The typographic fallback is a complete cover, not a broken image.
    await expect(page.getByTestId('book-cover').nth(4).locator('.editorial-type-cover')).toBeVisible();
    await page.getByTestId('book-cover').first().click();
    await expect(page.getByTestId('stories-book').locator('ol')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('story-item').first()).toContainText('Herzlich willkommen!');
    await expect(page.getByTestId('story-item').first()).toContainText('Annenstraße');
    await noHorizontalScroll(page);
    await page.getByTestId('story-item').first().click();
    await page.getByTestId('story-start').click();
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.locator('nav')).toHaveCount(0);
    const text = page.locator('.reading-text .font-story');
    await expect(text).toHaveAttribute('dir', 'ltr');
    const original = await text.textContent();
    await expect(page.getByTestId('reader-settings')).toHaveCount(0);
    await page.getByTestId('reader-controls-toggle').click();
    await page.getByTestId('reader-settings').click();
    const settings = page.getByTestId('reading-settings');
    await settings.getByRole('slider').fill('32');
    await settings.getByRole('switch').click();
    await page.keyboard.press('Escape');
    await expect(text).toHaveCSS('font-size', '32px');
    await expect(text.locator('.gender-m, .gender-f, .gender-n, .gender-pl')).toHaveCount(0);
    await expect(text).toHaveText(original!);
    await noHorizontalScroll(page);
    // Word lookup survives hiding the instructional underlines.
    await text.locator('[data-gender]').first().click();
    await expect(page.getByTestId('word-sheet').getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('reader-controls-toggle').click();
    await expect(page.getByTestId('reader-exit')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
    // Escape makes the navigation available to keyboard users.
    await page.keyboard.press('Escape');
    await page.getByTestId('reader-exit').click();
    await expect(page.locator('header')).toBeVisible();
    await page.getByTestId('back-to-library').click();
    await page.reload();
    await expect(page.getByTestId('resume-reading')).toBeVisible();
    await page.getByTestId('resume-reading').click();
    // Page zero must resume directly, not return to the cover.
    await expect(page.getByTestId('story-cover')).toHaveCount(0);
    await expect(text).toHaveCSS('font-size', '32px');
    await expect(text.locator('.gender-m, .gender-f, .gender-n, .gender-pl')).toHaveCount(0);
    await expect(text).toHaveText(original!);
    await page.setViewportSize({ width: 320, height: 740 });
    await noHorizontalScroll(page);
    await page.keyboard.press('Escape');
    await page.getByTestId('reader-exit').click();
    await noHorizontalScroll(page);
    await page.getByTestId('back-to-library').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await noHorizontalScroll(page);
    await page.screenshot({ path: testInfo.outputPath('library-dark-small.png'), fullPage: false });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}
