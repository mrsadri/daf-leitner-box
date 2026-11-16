import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countDoubleQuotes, foldToken, normalizeText, tokenize } from '../src/services/dictation/normalize.ts';

const texts = (s: string) => tokenize(s).map(t => t.text);

test('NFC: a decomposed umlaut equals the composed one; NBSP becomes a space; line breaks become spaces', () => {
  assert.equal(normalizeText('Scho\u0308n'), 'Sch\u00f6n');
  assert.equal(normalizeText('a b c\nd'), 'a b c d');
  assert.deepEqual(texts('Ma\u0308dchen'), ['M\u00e4dchen']);
});

test('words keep inner apostrophes and hyphens (geht’s, E-Mail) and numbers stay whole (1:52, 3,5, 1.000, 0664)', () => {
  assert.deepEqual(texts('Wie geht’s?'), ['Wie', 'geht’s', '?']);
  assert.deepEqual(texts('Meine E-Mail'), ['Meine', 'E-Mail']);
  assert.deepEqual(texts('in 1:52 und 3,5 und 1.000'), ['in', '1:52', 'und', '3,5', 'und', '1.000']);
  assert.deepEqual(texts('Tel. 0664 23 59'), ['Tel', '.', '0664', '23', '59']);
});

test('a period after digits at the end is punctuation, not part of the number', () => {
  assert.deepEqual(texts('bis 21.'), ['bis', '21', '.']);
  assert.deepEqual(texts('am 19. Oktober'), ['am', '19', '.', 'Oktober']);
});

test('three dots and the ellipsis character are one token', () => {
  assert.deepEqual(texts('Ich ... ich'), ['Ich', '...', 'ich']);
  assert.deepEqual(texts('Ich … ich'), ['Ich', '…', 'ich']);
  assert.equal(foldToken('...'), foldToken('…'));
});

test('quotes, apostrophes and dashes fold; the position and count still matter', () => {
  for (const q of ['„', '“', '”', '"', '«', '»']) assert.equal(foldToken(q), '"');
  for (const q of ['‚', '‘', '’', "'", 'ʼ']) assert.equal(foldToken(q), "'");
  for (const d of ['-', '–', '—']) assert.equal(foldToken(d), '-');
  assert.equal(tokenize('„Hallo!“').length, 4);
});

test('token offsets point into the normalized text and spaceBefore is recorded', () => {
  const toks = tokenize('Ja , gern');
  assert.deepEqual(toks.map(t => [t.text, t.start, t.end, t.spaceBefore]), [['Ja', 0, 2, false], [',', 3, 4, true], ['gern', 5, 9, true]]);
  assert.equal(tokenize('  Hallo ').length, 1);
  assert.equal(tokenize('  Hallo ')[0].spaceBefore, false);
});

test('countDoubleQuotes counts only double-quote glyphs', () => {
  assert.equal(countDoubleQuotes('„Wie geht’s?“, fragt sie.'), 2);
  assert.equal(countDoubleQuotes('Er sagt: ‚Hallo‘ „Du“'), 2);
  assert.equal(countDoubleQuotes('"x" «y»'), 4);
});

test('Persian digits are different characters (edge case K17) and uppercase ẞ is not ß (K9)', () => {
  assert.notEqual(foldToken('۱۲'), foldToken('12'));
  assert.notEqual(foldToken('ẞ'), foldToken('ß'));
});
