import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  declinePhrase, generateRound, datPluralSuffix, SELF_TEST_CASES, runDeclensionSelfTest,
  NOUNS, ADJECTIVES, CASES
} from '../src/features/adjective/grammar.ts';

// Every self-test case becomes its own test, so a failure names the exact case that broke.
for (const tc of SELF_TEST_CASES) {
  test(`declension: ${tc.name}`, () => {
    const phrase = declinePhrase(tc.params);
    assert.equal(phrase.article?.full ?? null, tc.expected.article ?? null);
    assert.equal(phrase.adjective?.full ?? null, tc.expected.adjective ?? null);
    assert.equal(phrase.noun.full, tc.expected.noun);
  });
}

test('runDeclensionSelfTest does not throw', () => {
  assert.doesNotThrow(() => runDeclensionSelfTest());
});

test('datPluralSuffix: adds -n unless the plural already ends in -n or -s', () => {
  assert.equal(datPluralSuffix('Kinder'), 'n');
  assert.equal(datPluralSuffix('Fahrräder'), 'n');
  assert.equal(datPluralSuffix('Parks'), '');
  assert.equal(datPluralSuffix('Autos'), '');
  assert.equal(datPluralSuffix('Frauen'), '');
  assert.equal(datPluralSuffix('Herren'), '');
});

test('n-Deklination: the noun slot carries only the added suffix, not the whole word twice', () => {
  const herr = NOUNS.find(n => n.id === 'herr')!;
  const phrase = declinePhrase({ noun: herr, adjective: null, articleType: 'definite', case: 'akk', gender: 'm', number: 'sg' });
  assert.equal(phrase.noun.prefix, 'Herr');
  assert.equal(phrase.noun.ending, 'n');
  assert.equal(phrase.noun.full, 'Herrn');
});

test('n-Deklination: nominativ singular is unaffected', () => {
  const student = NOUNS.find(n => n.id === 'student')!;
  const phrase = declinePhrase({ noun: student, adjective: 'jung', articleType: 'definite', case: 'nom', gender: 'm', number: 'sg' });
  assert.equal(phrase.noun.full, 'Student');
  assert.equal(phrase.adjective?.full, 'junge');
});

test('no-adjective round has no adjective slot but still declines article and noun', () => {
  const kind = NOUNS.find(n => n.id === 'kind')!;
  const phrase = declinePhrase({ noun: kind, adjective: null, articleType: 'definite', case: 'dat', gender: 'n', number: 'sg' });
  assert.equal(phrase.adjective, null);
  assert.equal(phrase.article?.full, 'dem');
  assert.equal(phrase.noun.full, 'Kind');
});

test('strong declension (no article) has no article slot', () => {
  const kaffee = NOUNS.find(n => n.id === 'kaffee')!;
  const phrase = declinePhrase({ noun: kaffee, adjective: 'kalt', articleType: 'none', case: 'dat', gender: 'm', number: 'sg' });
  assert.equal(phrase.article, null);
  assert.equal(phrase.adjective?.full, 'kaltem');
});

test('generateRound: always produces a noun and a grammatically valid article type', () => {
  for (let i = 0; i < 200; i++) {
    const r = generateRound();
    assert.ok(NOUNS.includes(r.noun));
    assert.ok(CASES.includes(r.case));
    if (r.number === 'pl') {
      assert.ok(r.noun.plural, 'a plural round must use a noun that has a plural form');
      assert.notEqual(r.articleType, 'indefinite', 'the indefinite article has no plural');
    }
    if (r.articleType === 'none' && r.number === 'sg') {
      assert.ok(r.noun.noArticle, 'a singular article-less round must use a mass noun');
    }
    if (r.adjective !== null) assert.ok(ADJECTIVES.includes(r.adjective));
    // The round's own phrase must match recomputing declinePhrase from its params.
    const recomputed = declinePhrase(r);
    assert.deepEqual(r.phrase, recomputed);
  }
});

test('generateRound: both "no adjective" and "with adjective" rounds occur', () => {
  const rounds = Array.from({ length: 300 }, () => generateRound());
  assert.ok(rounds.some(r => r.adjective === null), 'expected at least one no-adjective round in 300 tries');
  assert.ok(rounds.some(r => r.adjective !== null), 'expected at least one round with an adjective in 300 tries');
});
