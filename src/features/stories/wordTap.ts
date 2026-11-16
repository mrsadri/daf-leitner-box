/**
 * What a tap on a story word means. Pure; unit-tested in tests/storiesWordTap.test.ts.
 *   card  the word is in the word list: show it, then add it to the box, or move it back one box if it's owned
 *   new   a word that isn't in the list: offer "add as a new card"
 *   none  names and numbers: nothing to do
 */
import type { WordSegment } from './types';

export type WordTarget =
  | { kind: 'card'; cardId: string; owned: boolean; word: string }
  | { kind: 'new'; word: string }
  | { kind: 'none' };

/** The candidate the learner owns, else the first (the build orders candidates by lesson). */
export function pickCard(candidates: readonly string[], owned: ReadonlySet<string>): { cardId: string; owned: boolean } | null {
  if (candidates.length === 0) return null;
  const mine = candidates.find(id => owned.has(id));
  return mine ? { cardId: mine, owned: true } : { cardId: candidates[0], owned: false };
}

export function resolveTap(word: WordSegment | string, owned: ReadonlySet<string>, names: ReadonlySet<string>): WordTarget {
  const text = typeof word === 'string' ? word : word.t;
  const candidates = typeof word === 'string' ? [] : word.c ?? [];
  const pick = pickCard(candidates, owned);
  if (pick) return { kind: 'card', word: text, ...pick };
  if (!/\p{L}/u.test(text) || /\d/.test(text) || names.has(text) || names.has(text.replace(/s$/, ''))) return { kind: 'none' };
  return { kind: 'new', word: text };
}

/** Splits plain text into words and the text between them, so every word can be tapped. */
export function splitWords(text: string): { word: boolean; text: string }[] {
  const out: { word: boolean; text: string }[] = [];
  const re = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ word: false, text: text.slice(last, m.index) });
    out.push({ word: true, text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ word: false, text: text.slice(last) });
  return out;
}
