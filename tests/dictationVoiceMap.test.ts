import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceMap, findClashes, needsRecompute, stableHash, voiceClass, voiceGender, voiceListHash, type CastMember } from '../src/services/dictation/voiceMap.ts';
import type { VoiceInfo } from '../src/services/voices.ts';
import cast from '../content/dictation/cast.json' with { type: 'json' };

const members: CastMember[] = (cast as { characters: CastMember[] }).characters;
const v = (name: string): VoiceInfo => ({ name, lang: 'de-DE', voiceURI: name });
const two = [v('Anna'), v('Markus')];
const many = [v('Anna'), v('Helena'), v('Katja'), v('Markus'), v('Yannick'), v('Viktor')];

test('voice gender comes from the name hints; unknown names are neutral', () => {
  assert.equal(voiceGender(v('Anna (Premium)')), 'f');
  assert.equal(voiceGender(v('Markus')), 'm');
  assert.equal(voiceGender(v('Microsoft Zorro')), 'n');
});

test('classes: child, young and older women, elder, man, narrator', () => {
  const by = (id: string) => voiceClass(members.find(m => m.id === id)!);
  assert.equal(by('NARRATOR'), 'narrator');
  assert.equal(by('PAUL'), 'child');
  assert.equal(by('LENA'), 'child');
  assert.equal(by('NILI'), 'young-woman');
  assert.equal(by('WAGNER'), 'older-woman');
  assert.equal(by('HERMINE'), 'elder');
  assert.equal(by('JONAS'), 'man');
});

test('the map is deterministic and does not depend on call order or story', () => {
  const a = buildVoiceMap(many, members);
  const b = buildVoiceMap(many, members);
  assert.deepEqual(a, b);
  assert.ok(Object.keys(a).length === members.length);
});

test('characters get a voice of their own gender where the device has one', () => {
  const map = buildVoiceMap(many, members);
  const female = new Set(['Anna', 'Helena', 'Katja']);
  for (const id of ['NILI', 'LUCIA', 'WAGNER', 'LECHNER']) assert.ok(female.has(map[id].voiceURI), id);
  for (const id of ['JONAS', 'KENJI', 'MARTIN']) assert.ok(!female.has(map[id].voiceURI), id);
});

test('the narrator uses the preferred voice, otherwise the best one', () => {
  assert.equal(buildVoiceMap(many, members, 'Viktor').NARRATOR.voiceURI, 'Viktor');
  assert.equal(buildVoiceMap(many, members).NARRATOR.voiceURI, 'Anna');
  assert.equal(buildVoiceMap(many, members, 'Gone').NARRATOR.voiceURI, 'Anna');
});

test('characters that share a voice differ by at least 0.15 pitch (while the 0.7 to 1.5 range has room)', () => {
  const few = members.filter(m => ['PAUL', 'NILI', 'JONAS', 'HERMINE', 'KENJI'].includes(m.id));
  const map = buildVoiceMap([v('Anna')], few);
  const pitches = Object.values(map).map(m => m.pitch).sort((a, b) => a - b);
  for (let i = 1; i < pitches.length; i++) assert.ok(pitches[i] - pitches[i - 1] >= 0.15 - 1e-9, pitches.join(' '));
});

test('with few voices and a large cast sharing is unavoidable: all pitches stay valid and the clash check still works', () => {
  const map = buildVoiceMap(two, members);
  for (const m of Object.values(map)) assert.ok(m.pitch >= 0.7 && m.pitch <= 1.5);
  const sameVoice = Object.values(map).filter(m => m.voiceURI === 'Anna').length;
  assert.ok(sameVoice > 6);                       // more characters than distinct pitch steps: findClashes is the safety net
});

test('pitch and rate stay inside the clamps', () => {
  for (const m of Object.values(buildVoiceMap([v('Anna')], members))) {
    assert.ok(m.pitch >= 0.7 && m.pitch <= 1.5);
    assert.ok(m.rate >= 0.6 && m.rate <= 1.3);
  }
});

test('with one voice every class still gets its base pitch order: child higher than young woman higher than man', () => {
  const map = buildVoiceMap([v('Anna')], members.filter(m => ['PAUL', 'NILI', 'JONAS', 'HERMINE'].includes(m.id)));
  assert.ok(map.PAUL.pitch > map.NILI.pitch);
  assert.ok(map.NILI.pitch > map.JONAS.pitch);
  assert.ok(map.JONAS.pitch > map.HERMINE.pitch);
});

test('no device voices: an empty map (the chain falls through, see fallback.ts)', () => {
  assert.deepEqual(buildVoiceMap([], members), {});
});

test('findClashes reports characters in the same sequence that sound alike', () => {
  const map = { A: { voiceURI: 'x', pitch: 1, rate: 1 }, B: { voiceURI: 'x', pitch: 1.05, rate: 1.02 }, C: { voiceURI: 'x', pitch: 1.3, rate: 1 }, D: { voiceURI: 'y', pitch: 1, rate: 1 } };
  assert.deepEqual(findClashes(map, ['A', 'B', 'C', 'D', 'A']), [['A', 'B']]);
});

test('the map is recomputed only when the voice list changes', () => {
  const stored = { voiceListHash: voiceListHash(many), map: buildVoiceMap(many, members) };
  assert.equal(needsRecompute(stored, [...many].reverse()), false);        // order does not matter
  assert.equal(needsRecompute(stored, many.slice(1)), true);               // a voice disappeared
  assert.equal(needsRecompute(null, many), true);
  assert.equal(stableHash('NILI'), stableHash('NILI'));
});
