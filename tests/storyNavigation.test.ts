import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readStoryLocation } from '../src/features/stories/storyNavigation.ts';
test('story routes reject malformed books and preserve bounded reader positions', () => {
  assert.deepEqual(readStoryLocation('https://demo.test/?book=999'), {kind:'shelf'});
  assert.deepEqual(readStoryLocation('https://demo.test/?book=1&story=invalid'), {kind:'book',n:1});
  assert.deepEqual(readStoryLocation('https://demo.test/?book=1&story=S01-Q1&page=2'), {kind:'read',n:1,storyId:'S01-Q1',continueAt:2});
  assert.equal((readStoryLocation('https://demo.test/?book=1&story=S01-Q1&page=-9') as {continueAt:number}).continueAt,0);
});

test('a scene cover and page zero have distinct URLs', () => {
  assert.deepEqual(readStoryLocation('https://demo.test/?book=1&story=S01-Q1'), { kind: 'read', n: 1, storyId: 'S01-Q1' });
  assert.deepEqual(readStoryLocation('https://demo.test/?book=1&story=S01-Q1&page=0'), { kind: 'read', n: 1, storyId: 'S01-Q1', continueAt: 0 });
});
