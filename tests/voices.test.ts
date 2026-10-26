import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickGermanVoice, germanVoices, normalizeLang } from '../src/services/voices.ts';

const v = (name: string, lang: string, voiceURI = name) => ({ name, lang, voiceURI });

test('language codes are normalised', () => {
  assert.equal(normalizeLang('de_DE'), 'de-DE');
  assert.equal(normalizeLang('de-de'), 'de-DE');
  assert.equal(normalizeLang('DE'), 'de');
});

test('never picks a non-German voice', () => {
  assert.equal(pickGermanVoice([v('Samantha', 'en-US'), v('Alex', 'en-US')]), null);
  assert.equal(pickGermanVoice([]), null);
});

test('prefers standard German, then natural/online voices', () => {
  const voices = [v('Samantha', 'en-US'), v('Eddy (Deutsch (Deutschland))', 'de-DE'), v('Anna', 'de-DE'), v('Google Deutsch', 'de-DE'), v('Swiss', 'de-CH')];
  assert.equal(pickGermanVoice(voices)?.name, 'Google Deutsch');
  assert.equal(pickGermanVoice(voices.filter(x => x.name !== 'Google Deutsch'))?.name, 'Anna');
  // a novelty voice is only used when nothing else is German
  assert.equal(pickGermanVoice([v('Eddy', 'de-DE'), v('Swiss', 'de-CH')])?.name, 'Swiss');
});

test('Android-style codes count as German', () => {
  assert.equal(pickGermanVoice([v('Deutsch', 'de_DE'), v('English', 'en_US')])?.name, 'Deutsch');
});

test("the user's choice wins while it is available", () => {
  const voices = [v('Anna', 'de-DE'), v('Petra', 'de-AT', 'petra-uri')];
  assert.equal(pickGermanVoice(voices, 'petra-uri')?.name, 'Petra');
  assert.equal(pickGermanVoice(voices, 'gone-uri')?.name, 'Anna');
  // a non-German preferred voice is ignored
  assert.equal(pickGermanVoice([...voices, v('Alex', 'en-US')], 'Alex')?.name, 'Anna');
});

test('settings list: German only, best first', () => {
  const list = germanVoices([v('Alex', 'en-US'), v('Eddy', 'de-DE'), v('Anna', 'de-DE')]);
  assert.deepEqual(list.map(x => x.name), ['Anna', 'Eddy']);
});
