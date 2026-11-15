/**
 * From a tapped mark to a Leitner card (docs/dictation/07-leitner-integration.md, "Which word does a tap mean").
 * Pure. The links were resolved at build time; at runtime the only decision is which candidate card the learner owns.
 */
import type { SentenceLink } from '../../types/dictation.ts';
import type { Category, Mark } from './compare.ts';
import { tokenize } from './normalize.ts';

/** Word-level mistakes the learner can act on. Punctuation, spacing and extra words teach nothing about a card. */
const TAPPABLE: ReadonlySet<Category> = new Set<Category>([
  'case', 'umlaut-substitution', 'eszett-substitution',
  'typo-missing-letter', 'typo-extra-letter', 'typo-wrong-letter', 'typo-swapped-letters',
  'wrong-word', 'missing-word', 'order',
]);

export function isTappableCategory(category: Category): boolean {
  return TAPPABLE.has(category);
}

export type WordTarget =
  | { kind: 'card'; link: SentenceLink; cardId: string; owned: boolean; candidates: string[] }
  | { kind: 'new'; word: string }          // no catalog link: offer "Add as a new card"
  | { kind: 'none' };                      // not tappable (punctuation, a name, ...)

/** The link whose range covers the expected token, if any. */
export function linkForToken(expectedText: string, tokenIndex: number, links: readonly SentenceLink[]): SentenceLink | null {
  const token = tokenize(expectedText)[tokenIndex];
  if (!token) return null;
  return links.find(l => token.start >= l.s && token.end <= l.e) ?? null;
}

/** The card the learner owns first, otherwise the first candidate (the builder orders them: lowest lesson not above the story's). */
export function pickCard(candidates: readonly string[], ownedIds: ReadonlySet<string>): { cardId: string; owned: boolean } | null {
  if (candidates.length === 0) return null;
  const owned = candidates.find(id => ownedIds.has(id));
  return owned ? { cardId: owned, owned: true } : { cardId: candidates[0], owned: false };
}

export function resolveTap(
  mark: Pick<Mark, 'category' | 'expectedTokenIndex'>,
  sentence: { text: string; links: readonly SentenceLink[] },
  ownedIds: ReadonlySet<string>,
  names: ReadonlySet<string> = new Set(),
): WordTarget {
  if (!isTappableCategory(mark.category) || mark.expectedTokenIndex === null) return { kind: 'none' };
  const token = tokenize(sentence.text)[mark.expectedTokenIndex];
  if (!token || token.kind !== 'word') return { kind: 'none' };
  if (names.has(token.text) || /^\d/.test(token.text)) return { kind: 'none' };      // proper names and numbers are not vocabulary
  const link = linkForToken(sentence.text, mark.expectedTokenIndex, sentence.links);
  if (!link) return { kind: 'new', word: token.text };
  const pick = pickCard(link.cards, ownedIds);
  if (!pick) return { kind: 'new', word: token.text };
  return { kind: 'card', link, ...pick, candidates: [...link.cards] };
}
