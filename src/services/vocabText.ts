import type { LeitnerCard } from '../types/leitner';
import type { Lang } from '../i18n/format';
import { leitnerEngine } from './leitnerEngine';
import { splitExample, hasPersian } from '../components/ui/Text';
import { parseAccepted, perfektFromFormen } from './perfekt';
import { describePlural, PluralPart } from './plural';
import { conjugate, Conjugation } from './conjugation';

export interface VocabText {
  /** Meaning in the interface language (falls back to Persian when no English is available) */
  meaning: string;
  /** German example sentence(s) */
  exampleDe: string;
  /** Translation of the example in the interface language ('' when there is none) */
  exampleTranslation: string;
  /** Grammar notes; may mix German and the interface language */
  formen: string;
  /** Austrian usage note */
  oesterreich: string;
}

/**
 * The learner-facing texts of a vocab card for the given interface language.
 * Book words read the current CSV entry, so fixes to translations reach existing cards too.
 */
export function vocabText(card: LeitnerCard, lang: Lang): VocabText {
  const src = leitnerEngine.getCatalogWord(card.id) ?? card;
  const { german, translation } = splitExample(src.beispiel || card.beispiel);
  if (lang === 'fa') {
    return {
      meaning: src.persisch || card.persisch || src.englisch || card.englisch || '',
      exampleDe: german,
      exampleTranslation: translation,
      formen: src.formen || card.formen || '',
      oesterreich: src.oesterreich || card.oesterreich || ''
    };
  }
  const formen = src.formen || card.formen || '';
  const oesterreich = src.oesterreich || card.oesterreich || '';
  return {
    meaning: src.englisch || card.englisch || src.persisch || card.persisch || '',
    exampleDe: german,
    exampleTranslation: src.beispielEn || card.beispielEn || '',
    formen: src.formenEn || card.formenEn || formen,
    // Without an English version, hide a Persian note but keep a German-only one
    oesterreich: src.oesterreichEn || card.oesterreichEn || (hasPersian(oesterreich) ? '' : oesterreich)
  };
}


/**
 * Accepted Perfekt answers for a verb card, or [] when the card gets no Perfekt quiz
 * (not a verb, a book verb without Perfekt data, or a custom card whose Formen can't be read).
 */
export function perfektAnswers(card: LeitnerCard): string[] {
  if (card.type !== 'vocab') return [];
  const src = leitnerEngine.getCatalogWord(card.id) ?? card;
  if (src.wortart !== 'Verb') return [];
  // Only well-formed answers ("hat …" / "ist …"); a custom card with just a participle gets no quiz
  if (src.perfekt) return parseAccepted(src.perfekt).filter(a => /^(hat|ist)\s+\S/i.test(a));
  // Book verbs without a Perfekt (e.g. "geboren sein") deliberately have no quiz
  if (leitnerEngine.getCatalogWord(card.id)) return [];
  return perfektFromFormen(card.formen);
}

/** Plural form(s), pattern and labels of a noun card. */
export function pluralParts(card: LeitnerCard): PluralPart[] {
  const src = leitnerEngine.getCatalogWord(card.id) ?? card;
  return describePlural(src.wort || card.wort, src.plural || card.plural);
}

/** Conjugation table of a book verb, or null (not a verb, no data, or a custom card). */
export function conjugationOf(card: LeitnerCard): Conjugation | null {
  if (card.type !== 'vocab') return null;
  const src = leitnerEngine.getCatalogWord(card.id) ?? card;
  if (src.wortart !== 'Verb' || !src.perfekt || !src.praesens || !src.infinitiv) return null;
  return conjugate({
    infinitiv: src.infinitiv,
    praesens: src.praesens,
    praeteritum: src.praeteritum,
    perfekt: src.perfekt,
    reflexiv: src.reflexiv
  });
}
