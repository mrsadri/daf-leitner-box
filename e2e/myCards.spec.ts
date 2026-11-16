/** «کارت‌های من»: the insight cards live in the vocabulary bank; add, edit and delete one. There is no insights tab. */
import { test, expect } from '@playwright/test';
import { openApp, tabBar, noHorizontalScroll } from './helpers';

test('my cards: add, edit, delete', async ({ page }) => {
  const { errors } = await openApp(page, 'en');
  await expect(tabBar(page).getByText(/insights/i)).toHaveCount(0);
  await tabBar(page).getByRole('button', { name: /words/i }).click();
  await page.getByTestId('lesson-filter').selectOption('mine');
  const section = page.getByTestId('my-cards');
  await expect(section).toBeVisible();
  await noHorizontalScroll(page);

  const before = await section.getByTestId('insight-card').count();
  await section.getByRole('button', { name: /new/i }).first().click();
  await page.getByLabel(/title/i).first().fill('Jeden Tag zehn Minuten');
  await page.getByLabel(/full text/i).fill('Before breakfast.');
  await section.getByRole('button', { name: /add to box 0/i }).click();
  await expect(section.getByTestId('insight-card')).toHaveCount(before + 1);

  const card = section.getByTestId('insight-card').filter({ hasText: 'Jeden Tag zehn Minuten' });
  await card.getByRole('button', { name: /edit/i }).click();
  // In edit mode the title is in a text field, so find the card by its field instead of its text
  await section.getByRole('textbox', { name: /title/i }).fill('Jeden Tag zwanzig Minuten');
  await section.getByRole('button', { name: /save/i }).click();
  const edited = section.getByTestId('insight-card').filter({ hasText: 'zwanzig' });
  await expect(edited).toHaveCount(1);

  await edited.getByRole('button', { name: /delete/i }).click();
  await edited.getByTestId('confirm-delete').click();
  await expect(section.getByTestId('insight-card')).toHaveCount(before);
  expect(errors).toEqual([]);
});
