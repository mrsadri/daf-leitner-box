/**
 * Strict comparison of the typed sentence with the expected one (docs/dictation/06-answer-checking.md).
 * Pure and synchronous (under a millisecond for 33 words). The result describes WHERE and WHAT KIND of mistake there is,
 * and never contains the correct letters or words: the learner has to find them.
 */
import { foldToken, normalizeText, tokenize, type Token } from './normalize.ts';

export type Category =
  | 'case' | 'umlaut-substitution' | 'eszett-substitution' | 'punctuation' | 'spacing'
  | 'typo-missing-letter' | 'typo-extra-letter' | 'typo-wrong-letter' | 'typo-swapped-letters'
  | 'wrong-word' | 'missing-word' | 'extra-word' | 'order';

export const CATEGORIES: Category[] = [
  'case', 'umlaut-substitution', 'eszett-substitution', 'punctuation', 'spacing',
  'typo-missing-letter', 'typo-extra-letter', 'typo-wrong-letter', 'typo-swapped-letters',
  'wrong-word', 'missing-word', 'extra-word', 'order',
];

export interface CharMark { kind: 'wrong' | 'extra' | 'missing'; at: number }   // at: offset in the typed text

export interface Mark {
  category: Category;
  /** Range in `typed` (the normalized typed text); null when something is missing and there is nothing to underline. */
  typed: { start: number; end: number } | null;
  /** Offset in `typed` where something is missing (missing word, missing punctuation, missing space). */
  gapAfter?: number;
  /** Index into the expected token list, for the word link to the Leitner box. */
  expectedTokenIndex: number | null;
  chars?: CharMark[];
}

export interface CheckResult {
  correct: boolean;
  typed: string;                       // the normalized typed text all offsets refer to
  marks: Mark[];                       // empty when correct
  summary: { total: number; byCategory: Record<Category, number> };
}

// ---------- character level -------------------------------------------------------------------------------------

interface CharOps { distance: number; ops: { kind: 'wrong' | 'extra' | 'missing' | 'swap'; at: number }[] }

/** Optimal string alignment (Damerau-Levenshtein with adjacent transpositions) on code points, with traceback. */
export function charDiff(typedStr: string, expectedStr: string): CharOps {
  const a = Array.from(typedStr);
  const b = Array.from(expectedStr);
  const n = a.length, m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  // offsets are in UTF-16 units of the typed string
  const unitOffset: number[] = [0];
  for (const ch of a) unitOffset.push(unitOffset[unitOffset.length - 1] + ch.length);
  const ops: CharOps['ops'] = [];
  let i = n, j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && d[i][j] === d[i - 1][j - 1]) { i--; j--; continue; }
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] && d[i][j] === d[i - 2][j - 2] + 1) {
      ops.push({ kind: 'swap', at: unitOffset[i - 2] }); i -= 2; j -= 2; continue;
    }
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + 1) { ops.push({ kind: 'wrong', at: unitOffset[i - 1] }); i--; j--; continue; }
    if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ kind: 'extra', at: unitOffset[i - 1] }); i--; continue; }
    ops.push({ kind: 'missing', at: unitOffset[i] }); j--;
  }
  ops.reverse();
  return { distance: d[n][m], ops };
}

const lower = (s: string) => s.replace(/ẞ/g, '\u0001').toLowerCase();   // ẞ is never a case variant of ß (edge case K9)

/** Typed word equals the expected word when ae/oe/ue (ss) stand in for ä/ö/ü (ß). Returns which one, or null. */
function substitutionKind(typedWord: string, expectedWord: string): 'umlaut' | 'eszett' | 'both' | null {
  if (typedWord === expectedWord || !/[äöüÄÖÜß]/.test(expectedWord)) return null;
  let umlaut = false, eszett = false;
  let pattern = '';
  for (const ch of expectedWord) {
    if (ch === 'ä') pattern += '(?:ä|(ae))';
    else if (ch === 'ö') pattern += '(?:ö|(oe))';
    else if (ch === 'ü') pattern += '(?:ü|(ue))';
    else if (ch === 'Ä') pattern += '(?:Ä|(Ae))';
    else if (ch === 'Ö') pattern += '(?:Ö|(Oe))';
    else if (ch === 'Ü') pattern += '(?:Ü|(Ue))';
    else if (ch === 'ß') pattern += '(?:ß|(ss))';
    else pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  const m = new RegExp(`^${pattern}$`, 'u').exec(typedWord);
  if (!m) return null;
  // groups after the first: which substitutions were used (the order follows the pattern)
  const groups = m.slice(1).filter(g => g !== undefined);
  for (const g of groups) { if (g === 'ss') eszett = true; else umlaut = true; }
  if (!umlaut && !eszett) return null;
  return umlaut && eszett ? 'both' : umlaut ? 'umlaut' : 'eszett';
}

// ---------- token alignment -------------------------------------------------------------------------------------

const GAP_WORD = 1, GAP_PUNCT = 0.95, SWAP = 0.8;

function substitutionCost(t: Token, e: Token): number {
  const ft = foldToken(t.text), fe = foldToken(e.text);
  if (ft === fe) return 0;
  if (t.kind !== e.kind) return 2;                           // word versus punctuation: never paired
  if (t.kind === 'punct') return 0.6;
  const len = Math.max(Array.from(ft).length, Array.from(fe).length);
  const ratio = charDiff(ft, fe).distance / len;
  return 0.4 + 0.6 * ratio;
}

type Step = { kind: 'pair'; i: number; j: number } | { kind: 'swap'; i: number; j: number } | { kind: 'extra'; i: number } | { kind: 'missing'; j: number };

function align(typed: Token[], expected: Token[]): Step[] {
  const n = typed.length, m = expected.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  const gapT = (i: number) => (typed[i].kind === 'word' ? GAP_WORD : GAP_PUNCT);
  const gapE = (j: number) => (expected[j].kind === 'word' ? GAP_WORD : GAP_PUNCT);
  for (let i = 1; i <= n; i++) cost[i][0] = cost[i - 1][0] + gapT(i - 1);
  for (let j = 1; j <= m; j++) cost[0][j] = cost[0][j - 1] + gapE(j - 1);
  const isSwap = (i: number, j: number) =>
    i >= 2 && j >= 2 &&
    typed[i - 1].kind === 'word' && typed[i - 2].kind === 'word' &&
    foldToken(typed[i - 1].text) === foldToken(expected[j - 2].text) &&
    foldToken(typed[i - 2].text) === foldToken(expected[j - 1].text) &&
    foldToken(typed[i - 1].text) !== foldToken(typed[i - 2].text);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = cost[i - 1][j - 1] + substitutionCost(typed[i - 1], expected[j - 1]);
      best = Math.min(best, cost[i - 1][j] + gapT(i - 1), cost[i][j - 1] + gapE(j - 1));
      if (isSwap(i, j)) best = Math.min(best, cost[i - 2][j - 2] + SWAP);
      cost[i][j] = best;
    }
  }
  const steps: Step[] = [];
  let i = n, j = m;
  const eq = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  while (i > 0 || j > 0) {
    // prefer pairing (matching words before punctuation), then a swap, then gaps
    if (i > 0 && j > 0 && eq(cost[i][j], cost[i - 1][j - 1] + substitutionCost(typed[i - 1], expected[j - 1]))) {
      steps.push({ kind: 'pair', i: i - 1, j: j - 1 }); i--; j--; continue;
    }
    if (isSwap(i, j) && eq(cost[i][j], cost[i - 2][j - 2] + SWAP)) {
      steps.push({ kind: 'swap', i: i - 2, j: j - 2 }); i -= 2; j -= 2; continue;
    }
    if (i > 0 && eq(cost[i][j], cost[i - 1][j] + gapT(i - 1))) { steps.push({ kind: 'extra', i: i - 1 }); i--; continue; }
    steps.push({ kind: 'missing', j: j - 1 }); j--;
  }
  return steps.reverse();
}

// ---------- the check -------------------------------------------------------------------------------------------

function emptySummary(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Record<Category, number>;
}

function classifyWordPair(t: Token, e: Token): { category: Category; chars?: CharMark[] } {
  const typedWord = t.text, expectedWord = e.text;
  if (lower(typedWord) === lower(expectedWord)) return { category: 'case' };
  const sub = substitutionKind(typedWord, expectedWord);
  if (sub === 'eszett') return { category: 'eszett-substitution' };
  if (sub) return { category: 'umlaut-substitution' };
  const ft = foldToken(typedWord), fe = foldToken(expectedWord);
  const diff = charDiff(ft, fe);
  const ratio = diff.distance / Math.max(Array.from(ft).length, Array.from(fe).length);
  const chars: CharMark[] = [];
  let swapped = 0, wrong = 0, extra = 0, missing = 0;
  for (const op of diff.ops) {
    if (op.kind === 'swap') { swapped++; chars.push({ kind: 'wrong', at: t.start + op.at }, { kind: 'wrong', at: t.start + op.at + 1 }); }
    else {
      if (op.kind === 'wrong') wrong++; else if (op.kind === 'extra') extra++; else missing++;
      chars.push({ kind: op.kind, at: t.start + op.at });
    }
  }
  if (ratio > 0.5) return { category: 'wrong-word' };
  const counts: [Category, number][] = [
    ['typo-wrong-letter', wrong], ['typo-missing-letter', missing], ['typo-extra-letter', extra], ['typo-swapped-letters', swapped],
  ];
  counts.sort((x, y) => y[1] - x[1]);
  return { category: counts[0][0], chars };
}

export function compare(typedRaw: string, expectedRaw: string): CheckResult {
  const typed = tokenize(typedRaw);
  const expected = tokenize(expectedRaw);
  const typedText = typed.length ? typedRaw.normalize('NFC').replace(/[   ​]/g, ' ').replace(/[\r\n\t]+/g, ' ') : '';
  const marks: Mark[] = [];
  const steps = align(typed, expected);
  // offset in the typed text where the next missing item belongs
  let cursor = 0;

  for (const step of steps) {
    if (step.kind === 'pair') {
      const t = typed[step.i], e = expected[step.j];
      cursor = t.end;
      const exact = foldToken(t.text) === foldToken(e.text);
      if (exact) {
        if (step.i > 0 && step.j > 0 && t.spaceBefore !== e.spaceBefore) {
          marks.push({
            category: 'spacing', expectedTokenIndex: step.j,
            typed: t.spaceBefore ? { start: typed[step.i - 1].end, end: t.start } : { start: t.start, end: t.end },
          });
        }
      } else if (t.kind === 'punct') {
        marks.push({ category: 'punctuation', typed: { start: t.start, end: t.end }, expectedTokenIndex: step.j });
      } else {
        const c = classifyWordPair(t, e);
        marks.push({ category: c.category, typed: { start: t.start, end: t.end }, expectedTokenIndex: step.j, ...(c.chars ? { chars: c.chars } : {}) });
      }
    } else if (step.kind === 'swap') {
      for (const k of [0, 1]) {
        const t = typed[step.i + k];
        marks.push({ category: 'order', typed: { start: t.start, end: t.end }, expectedTokenIndex: step.j + (1 - k) });
      }
      cursor = typed[step.i + 1].end;
    } else if (step.kind === 'extra') {
      const t = typed[step.i];
      cursor = t.end;
      marks.push({ category: t.kind === 'punct' ? 'punctuation' : 'extra-word', typed: { start: t.start, end: t.end }, expectedTokenIndex: null });
    } else {
      const e = expected[step.j];
      marks.push({ category: e.kind === 'punct' ? 'punctuation' : 'missing-word', typed: null, gapAfter: cursor, expectedTokenIndex: step.j });
    }
  }

  const summary = { total: marks.length, byCategory: emptySummary() };
  for (const m of marks) summary.byCategory[m.category]++;
  return { correct: marks.length === 0, typed: typedText, marks, summary };
}
