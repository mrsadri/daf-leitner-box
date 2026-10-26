import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkPerfekt, parseAccepted } from '../src/services/perfekt.ts';
import { describePlural } from '../src/services/plural.ts';

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
