import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialLang, DEFAULT_LANG } from '../src/i18n/format.ts';
import { StoriesProgressStore } from '../src/features/stories/progressStore.ts';
import { saveReturnTo, takeReturnTo } from '../src/features/auth/returnTo.ts';
import type { StoryProgressRow } from '../src/features/stories/progressRow.ts';

function fakeStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  } });
  return data;
}

test('new visitors get English; devices that used the app before keep Persian; a saved choice always wins', () => {
  assert.equal(DEFAULT_LANG, 'en');
  assert.equal(initialLang(null, []), 'en');
  assert.equal(initialLang(null, ['daf_reader_settings', 'daf_stories_progress_guest']), 'en', 'guest reading is not a returning learner');
  assert.equal(initialLang(null, ['daf_cards_cache_6f1c']), 'fa');
  assert.equal(initialLang('en', ['daf_cards_cache_6f1c']), 'en');
  assert.equal(initialLang('fa', []), 'fa');
  assert.equal(initialLang('de', []), 'en', 'an unknown value falls back to the default');
});

test('guest progress moves into the account without going backwards', async () => {
  const data = fakeStorage();
  const writes: Partial<StoryProgressRow>[] = [];
  const store = new StoriesProgressStore('user-1', { async pull() { return []; }, async save(row) { writes.push(row); return true; } });
  const at = '2026-11-24T10:00:00Z';
  store.save({ storyId: 'S01-Q1', page: 4, totalPages: 5, completedAt: null, updatedAt: at }, 'v1');
  const n = store.importFrom({
    // further than the account: guest finished the quiz
    'S01-Q1': { storyId: 'S01-Q1', page: 2, totalPages: 5, completedAt: at, score: 3, updatedAt: at },
    // only the guest read this one
    'S02-Q1': { storyId: 'S02-Q1', page: 1, totalPages: 6, completedAt: null, updatedAt: at },
    // malformed ids are ignored
    'S99-Q9': { storyId: 'S99-Q9', page: 1, totalPages: 6, completedAt: null, updatedAt: at },
  });
  assert.equal(n, 2);
  const map = store.get();
  assert.equal(map['S01-Q1'].page, 4, 'page never goes backwards');
  assert.equal(map['S01-Q1'].completedAt, at, 'completion is kept');
  assert.equal(map['S02-Q1'].page, 1);
  assert.equal(map['S99-Q9'], undefined);
  await store.flush();
  assert.deepEqual(writes.map(w => w.story_id).sort(), ['S01-Q1', 'S02-Q1']);
  // importing the same again changes nothing
  assert.equal(store.importFrom({ 'S02-Q1': map['S02-Q1'] }), 0);
  store.dispose();
  assert.ok(data.size > 0);
});

test('the reading place survives the sign-in redirect for an hour, once', () => {
  fakeStorage();
  saveReturnTo('https://example.test/?book=2&story=S02-Q1&page=3&code=abc');
  assert.deepEqual(takeReturnTo(), { book: '2', story: 'S02-Q1', page: '3' });
  assert.equal(takeReturnTo(), null, 'used once');
  saveReturnTo('https://example.test/?book=2&story=S02-Q1');
  assert.equal(takeReturnTo(Date.now() + 2 * 60 * 60 * 1000), null, 'too old');
  localStorage.setItem('daf_return_to', JSON.stringify({ at: Date.now(), params: { book: '<script>' } }));
  assert.equal(takeReturnTo(), null, 'unexpected values are dropped');
});
