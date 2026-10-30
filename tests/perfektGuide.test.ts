import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { explainPerfekt } from '../src/services/perfektGuide.ts';
import { parseAccepted } from '../src/services/perfekt.ts';

/** Minimal RFC 4180 reader (the app's parser imports browser-only modules). */
function readCsv(path: string): Record<string, string>[] {
  const text = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows.filter(r => r.some(v => v.trim()));
  return body.map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const verbs = readCsv(new URL('../public/data/wortschatz-daf-kompakt.csv', import.meta.url).pathname)
  .filter(r => r.Wortart === 'Verb' && r.Perfekt);

const guide = (inf: string, perfekt: string) => {
  const g = explainPerfekt(inf, parseAccepted(perfekt));
  assert.ok(g, `${inf}: no guide`);
  return g!;
};
const parts = (inf: string, perfekt: string) => guide(inf, perfekt).segments.map(s => `${s.part}:${s.text}`).join(' ');

test('the six ways of forming the participle', () => {
  assert.deepEqual([guide('machen', 'hat gemacht').group, guide('machen', 'hat gemacht').prefix], ['weak', 'none']);
  assert.equal(parts('machen', 'hat gemacht'), 'ge:ge stem:mach ending:t');
  assert.equal(guide('arbeiten', 'hat gearbeitet').endingEt, true);
  assert.equal(parts('arbeiten', 'hat gearbeitet'), 'ge:ge stem:arbeit ending:et');

  const gehen = guide('gehen', 'ist gegangen');
  assert.deepEqual([gehen.group, gehen.prefix, gehen.stemChanged, gehen.participleStem], ['strong', 'none', true, 'gang']);
  assert.equal(guide('sehen', 'hat gesehen').stemChanged, false);
  assert.equal(guide('geben', 'hat gegeben').prefix, 'none');

  const bringen = guide('bringen', 'hat gebracht');
  assert.deepEqual([bringen.group, bringen.infinitiveStem, bringen.participleStem], ['mixed', 'bring', 'brach']);
  assert.equal(guide('wissen', 'hat gewusst').group, 'mixed');

  assert.equal(parts('anrufen', 'hat angerufen'), 'prefix:an ge:ge stem:ruf ending:en');
  assert.deepEqual([guide('einkaufen', 'hat eingekauft').group, guide('einkaufen', 'hat eingekauft').separable], ['weak', 'ein']);
  assert.equal(guide('kennenlernen', 'hat kennengelernt').separable, 'kennen');
  assert.equal(guide('herankommen', 'ist herangekommen').separable, 'heran');
  assert.equal(parts('weh tun', 'hat wehgetan | hat weh getan'), 'prefix:weh ge:ge stem:ta ending:n');

  assert.equal(parts('besuchen', 'hat besucht'), 'prefix:be stem:such ending:t');
  const verstehen = guide('verstehen', 'hat verstanden');
  assert.deepEqual([verstehen.group, verstehen.prefix, verstehen.inseparable], ['strong', 'inseparable', 'ver']);
  assert.deepEqual([guide('gehören', 'hat gehört').prefix, guide('gehören', 'hat gehört').inseparable], ['inseparable', 'ge']);
  assert.equal(guide('gewinnen', 'hat gewonnen').prefix, 'inseparable');
  assert.equal(guide('übersetzen', 'hat übersetzt').inseparable, 'über');
  assert.equal(parts('vorbereiten', 'hat vorbereitet'), 'prefix:vor prefix:be stem:reit ending:et');

  assert.deepEqual([guide('studieren', 'hat studiert').group, guide('studieren', 'hat studiert').prefix], ['weak', 'ieren']);
  assert.equal(parts('ausprobieren', 'hat ausprobiert'), 'prefix:aus stem:probier ending:t');
  assert.equal(guide('verlieren', 'hat verloren').prefix, 'inseparable');   // ver|lieren, not an -ieren verb
  assert.equal(guide('interviewen', 'hat interviewt').prefix, 'unstressed');

  const ski = guide('Ski fahren', 'ist Ski gefahren');
  assert.deepEqual([ski.prefix, ski.participle], ['phrase', 'Ski gefahren']);
  assert.equal(parts('spazieren gehen', 'ist spazieren gegangen'), 'prefix:spazieren  ge:ge stem:gang ending:en');
});

test('why haben or sein', () => {
  assert.equal(guide('kommen', 'ist gekommen').auxReason, 'motion');
  assert.equal(guide('bleiben', 'ist geblieben').auxReason, 'special');
  assert.equal(guide('passieren', 'ist passiert').auxReason, 'special');
  assert.equal(guide('machen', 'hat gemacht').auxReason, 'default');
  assert.equal(guide('sich freuen auf + Akk', 'hat sich gefreut').auxReason, 'reflexive');
  assert.equal(guide('stehen', 'hat gestanden | ist gestanden').auxReason, 'austria');
  assert.equal(guide('fahren', 'ist gefahren | hat gefahren').auxReason, 'both');
  assert.equal(guide('fahren', 'ist gefahren | hat gefahren').aux, 'sein');
});

test('prefixes that can go either way, the extra g of essen, alternative forms', () => {
  const uebersetzen = guide('übersetzen', 'hat übersetzt');
  assert.deepEqual([uebersetzen.prefix, uebersetzen.dualPrefix], ['inseparable', true]);
  const umziehen = guide('umziehen', 'ist umgezogen');
  assert.deepEqual([umziehen.prefix, umziehen.dualPrefix], ['separable', true]);
  assert.equal(guide('wiederholen', 'hat wiederholt').dualPrefix, true);
  assert.equal(guide('besuchen', 'hat besucht').dualPrefix, false);
  assert.equal(guide('anrufen', 'hat angerufen').dualPrefix, false);
  assert.equal(guide('essen', 'hat gegessen').extraG, true);
  assert.equal(guide('sehen', 'hat gesehen').extraG, false);
  assert.deepEqual(guide('senden', 'hat gesandt | hat gesendet').alternatives, ['gesendet']);
  assert.deepEqual(guide('stehen', 'hat gestanden | ist gestanden').alternatives, []);
});

test('no guide without a well-formed answer', () => {
  assert.equal(explainPerfekt('machen', []), null);
  assert.equal(explainPerfekt('machen', ['gemacht']), null);
});

test('every book verb gets a consistent guide', () => {
  assert.ok(verbs.length > 700);
  for (const r of verbs) {
    const g = explainPerfekt(r.Infinitiv || r.Wort, parseAccepted(r.Perfekt));
    assert.ok(g, `${r.Wort}: no guide`);
    const name = `${r.Wort} (${r.Perfekt})`;
    assert.equal(g.segments.map(s => s.text).join(''), g.participle, `${name}: segments`);
    assert.ok(g.segments.some(s => s.part === 'stem'), `${name}: no stem`);
    if (g.group === 'weak') assert.equal(g.stemChanged, false, `${name}: weak with changed stem`);
    if (g.group === 'mixed') assert.equal(g.stemChanged, true, `${name}: mixed without changed stem`);
    if (g.group === 'strong') assert.match(g.participle, /n$/, `${name}: strong without -n`);
    else assert.match(g.participle, /t$/, `${name}: weak/mixed without -t`);
    const hasGe = g.segments.some(s => s.part === 'ge');
    if (g.prefix === 'inseparable' || g.prefix === 'ieren' || g.prefix === 'unstressed') assert.equal(hasGe, false, `${name}: ge with ${g.prefix}`);
    if (g.prefix === 'none' || g.prefix === 'separable') assert.equal(hasGe, true, `${name}: no ge with ${g.prefix}`);
    assert.equal(g.aux, r.Perfekt.trim().startsWith('ist') ? 'sein' : 'haben', `${name}: aux`);
  }
});
