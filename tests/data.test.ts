import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPerfekt, parseAccepted } from '../src/services/perfekt.ts';
import { describePlural } from '../src/services/plural.ts';
import { conjugate } from '../src/services/conjugation.ts';

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

const rows = readCsv(new URL('../public/data/wortschatz-daf-kompakt.csv', import.meta.url).pathname);
const verbs = rows.filter(r => r.Wortart === 'Verb');
const nouns = rows.filter(r => r.Wortart === 'Nomen');

// Verbs deliberately without a Perfekt quiz
const NO_PERFEKT = new Set(['geboren sein']);

test('card ids (Lektion + Nr) are unique', () => {
  const ids = rows.map(r => `${r.Lektion}/${r.Nr}`);
  assert.equal(new Set(ids).size, ids.length);
});

test('every verb card has exactly one verb and a Perfekt', () => {
  for (const v of verbs) {
    if (NO_PERFEKT.has(v.Wort)) continue;
    assert.ok(v.Perfekt, `no Perfekt for ${v.Wort}`);
    assert.doesNotMatch(v.Wort.replace(/\([^)]*\)/g, ''), /\s(·|≠|↔)\s/, `several verbs in ${v.Wort}`);
  }
});

test('each accepted Perfekt answer is graded correct against itself', () => {
  for (const v of verbs) {
    const accepted = parseAccepted(v.Perfekt);
    for (const a of accepted) {
      const r = checkPerfekt(a, accepted);
      assert.equal(r.verdict, 'correct', `${v.Wort}: "${a}" → ${r.verdict}`);
      assert.equal(r.missingSich, false, `${v.Wort}: "${a}" flagged missing sich`);
      assert.match(a, /^(hat|ist) /, `${v.Wort}: "${a}" has no auxiliary`);
    }
  }
});

test('plural description for every noun', () => {
  let patterned = 0, labelled = 0, formOnly = 0, empty = 0;
  for (const n of nouns) {
    const parts = describePlural(n.Wort, n.Plural);
    if (!parts.length) { empty++; continue; }
    for (const p of parts) {
      assert.ok(p.form || p.pattern || p.label, `empty part for ${n.Wort}`);
      if (p.pattern) {
        patterned++;
        assert.match(p.pattern, /^(–|¨|¨?-[a-zäöüß]+)$/, `odd pattern ${p.pattern} for ${n.Wort} / ${n.Plural}`);
      } else if (p.label) labelled++;
      else formOnly++;
    }
  }
  console.log(`nouns: ${nouns.length} · patterned parts: ${patterned} · labels: ${labelled} · irregular (form only): ${formOnly} · no plural info: ${empty}`);
});

test('conjugation of every verb agrees with the word list', () => {
  const problems: string[] = [];
  for (const v of verbs) {
    if (!v.Perfekt) continue;
    const c = conjugate({ infinitiv: v.Infinitiv, praesens: v['Präsens'], praeteritum: v['Präteritum'], perfekt: v.Perfekt, reflexiv: v.Reflexiv });
    if (!c) { problems.push(`${v.Wort}: no conjugation`); continue; }
    const noRefl = (t: string) => t.replace(/\(?\b(mich|dich|sich|uns|euch|mir|dir)\b\)?\s*/g, '').trim();
    const er = noRefl(c.praesens[2].text);
    if (er !== v['Präsens']) problems.push(`${v.Wort}: Präsens ${er} ≠ ${v['Präsens']}`);
    if (v['Präteritum'] && noRefl(c.praeteritum[2].text) !== v['Präteritum']) {
      problems.push(`${v.Wort}: Präteritum ${c.praeteritum[2].text} ≠ ${v['Präteritum']}`);
    }
    // Without an explicit Präteritum the verb must really be regular (otherwise the table would invent "fahrte")
    if (!v['Präteritum'] && c.perfekt.some(f => f.segments.some(s => s.irregular))) {
      problems.push(`${v.Wort}: irregular participle but no Präteritum (${v.Perfekt})`);
    }
    if (c.praesens.some(f => /\s{2}|^\s|\s$/.test(f.text))) problems.push(`${v.Wort}: spacing`);
  }
  assert.deepEqual(problems, []);
});
