import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compare, charDiff, CATEGORIES, type Category } from '../src/services/dictation/compare.ts';

const cats = (typed: string, expected: string): Category[] => compare(typed, expected).marks.map(m => m.category);

test('exact match is correct and has no marks', () => {
  const r = compare('Montag, acht Uhr morgens.', 'Montag, acht Uhr morgens.');
  assert.equal(r.correct, true);
  assert.equal(r.marks.length, 0);
  assert.equal(r.summary.total, 0);
});

// ---- tolerated normalizations -------------------------------------------------------------------------------------
const tolerated: [string, string, string][] = [
  ['straight quotes', '"Hallo!" sagt sie.', '„Hallo!“ sagt sie.'],
  ['guillemets', '«Hallo!» sagt sie.', '„Hallo!“ sagt sie.'],
  ['apostrophe', "Wie geht's?", 'Wie geht’s?'],
  ['single quotes', "Er sagt: 'Ja'.", 'Er sagt: ‚Ja‘.'],
  ['dash', 'Graz – Wien', 'Graz - Wien'],
  ['three dots', 'Ich ... ich weiß nicht.', 'Ich … ich weiß nicht.'],
  ['decomposed umlaut', 'Ma\u0308dchen', 'M\u00e4dchen'],
  ['NBSP and double spaces', 'Ich bin   hier.', 'Ich bin hier.'],
  ['trailing space and newline', 'Ich bin hier.  \n', 'Ich bin hier.'],
];
for (const [name, typed, expected] of tolerated) {
  test(`tolerated: ${name}`, () => assert.equal(compare(typed, expected).correct, true, JSON.stringify(compare(typed, expected).marks)));
}

// ---- one test row per category -------------------------------------------------------------------------------------
const table: [string, string, string, Category[]][] = [
  ['case: noun in lower case', 'Ich habe einen termin.', 'Ich habe einen Termin.', ['case']],
  ['case: sentence start', 'ich habe einen Termin.', 'Ich habe einen Termin.', ['case']],
  ['case: polite Sie versus sie', 'Wie heißen sie?', 'Wie heißen Sie?', ['case']],
  ['umlaut substitution', 'Das Maedchen lacht.', 'Das Mädchen lacht.', ['umlaut-substitution']],
  ['umlaut substitution, capital', 'Oesterreich ist schön.', 'Österreich ist schön.', ['umlaut-substitution']],
  ['eszett substitution', 'Sie heisst Nili.', 'Sie heißt Nili.', ['eszett-substitution']],
  ['missing comma', 'Ja gern, und du?', 'Ja, gern, und du?', ['punctuation']],
  ['extra comma', 'Ja, gern, und, du?', 'Ja, gern, und du?', ['punctuation']],
  ['wrong end mark', 'Ich komme aus Graz!', 'Ich komme aus Graz.', ['punctuation']],
  ['missing end mark', 'Ich komme aus Graz', 'Ich komme aus Graz.', ['punctuation']],
  ['missing closing quote', '„Danke! sagt sie.', '„Danke!“ sagt sie.', ['punctuation']],
  ['typo: missing letter', 'Ich habe einen Termn.', 'Ich habe einen Termin.', ['typo-missing-letter']],
  ['typo: extra letter', 'Ich habe einen Terminn.', 'Ich habe einen Termin.', ['typo-extra-letter']],
  ['typo: wrong letter', 'Ich habe einen Termon.', 'Ich habe einen Termin.', ['typo-wrong-letter']],
  ['typo: swapped letters', 'Ich habe einen Temrin.', 'Ich habe einen Termin.', ['typo-swapped-letters']],
  ['typo: wrong accent', 'Das ist Lucia.', 'Das ist Lucía.', ['typo-wrong-letter']],
  ['typo: missing hyphen in E-Mail', 'Meine EMail ist neu.', 'Meine E-Mail ist neu.', ['typo-missing-letter']],
  ['wrong word', 'Ich habe eine Katze.', 'Ich habe eine Wohnung.', ['wrong-word']],
  ['spelled-out number is a wrong word', 'Ich bin neunzehn.', 'Ich bin 19.', ['wrong-word']],
  ['missing word', 'Ich habe Termin.', 'Ich habe einen Termin.', ['missing-word']],
  ['extra word', 'Ich habe einen neuen Termin.', 'Ich habe einen Termin.', ['extra-word']],
  ['order: swapped words', 'Ich einen habe Termin.', 'Ich habe einen Termin.', ['order', 'order']],
  ['spacing: space before comma', 'Ja , gern.', 'Ja, gern.', ['spacing']],
  ['spacing: missing space after comma', 'Ja,gern.', 'Ja, gern.', ['spacing']],
  ['spacing: missing space between sentence parts', 'Ich komme.Du auch.', 'Ich komme. Du auch.', ['spacing']],
  ['two mistakes at once', 'ich habe einen Termn.', 'Ich habe einen Termin.', ['case', 'typo-missing-letter']],
];
for (const [name, typed, expected, want] of table) {
  test(`category: ${name}`, () => assert.deepEqual(cats(typed, expected), want, JSON.stringify(compare(typed, expected).marks)));
}

test('every category is covered by the table above', () => {
  const covered = new Set<Category>();
  for (const row of table) row[3].forEach(c => covered.add(c));
  assert.deepEqual(CATEGORIES.filter(c => !covered.has(c)), []);
});

// ---- positions ----------------------------------------------------------------------------------------------------
test('marks carry offsets into the typed text and the expected token index', () => {
  const r = compare('Ich habe einen termin.', 'Ich habe einen Termin.');
  assert.equal(r.marks.length, 1);
  const m = r.marks[0];
  assert.deepEqual(m.typed, { start: 15, end: 21 });
  assert.equal(r.typed.slice(m.typed!.start, m.typed!.end), 'termin');
  assert.equal(m.expectedTokenIndex, 3);
});

test('a missing word has no typed range but a gap position and the expected token index', () => {
  const r = compare('Ich habe Termin.', 'Ich habe einen Termin.');
  assert.equal(r.marks[0].typed, null);
  assert.equal(r.marks[0].gapAfter, 8);
  assert.equal(r.marks[0].expectedTokenIndex, 2);
});

test('letter marks locate the wrong, extra and missing characters', () => {
  const wrong = compare('Termon', 'Termin').marks[0];
  assert.deepEqual(wrong.chars, [{ kind: 'wrong', at: 4 }]);
  const extra = compare('Terminn', 'Termin').marks[0];
  assert.equal(extra.chars?.length, 1);                       // one of the two n (the same mistake either way)
  assert.equal(extra.chars![0].kind, 'extra');
  assert.ok([5, 6].includes(extra.chars![0].at));
  const missing = compare('Termn', 'Termin').marks[0];
  assert.deepEqual(missing.chars, [{ kind: 'missing', at: 4 }]);
});

test('the summary counts marks by category', () => {
  const r = compare('ich habe einen termin', 'Ich habe einen Termin.');
  assert.equal(r.summary.total, 3);
  assert.equal(r.summary.byCategory.case, 2);
  assert.equal(r.summary.byCategory.punctuation, 1);
});

// ---- the owner's rule: never reveal the correct letters ------------------------------------------------------------
test('the result never contains the expected text or any expected word', () => {
  const expected = 'Nilufar wohnt seit Sonntag in Graz.';
  const r = compare('Nilfar wohnd seit Sontag in Gras', expected);
  const json = JSON.stringify(r);
  for (const word of ['Nilufar', 'wohnt', 'Sonntag', 'Graz']) assert.ok(!json.includes(word), `leaks ${word}`);
  for (const m of r.marks) assert.deepEqual(Object.keys(m).filter(k => !['category', 'typed', 'gapAfter', 'expectedTokenIndex', 'chars'].includes(k)), []);
});

test('wrong, missing, extra: a long sentence with several mistakes finds each of them', () => {
  const expected = 'Dort gibt es viel: eine Kommode aus Kunststoff, eine Lampe aus Metall und Glas, ein Regal.';
  const typed = 'Dort gibt es viel: eine Kommode aus Kunststoff eine Lampe Metall und Glass, ein Regal.';
  const c = cats(typed, expected);
  assert.deepEqual(c.sort(), ['missing-word', 'punctuation', 'typo-extra-letter'].sort());
});

test('performance: 33 words compare in a few milliseconds at most (tests run in parallel, so the bound is generous)', () => {
  const expected = 'Die Jeans ist blau, der Rock ist grün, das Sweatshirt ist grau, die Bluse ist weiß, die Hose ist schwarz, das Kleid ist rot, der Mantel ist braun, die Jacke ist gelb, der Schal ist lila.';
  const typed = expected.replace('Rock', 'Rok').replace('grau,', 'grau');
  const t0 = performance.now();
  for (let i = 0; i < 200; i++) compare(typed, expected);
  assert.ok((performance.now() - t0) / 200 < 15, 'slow');
});

test('charDiff: transposition counts as one edit', () => {
  assert.equal(charDiff('Temrin', 'Termin').distance, 1);
  assert.equal(charDiff('', 'ab').distance, 2);
});
