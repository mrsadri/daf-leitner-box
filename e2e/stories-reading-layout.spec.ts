import { test, expect } from '@playwright/test';
import { openApp, noHorizontalScroll } from './helpers';

for (const lang of ['fa', 'en'] as const) {
  test(`editorial library and the pinned-picture reader (${lang})`, async ({ page }, testInfo) => {
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
    // The book page follows the interface direction; German titles stay left to right
    await expect(page.getByTestId('stories-book').locator('ol')).not.toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('story-item').first()).toContainText('Herzlich willkommen!');
    await expect(page.getByTestId('story-item').first()).toContainText('Annenstraße');
    // The first-page excerpt is clamped to two lines
    const excerpt = page.getByTestId('story-item').first().locator('[lang="de"].line-clamp-2');
    const lineHeight = await excerpt.evaluate(e => parseFloat(getComputedStyle(e).lineHeight));
    expect((await excerpt.boundingBox())!.height).toBeLessThanOrEqual(lineHeight * 2 + 2);
    await noHorizontalScroll(page);

    await page.getByTestId('story-item').first().click();
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveCount(0);
    await expect(page.locator('nav')).toHaveCount(0);
    const text = page.locator('.reading-text .font-story');
    await expect(text.first()).toHaveAttribute('dir', 'ltr');
    expect(await page.locator('.reader-block').count(), 'the whole chapter is on one page').toBeGreaterThan(1);
    const original = await text.first().textContent();

    // The picture stays pinned at the top while the text scrolls beneath it
    const picture = page.getByTestId('reader-picture');
    await expect(picture).toBeVisible();
    await page.mouse.wheel(0, 1600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800);
    const pinned = await picture.boundingBox();
    expect(pinned!.y).toBeLessThan(80);
    expect(pinned!.height).toBeLessThanOrEqual(Math.ceil(page.viewportSize()!.height * 0.32) + 1);
    await expect(picture).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('reader-scrolled.png') });

    await page.getByTestId('reader-settings').click();
    const settings = page.getByTestId('reading-settings');
    await settings.getByRole('slider').fill('32');
    await settings.getByRole('switch').click();
    await page.keyboard.press('Escape');
    await expect(text.first()).toHaveCSS('font-size', '32px');
    await expect(text.first().locator('.gender-m, .gender-f, .gender-n, .gender-pl')).toHaveCount(0);
    await expect(text.first()).toHaveText(original!);
    await noHorizontalScroll(page);
    // Word lookup survives hiding the instructional underlines.
    await text.first().locator('[data-gender]').first().click();
    await expect(page.getByTestId('word-sheet').getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');

    // Read to the end, leave, and continue: back at the place reached, not at the top
    await page.getByTestId('story-to-quiz').scrollIntoViewIfNeeded();
    await expect(page).toHaveURL(/page=[1-9]/);
    await page.getByTestId('reader-exit').click();
    await expect(page.locator('header')).toBeVisible();
    await page.getByTestId('back-to-library').click();
    await page.reload();
    await expect(page.getByTestId('resume-reading')).toBeVisible();
    await page.getByTestId('resume-reading').click();
    await expect(page.getByTestId('story-text')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    await expect(text.first()).toHaveCSS('font-size', '32px');
    await page.setViewportSize({ width: 320, height: 740 });
    await noHorizontalScroll(page);
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

test.describe('reading order follows the interface language', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  for (const lang of ['fa', 'en'] as const) {
    test(`first book and first story on the ${lang === 'fa' ? 'right' : 'left'} (${lang})`, async ({ page }) => {
      await openApp(page, lang, '/?go=stories');
      const covers = page.getByTestId('book-cover');
      await expect(covers).toHaveCount(10);
      const [a, b] = [await covers.nth(0).boundingBox(), await covers.nth(1).boundingBox()];
      expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
      if (lang === 'fa') expect(a!.x).toBeGreaterThan(b!.x); else expect(a!.x).toBeLessThan(b!.x);
      // In a book, each story's picture sits at the start side of its row
      await covers.first().click();
      const row = page.getByTestId('story-item').first();
      const [rowBox, img] = [await row.boundingBox(), await row.locator('img').boundingBox()];
      const imgCentre = img!.x + img!.width / 2, rowCentre = rowBox!.x + rowBox!.width / 2;
      if (lang === 'fa') expect(imgCentre).toBeGreaterThan(rowCentre); else expect(imgCentre).toBeLessThan(rowCentre);
    });
  }
});
