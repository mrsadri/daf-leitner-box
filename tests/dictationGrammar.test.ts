import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawerOpenDefault, keyboardIsUp, pickDrawerContent } from '../src/services/dictation/grammarDrawer.ts';
import type { GrammarCard, GrammarFile, Sentence, Sequence } from '../src/types/dictation.ts';

const card = (id: string, block: number, lesson: number): GrammarCard =>
  ({ id, block, lesson, level: 'A1', title: id, rule: 'x', examples: [] });
const sent = (id: string, grammar: string[]): Sentence =>
  ({ id, hash: 'h', text: id, speaker: 'NARRATOR', endMark: '.', quoteBalance: 0, flags: [], links: [], grammar });

const file: GrammarFile = {
  storyId: 'story-02', block: 2,
  cards: [card('g-02-04-b', 2, 4), card('g-01-02-a', 1, 2), card('g-02-04-a', 2, 4)],
  first: { 'g-02-04-b': 's2', 'g-01-02-a': 's1' },
};
const seq: Sequence = {
  id: 'S02-Q1', order: 1, title: 't', situation: { fa: '', en: '' }, image: null,
  sentences: [sent('s1', ['g-01-02-a']), sent('s2', ['g-02-04-b', 'g-02-04-a']), sent('s3', [])],
};

test('sequence list before the first entry: union of the sequence points, grouped', () => {
  const c = pickDrawerContent(file, 2, seq, null);
  assert.equal(c.mode, 'sequence');
  assert.deepEqual(c.fresh.map(x => x.id), ['g-02-04-a', 'g-02-04-b']);       // sorted by lesson, then id
  assert.deepEqual(c.again.map(x => x.id), ['g-01-02-a']);
  assert.equal(c.firstHere.size, 0);
});

test('trigger sentence: only its points, first occurrences marked', () => {
  const c = pickDrawerContent(file, 2, seq, seq.sentences[1]);
  assert.equal(c.mode, 'sentence');
  assert.deepEqual(c.fresh.map(x => x.id), ['g-02-04-a', 'g-02-04-b']);
  assert.deepEqual(c.again, []);
  assert.deepEqual([...c.firstHere], ['g-02-04-b']);
});

test('sentence without points gives empty groups (the UI then shows the sequence list)', () => {
  const c = pickDrawerContent(file, 2, seq, seq.sentences[2]);
  assert.equal(c.mode, 'sentence');
  assert.deepEqual([c.fresh.length, c.again.length], [0, 0]);
});

test('an id without a card is skipped silently', () => {
  const c = pickDrawerContent(file, 2, seq, sent('sx', ['g-99-99-missing', 'g-01-02-a']));
  assert.deepEqual(c.again.map(x => x.id), ['g-01-02-a']);
});

test('open default: stored choice wins over the viewport', () => {
  assert.equal(drawerOpenDefault(undefined, 1280), true);
  assert.equal(drawerOpenDefault(undefined, 800), false);
  assert.equal(drawerOpenDefault(false, 1280), false);
  assert.equal(drawerOpenDefault(true, 390), true);
});

test('keyboard detection from the visual viewport', () => {
  assert.equal(keyboardIsUp(800, 790), false);
  assert.equal(keyboardIsUp(800, 480), true);
});
