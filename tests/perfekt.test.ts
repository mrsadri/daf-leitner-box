import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPerfekt, parseAccepted, perfektFromFormen, maskParticiples } from '../src/services/perfekt.ts';

const check = (input: string, perfekt: string) => checkPerfekt(input, parseAccepted(perfekt));
const verdict = (input: string, perfekt: string) => check(input, perfekt).verdict;

test('exact answers', () => {
  assert.equal(verdict('ist gekommen', 'ist gekommen'), 'correct');
  assert.equal(verdict('hat gefragt', 'hat gefragt'), 'correct');
});

test('case, spacing and punctuation do not matter', () => {
  assert.equal(verdict('  IST   Gekommen. ', 'ist gekommen'), 'correct');
  assert.equal(verdict('ist ski gefahren', 'ist Ski gefahren'), 'correct');
  assert.equal(verdict('hat gefragt!', 'hat gefragt'), 'correct');
});

test('umlauts and ß may be spelled out', () => {
  assert.equal(verdict('hat geoeffnet', 'hat geöffnet'), 'correct');
  assert.equal(verdict('hat geschlossen', 'hat geschlossen'), 'correct');
  assert.equal(verdict('hat gestossen', 'hat gestoßen | ist gestoßen'), 'correct');
  assert.equal(verdict('hat gemuesst', 'hat gemüsst'), 'correct');
});

test('subject pronoun and conjugated auxiliary are accepted', () => {
  assert.equal(verdict('ich bin gekommen', 'ist gekommen'), 'correct');
  assert.equal(verdict('wir sind gekommen', 'ist gekommen'), 'correct');
  assert.equal(verdict('ich habe gefragt', 'hat gefragt'), 'correct');
  assert.equal(verdict('du hast gefragt', 'hat gefragt'), 'correct');
  assert.equal(verdict('es hat geblitzt', 'hat geblitzt'), 'correct');
});

test('wrong auxiliary is wrong, even with a correct participle', () => {
  const r = check('hat gekommen', 'ist gekommen');
  assert.equal(r.verdict, 'wrongAux');
  assert.equal(r.correct, false);
  assert.equal(verdict('ist gefragt', 'hat gefragt'), 'wrongAux');
  // wrong auxiliary plus a typo is still wrong
  assert.equal(check('hat gekomen', 'ist gekommen').correct, false);
});

test('both auxiliaries accepted where the data allows it', () => {
  assert.equal(verdict('hat gerudert', 'ist gerudert | hat gerudert'), 'correct');
  assert.equal(verdict('ist gerudert', 'ist gerudert | hat gerudert'), 'correct');
  assert.equal(check('hat gerudert', 'ist gerudert | hat gerudert').expected, 'hat gerudert');
});

test('alternative participles', () => {
  assert.equal(verdict('hat gesendet', 'hat gesandt | hat gesendet'), 'correct');
  assert.equal(verdict('hat gesandt', 'hat gesandt | hat gesendet'), 'correct');
  assert.equal(verdict('hat gehangen', 'hat gehängt | hat gehangen'), 'correct');
});

test('one-letter typo counts as almost (correct), two letters are wrong', () => {
  const r = check('ist gekomen', 'ist gekommen');
  assert.equal(r.verdict, 'almost');
  assert.equal(r.correct, true);
  assert.equal(verdict('ist gekomn', 'ist gekommen'), 'wrong');
  assert.equal(verdict('hat geschriben', 'hat geschrieben'), 'almost');
});

test('typo tolerance needs a participle of at least 4 letters', () => {
  assert.equal(verdict('hat getab', 'hat getan'), 'almost');
  assert.equal(parseAccepted('hat xy').length, 1);
  assert.equal(verdict('hat xz', 'hat xy'), 'wrong');
});

test('missing auxiliary asks for a retry instead of grading', () => {
  const r = check('gekommen', 'ist gekommen');
  assert.equal(r.verdict, 'missingAux');
  assert.equal(r.correct, false);
  assert.equal(verdict('ich gekommen', 'ist gekommen'), 'missingAux');
});

test('reflexive verbs: sich optional (with a note), other reflexive pronouns accepted', () => {
  assert.equal(verdict('hat sich gefreut', 'hat sich gefreut'), 'correct');
  const noSich = check('hat gefreut', 'hat sich gefreut');
  assert.equal(noSich.verdict, 'correct');
  assert.equal(noSich.missingSich, true);
  assert.equal(verdict('ich habe mich gefreut', 'hat sich gefreut'), 'correct');
  assert.equal(verdict('wir haben uns gefreut', 'hat sich gefreut'), 'correct');
  assert.equal(check('hat sich gefreut', 'hat sich gefreut').missingSich, false);
});

test('optional reflexive: both forms correct, no note', () => {
  const r = check('hat verändert', 'hat sich verändert | hat verändert');
  assert.equal(r.verdict, 'correct');
  assert.equal(r.missingSich, false);
});

test('extra sich on a non-reflexive verb is wrong', () => {
  assert.equal(verdict('hat sich gefragt', 'hat gefragt'), 'wrong');
});

test('separable parts and multi-word answers', () => {
  assert.equal(verdict('ist spazieren gegangen', 'ist spazieren gegangen'), 'correct');
  assert.equal(verdict('ist skigefahren', 'ist Ski gefahren'), 'almost');
  assert.equal(verdict('hat weh getan', 'hat wehgetan | hat weh getan'), 'correct');
});

test('empty or nonsense input', () => {
  assert.equal(check('', 'ist gekommen').correct, false);
  assert.equal(verdict('hat gegessen', 'ist gekommen'), 'wrong');
  assert.equal(check('hat gegessen', 'ist gekommen').expected, 'ist gekommen');
});

test('reading Perfekt from a custom card Formen field', () => {
  assert.deepEqual(perfektFromFormen('lernt · lernte · hat gelernt'), ['hat gelernt']);
  assert.deepEqual(perfektFromFormen('fährt · fuhr · ist gefahren (hat gefahren + Akk)'), ['ist gefahren']);
  assert.deepEqual(perfektFromFormen('rudert · ist/hat gerudert'), ['ist gerudert', 'hat gerudert']);
  assert.deepEqual(perfektFromFormen('sendet · hat gesandt / gesendet'), ['hat gesandt', 'hat gesendet']);
  assert.deepEqual(perfektFromFormen(''), []);
  assert.deepEqual(perfektFromFormen('hat gehängt · hat gehangen'), []);
  assert.deepEqual(perfektFromFormen('lernt · lernte'), []);
});

test('masking participles before the answer', () => {
  assert.equal(maskParticiples('fährt · fuhr · ist gefahren', ['ist gefahren']), 'fährt · fuhr · ist …');
  assert.equal(maskParticiples('Ich bin nach Hause gefahren.', ['ist gefahren']), 'Ich bin nach Hause ….');
  assert.equal(maskParticiples('hat gesandt / gesendet', ['hat gesandt', 'hat gesendet']), 'hat … / …');
  // does not touch other words that merely contain the participle
  assert.equal(maskParticiples('ungefahren gefahrene', ['ist gefahren']), 'ungefahren gefahrene');
});
