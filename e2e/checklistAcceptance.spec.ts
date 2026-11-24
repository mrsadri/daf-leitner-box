import {test,expect} from '@playwright/test';
import {openApp,tabBar,noHorizontalScroll} from './helpers';

for(const lang of ['fa','en'] as const){
 test(`sync details live in settings without a study banner (${lang})`,async({page},info)=>{
  await openApp(page,lang);
  await expect(page.getByTestId('sync-diagnostics')).toHaveCount(0);
  await tabBar(page).getByRole('button',{name:lang==='fa'?/تنظیمات/:/settings/i}).click();
  await expect(page.getByTestId('sync-diagnostics')).toBeVisible();
  await expect(page.getByTestId('sync-diagnostics').getByRole('button')).toBeEnabled();
  await noHorizontalScroll(page);
  await page.screenshot({path:info.outputPath('settings-sync.png'),fullPage:true});
 });
 test(`a feminine alternate retains its gender in the story and word sheet (${lang})`,async({page},info)=>{
  const {errors}=await openApp(page,lang,'/?go=stories&book=1&story=S01-Q1');
  const word=page.locator('[data-gender="f"]').filter({hasText:/^Praktikantin$/}).first();
  await expect(word).toBeVisible();await word.click();
  const sheet=page.getByTestId('word-sheet').getByRole('dialog');
  await expect(sheet.locator('.text-gender-f')).toHaveText('die');
  await expect(sheet.locator('p[lang="de"]').first()).toHaveText('diePraktikantin');
  await noHorizontalScroll(page);
  await page.screenshot({path:info.outputPath('feminine-word.png')});
  await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);
  expect(errors).toEqual([]);
 });
}
