import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patternOf, describePlural } from '../src/services/plural.ts';

test('suffix patterns', () => {
  assert.equal(patternOf('der Name', 'die Namen'), '-n');
  assert.equal(patternOf('die Frau', 'die Frauen'), '-en');
  assert.equal(patternOf('der Tag', 'die Tage'), '-e');
  assert.equal(patternOf('das Kind', 'die Kinder'), '-er');
  assert.equal(patternOf('das Auto', 'die Autos'), '-s');
  assert.equal(patternOf('die Lehrerin', 'die Lehrerinnen'), '-nen');
});

test('unchanged and umlaut-only', () => {
  assert.equal(patternOf('das Zimmer', 'die Zimmer'), '–');
  assert.equal(patternOf('der Vater', 'die Väter'), '¨');
  assert.equal(patternOf('der Bruder', 'die Brüder'), '¨');
});

test('umlaut plus suffix, including compounds and au', () => {
  assert.equal(patternOf('die Stadt', 'die Städte'), '¨-e');
  assert.equal(patternOf('die Großstadt', 'die Großstädte'), '¨-e');
  assert.equal(patternOf('das Haus', 'die Häuser'), '¨-er');
  assert.equal(patternOf('der Arzt', 'die Ärzte'), '¨-e');
});

test('irregular plurals get no pattern', () => {
  assert.equal(patternOf('das Museum', 'die Museen'), null);
  assert.equal(patternOf('das Thema', 'die Themen'), null);
});

test('labels instead of forms', () => {
  assert.deepEqual(describePlural('die Milch', '(nur Sg.)'), [{ label: 'singularOnly' }]);
  assert.deepEqual(describePlural('der Sport', '(hier nur Sg.)'), [{ label: 'singularOnlyHere' }]);
  assert.deepEqual(describePlural('die Leute (Pl.)', '(kein Sg.)'), [{ label: 'pluralOnly' }]);
  assert.deepEqual(describePlural('die Eltern (Pl.)', ''), [{ label: 'pluralOnly' }]);
  assert.deepEqual(describePlural('Amerika', ''), []);
});

test('pairs of nouns are matched one to one', () => {
  assert.deepEqual(describePlural('der Partner / die Partnerin', 'die Partner / die Partnerinnen'), [
    { form: 'die Partner', pattern: '–' },
    { form: 'die Partnerinnen', pattern: '-nen' }
  ]);
  assert.deepEqual(describePlural('der Stock / das Stockwerk', '(nur Sg.) / die Stockwerke'), [
    { label: 'singularOnly' },
    { form: 'die Stockwerke', pattern: '-e' }
  ]);
});

test('one noun with two articles (adjectival noun)', () => {
  assert.deepEqual(describePlural('der / die Verwandte', 'die Verwandten'), [{ form: 'die Verwandten', pattern: '-n' }]);
});

test('one singular with two plurals', () => {
  assert.deepEqual(describePlural('die Pizza', 'die Pizzas / die Pizzen'), [
    { form: 'die Pizzas', pattern: '-s' },
    { form: 'die Pizzen' }
  ]);
});

test('values that already are patterns', () => {
  assert.deepEqual(describePlural('der Kunde', '-n'), [{ pattern: '-n' }]);
});

test('separators · and ≠, slashes inside parentheses', () => {
  assert.deepEqual(describePlural('die Attraktion · die Sehenswürdigkeit', 'die Attraktionen · die Sehenswürdigkeiten'), [
    { form: 'die Attraktionen', pattern: '-en' },
    { form: 'die Sehenswürdigkeiten', pattern: '-en' }
  ]);
  assert.deepEqual(describePlural('der Vorteil ≠ der Nachteil', 'die Vorteile / die Nachteile'), [
    { form: 'die Vorteile', pattern: '-e' },
    { form: 'die Nachteile', pattern: '-e' }
  ]);
  assert.deepEqual(describePlural('der Kragen', 'die Kragen / die Krägen (Südd. / A / CH)'), [
    { form: 'die Kragen', pattern: '–' },
    { form: 'die Krägen (Südd. / A / CH)', pattern: '¨' }
  ]);
  assert.deepEqual(describePlural('die Ablehnung ≠ die Zustimmung', 'die Ablehnungen / (Zustimmung nur Sg.)'), [
    { form: 'die Ablehnungen', pattern: '-en' },
    { label: 'singularOnly' }
  ]);
});

test('doubled vowel, arrow entries, article pairs mid-word', () => {
  assert.equal(patternOf('der Saal', 'die Säle'), '¨-e');
  assert.deepEqual(describePlural('ankommen → die Ankunft', 'die Ankünfte'), [{ form: 'die Ankünfte', pattern: '¨-e' }]);
  assert.deepEqual(describePlural('der Tod / der / die Tote', 'die Tode / die Toten'), [
    { form: 'die Tode', pattern: '-e' },
    { form: 'die Toten', pattern: '-n' }
  ]);
});
