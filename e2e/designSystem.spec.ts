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

test('app dialog: new card opens from the header and closes with Esc', async ({ page }) => {
  const { openApp } = await import('./helpers');
  const { errors } = await openApp(page, 'fa');
  const opener = page.locator('header button[aria-label]').first();
  await opener.click();
  const dialog = page.getByTestId('new-card-dialog').getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});


for(const lang of ['fa','en'] as const) {
test(`nested dialogs close only the top layer and restore its opener (${lang})`, async ({page})=>{
 await page.addInitScript(l=>localStorage.setItem('daf_lang',l),lang);
 await page.goto('/?gallery=1');
 await page.getByTestId('open-dialog').click();
 const parent=page.getByRole('dialog',{name:'Dialog title',exact:true});
 const opener=parent.getByRole('button',{name:'Open nested dialog'});
 await opener.click();
 const nested=page.getByRole('dialog',{name:'Nested dialog',exact:true});
 await expect(nested).toBeVisible();
 expect(await parent.evaluate(e=>e.parentElement?.inert)).toBe(true);
 for(let i=0;i<5;i++){
  await page.keyboard.press('Tab');
  expect(await nested.evaluate(e=>e.contains(document.activeElement))).toBe(true);
 }
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Nested dialog',exact:true})).toHaveCount(0);
 await expect(parent).toBeVisible();
 await expect(opener).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(parent).toHaveCount(0);
});

}
