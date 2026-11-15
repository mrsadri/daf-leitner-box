import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldSubmit, needsManualSubmitHint, type TriggerInput } from '../src/services/dictation/submitTrigger.ts';

const ABBR = ['Tel', 'Nr', 'Dr', 'z. B', 'd. h', 'usw', 'ca'];

/** Type `text` one character at a time; return the 1-based positions at which the trigger fired. */
function typeIt(text: string, expectedText: string, quoteBalance = 0, extra: Partial<TriggerInput> = {}): number[] {
  const fired: number[] = [];
  const chars = Array.from(text);
  for (let i = 1; i <= chars.length; i++) {
    const ok = shouldSubmit({
      inputType: 'insertText', inserted: chars[i - 1], value: chars.slice(0, i).join(''), caretAtEnd: true, composing: false,
      expected: { text: expectedText, quoteBalance, ...(extra.expected ?? {}) }, abbreviations: ABBR, ...extra,
    });
    if (ok) fired.push(i);
  }
  return fired;
}
const firesOnlyAtEnd = (text: string, expected = text, qb = 0) => {
  const f = typeIt(text, expected, qb);
  assert.deepEqual(f, [Array.from(text).length], `fired at ${JSON.stringify(f)} for ${text}`);
};

test('plain sentence: the final period submits, nothing before it does', () => firesOnlyAtEnd('Es regnet in Graz.'));
test('question and exclamation marks submit', () => { firesOnlyAtEnd('Wo wohnst du?'); firesOnlyAtEnd('Gute Reise!'); });

test('Q1: a quote with a dialogue tag: the inner ? does not submit, the final period does', () => {
  const t = '„Wie geht’s?“, fragt Lucía am Telefon.';
  assert.deepEqual(typeIt(t, t), [Array.from(t).length]);
});

test('Q2: a sentence ending with a closing quote after the mark: the quote submits, the mark does not', () => {
  const t = '„Danke!“';
  assert.deepEqual(typeIt(t, t), [t.length]);
});

test('Q3: the learner omits the opening quote: the ? submits early', () => {
  const f = typeIt('Wie geht’s?', '„Wie geht’s?“, fragt Lucía.');
  assert.deepEqual(f, [11]);
});

test('Q4/K3: straight and curly quotes count the same', () => {
  assert.deepEqual(typeIt('"Danke!"', '„Danke!“'), [8]);
  assert.deepEqual(typeIt('“Danke!”', '„Danke!“'), [8]);
});

test('Q5: single quotes are not counted by the trigger', () => {
  const t = 'Sie sagt: ‚Hallo!‘';
  assert.ok(typeIt(t, t).includes('Sie sagt: ‚Hallo!'.length));   // the ! inside single quotes submits (early, harmless)
});

test('Q6: the period after digits never submits (ordinal dot)', () => {
  const t = 'Montag, 19. Oktober.';
  assert.deepEqual(typeIt(t, t), [t.length]);
});

test('Q7: a sentence ending in digits plus period: no auto submit, hint says to press Enter', () => {
  const t = 'Hausnummer 14.';
  assert.deepEqual(typeIt(t, t, 0, { expected: { text: t, quoteBalance: 0, flags: ['endsDigitDot'] } }), []);
  assert.equal(needsManualSubmitHint(['digits', 'endsDigitDot']), true);
  assert.equal(needsManualSubmitHint([]), false);
});

test('Q8: times and decimals do not submit mid-number', () => firesOnlyAtEnd('Er läuft 1:52 oder 3,5 Kilometer.'));

test('Q10: a known abbreviation does not submit, the final period still does', () => {
  const t = 'Tel. 0316 72 14 ist besetzt.';
  assert.deepEqual(typeIt(t, t), [t.length]);
});

test('Q10b: z. B. does not submit on either dot', () => {
  const t = 'Das ist z. B. Jonas.';
  assert.deepEqual(typeIt(t, t), [t.length]);
});

test('an abbreviation at the very end of the expected sentence does submit', () => {
  const t = 'Es gibt Kaffee, Tee usw.';
  assert.deepEqual(typeIt(t, t), [t.length]);
});

test('an initial (H.) does not submit unless the sentence ends there', () => {
  const t = 'Wer ist H.?';
  assert.deepEqual(typeIt(t, t), [t.length]);
});

test('Q11: three dots or the ellipsis character submit; two dots wait', () => {
  const t = 'Vielleicht...';
  // the first dot is a single period (it submits, see Q12); the second waits; the third submits again
  assert.deepEqual(typeIt(t, 'Vielleicht…'), [11, 13]);
  assert.deepEqual(typeIt('Vielleicht…', 'Vielleicht…'), [11]);
  assert.deepEqual(typeIt('Vielleicht..', 'Vielleicht…'), [11]);   // only the first dot; the second waits
});

test('Q11b: three dots in the middle of a sentence submit on the third dot (harmless)', () => {
  const t = 'Ich ... ich weiß nicht.';
  const f = typeIt(t, 'Ich … ich weiß nicht.');
  assert.ok(f.includes(7) && f.includes(t.length));
});

test('Q12: a single period where an ellipsis is expected submits', () => {
  assert.deepEqual(typeIt('Vielleicht.', 'Vielleicht …'), [11]);
});

test('Q16: first half of a split quote has its own balance and submits at its mark despite the open quote', () => {
  const t = '„Das ist Kenji Sato.';
  assert.deepEqual(typeIt(t, t, 1), [t.length]);
  const second = 'Und das ist Jonas Huber.“';
  assert.deepEqual(typeIt(second, second, -1), [second.length]);
});

test('K4: iOS double space inserts ". " and does not fire (the caret is not after a mark)', () => {
  assert.equal(shouldSubmit({ inputType: 'insertText', inserted: '. ', value: 'Ich bin hier. ', caretAtEnd: true, composing: false,
    expected: { text: 'Ich bin hier.', quoteBalance: 0 }, abbreviations: ABBR }), false);
});

test('paste, drop and IME composition never submit; the caret must be at the end; empty input never submits', () => {
  const base: TriggerInput = { inputType: 'insertText', inserted: '.', value: 'Ich bin hier.', caretAtEnd: true, composing: false,
    expected: { text: 'Ich bin hier.', quoteBalance: 0 }, abbreviations: ABBR };
  assert.equal(shouldSubmit(base), true);
  assert.equal(shouldSubmit({ ...base, inputType: 'insertFromPaste' }), false);
  assert.equal(shouldSubmit({ ...base, inputType: 'insertFromDrop' }), false);
  assert.equal(shouldSubmit({ ...base, inputType: 'insertCompositionText' }), false);
  assert.equal(shouldSubmit({ ...base, composing: true }), false);
  assert.equal(shouldSubmit({ ...base, caretAtEnd: false }), false);
  assert.equal(shouldSubmit({ ...base, value: '.', inserted: '.' }), true);          // a lone mark is still text
  assert.equal(shouldSubmit({ ...base, value: '  ', inserted: ' ' }), false);
  assert.equal(shouldSubmit({ ...base, inputType: 'deleteContentBackward' }), false);
});
