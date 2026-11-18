import { test, expect } from '@playwright/test';
import { openApp } from './helpers';

test('an empty backup requires confirmation and cancellation preserves cards', async ({page}) => {
  await openApp(page,'en','/?go=settings');
  const before=await page.evaluate(()=>localStorage.getItem('daf_cards_cache_demo-user'));
  await page.locator('input[type=file]').setInputFiles({name:'empty.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({cards:[],settings:{}}))});
  const dialog=page.getByRole('dialog',{name:'Replace your cards?'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Merge cards'})).toBeVisible();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('daf_cards_cache_demo-user'))).toEqual(before);
});

for (const lang of ['en','fa'] as const) {
  test(`failed story content can be retried (${lang})`,async ({page})=>{
    let fail=true;
    await page.route('**/data/stories/index.json',route=>fail?route.abort():route.continue());
    await openApp(page,lang,'/?go=stories');
    const alert=page.getByRole('alert');
    await expect(alert).toBeVisible();
    fail=false;
    await alert.getByRole('button').click();
    await expect(page.getByTestId('stories-shelf')).toBeVisible();
  });
}

for (const lang of ['fa','en'] as const) {
 for (const width of [320,390]) {
  test(`mobile navigation at ${width}px with large text (${lang})`,async({page})=>{
   await page.setViewportSize({width,height:844});
   await openApp(page,lang);
   await page.evaluate(()=>{document.documentElement.style.fontSize='20px';});
   const {tabBar,noHorizontalScroll}=await import('./helpers');
   await noHorizontalScroll(page);
   await tabBar(page).getByRole('button',{name:lang==='fa'?/تنظیمات/:/settings/i}).click();
   await expect(page.locator('input[type=file]')).toHaveCount(1);
   await noHorizontalScroll(page);
  });
 }
}

test('reader words use arrow navigation and one Tab exits the text',async({page})=>{
 await openApp(page,'en','/?go=stories&book=1&story=S01-Q1');
 await page.getByTestId('story-start').click();
 const text=page.locator('[data-word-navigation]').first();
 await text.focus();await page.keyboard.press('ArrowRight');
 expect(await text.evaluate(e=>e.contains(document.activeElement))).toBe(true);
 await page.keyboard.press('ArrowRight');
 expect(await text.evaluate(e=>e.querySelectorAll('[role=button]')[1]===document.activeElement)).toBe(true);
 await page.keyboard.press('Tab');
 expect(await text.evaluate(e=>e.contains(document.activeElement))).toBe(false);
});


for(const lang of ['en','fa'] as const){
 test(`catalog failure preserves a retry path (${lang})`,async({page})=>{
  let fail=true;
  await page.route('**/data/wortschatz-daf-kompakt.csv',route=>fail?route.abort():route.continue());
  await page.addInitScript(l=>{localStorage.setItem('daf_lang',l);localStorage.setItem('daf_demo_overdue_seen','1');},lang);
  await page.goto('/');
  const alert=page.getByRole('alert');await expect(alert).toBeVisible();
  fail=false;await alert.getByRole('button',{name:lang==='en'?'Try again':'تلاش مجدد'}).click();
  await expect(page.getByRole('banner')).toBeVisible();
 });
 test(`lazy story chunk failure recovers after reload (${lang})`,async({page})=>{
  await openApp(page,lang);
  let fail=true;
  await page.route('**/assets/StoriesScreen-*.js',route=>fail?route.abort():route.continue());
  const {tabBar}=await import('./helpers');
  await tabBar(page).getByRole('button',{name:lang==='en'?/stories/i:/داستان/}).click();
  const alert=page.getByRole('alert');await expect(alert).toBeVisible();
  fail=false;await alert.getByRole('button',{name:lang==='en'?'Try again':'تلاش مجدد'}).click();
  await expect(page.getByTestId('stories-shelf')).toBeVisible();
 });
}
