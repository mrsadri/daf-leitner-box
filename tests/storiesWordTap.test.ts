import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTap, pickCard, splitWords } from '../src/features/stories/wordTap.ts';

const names = new Set(['Nilufar', 'Graz', 'Lucía']);

test('a linked word prefers the card the learner owns', () => {
  assert.deepEqual(pickCard(['a', 'b'], new Set(['b'])), { cardId: 'b', owned: true });
  assert.deepEqual(pickCard(['a', 'b'], new Set()), { cardId: 'a', owned: false });
  assert.equal(pickCard([], new Set()), null);
  assert.deepEqual(resolveTap({ t: 'Termin', c: ['daf_02_24'] }, new Set(['daf_02_24']), names),
    { kind: 'card', word: 'Termin', cardId: 'daf_02_24', owned: true });
});

test('words not in the list can become a new card', () => {
  assert.deepEqual(resolveTap('Uhr', new Set(), names), { kind: 'new', word: 'Uhr' });
  assert.deepEqual(resolveTap({ t: 'Familie', b: 1 }, new Set(), names), { kind: 'new', word: 'Familie' });
});

test('names and numbers do nothing', () => {
  assert.deepEqual(resolveTap('Nilufar', new Set(), names), { kind: 'none' });
  assert.deepEqual(resolveTap('Graz', new Set(), names), { kind: 'none' });
  assert.deepEqual(resolveTap('Nilufars', new Set(), names), { kind: 'none' });
  assert.deepEqual(resolveTap('14', new Set(), names), { kind: 'none' });
});

test('plain text splits into words and the text between', () => {
  assert.deepEqual(splitWords(', acht Uhr. Die '), [
    { word: false, text: ', ' }, { word: true, text: 'acht' }, { word: false, text: ' ' }, { word: true, text: 'Uhr' },
    { word: false, text: '. ' }, { word: true, text: 'Die' }, { word: false, text: ' ' },
  ]);
  assert.deepEqual(splitWords('„E-Mail“'), [{ word: false, text: '„' }, { word: true, text: 'E-Mail' }, { word: false, text: '“' }]);
  assert.deepEqual(splitWords('Lucías'), [{ word: true, text: 'Lucías' }]);
});
