import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare } from '../src/services/dictation/compare.ts';
import { isTappableCategory, linkForToken, pickCard, resolveTap } from '../src/services/dictation/wordLink.ts';
import type { SentenceLink } from '../src/types/dictation.ts';

const text = 'Sie schaut eine WG an und heißt Nili.';
const links: SentenceLink[] = [
  { s: 4, e: 10, cards: ['daf_05_1'], lemma: 'anschauen', kind: 'separable' },
  { s: 19, e: 21, cards: ['daf_05_1'], lemma: 'anschauen', kind: 'separable' },
  { s: 26, e: 31, cards: ['daf_01_9', 'daf_08_2'], lemma: 'heißen', kind: 'form' },
];
const sentence = { text, links };

test('word-level categories are tappable; punctuation, spacing and extra words are not', () => {
  for (const c of ['case', 'umlaut-substitution', 'eszett-substitution', 'typo-wrong-letter', 'wrong-word', 'missing-word', 'order'] as const) {
    assert.equal(isTappableCategory(c), true, c);
  }
  for (const c of ['punctuation', 'spacing', 'extra-word'] as const) assert.equal(isTappableCategory(c), false, c);
});

test('linkForToken finds the link covering the expected token', () => {
  assert.equal(linkForToken(text, 1, links)?.lemma, 'anschauen');           // schaut
  assert.equal(linkForToken(text, 4, links)?.lemma, 'anschauen');           // an
  assert.equal(linkForToken(text, 0, links), null);                          // Sie: no link
});

test('pickCard prefers the owned card, otherwise the first candidate', () => {
  assert.deepEqual(pickCard(['a', 'b', 'c'], new Set(['c'])), { cardId: 'c', owned: true });
  assert.deepEqual(pickCard(['a', 'b', 'c'], new Set()), { cardId: 'a', owned: false });
  assert.equal(pickCard([], new Set()), null);
});

test('both parts of a separable verb open the same card', () => {
  const owned = new Set(['daf_05_1']);
  const a = resolveTap({ category: 'typo-wrong-letter', expectedTokenIndex: 1 }, sentence, owned);
  const b = resolveTap({ category: 'missing-word', expectedTokenIndex: 4 }, sentence, owned);
  assert.equal(a.kind, 'card');
  assert.equal(b.kind, 'card');
  if (a.kind === 'card' && b.kind === 'card') {
    assert.equal(a.cardId, b.cardId);
    assert.equal(a.owned, true);
  }
});

test('duplicate catalog entries: the owned one wins', () => {
  const t = resolveTap({ category: 'case', expectedTokenIndex: 6 }, sentence, new Set(['daf_08_2']));
  assert.ok(t.kind === 'card' && t.cardId === 'daf_08_2' && t.owned && t.candidates.length === 2);
  const u = resolveTap({ category: 'case', expectedTokenIndex: 6 }, sentence, new Set());
  assert.ok(u.kind === 'card' && u.cardId === 'daf_01_9' && !u.owned);
});

test('a word without a link offers a new card; names and numbers offer nothing', () => {
  const t = resolveTap({ category: 'typo-wrong-letter', expectedTokenIndex: 3 }, sentence, new Set());   // WG
  assert.deepEqual(t, { kind: 'new', word: 'WG' });
  const name = resolveTap({ category: 'typo-wrong-letter', expectedTokenIndex: 7 }, sentence, new Set(), new Set(['Nili']));
  assert.deepEqual(name, { kind: 'none' });
  const num = resolveTap({ category: 'wrong-word', expectedTokenIndex: 2 }, { text: 'Ich bin 19.', links: [] }, new Set());
  assert.deepEqual(num, { kind: 'none' });
});

test('not tappable: punctuation marks and marks without an expected token', () => {
  assert.deepEqual(resolveTap({ category: 'punctuation', expectedTokenIndex: 8 }, sentence, new Set()), { kind: 'none' });
  assert.deepEqual(resolveTap({ category: 'extra-word', expectedTokenIndex: null }, sentence, new Set()), { kind: 'none' });
});

test('end to end: a typo in "heißt" resolves through the check result to the card', () => {
  const r = compare('Sie schaut eine WG an und heisst Nili.', text);
  const mark = r.marks[0];
  assert.equal(mark.category, 'eszett-substitution');
  const t = resolveTap(mark, sentence, new Set(['daf_01_9']));
  assert.ok(t.kind === 'card' && t.cardId === 'daf_01_9');
});
