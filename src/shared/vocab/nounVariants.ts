/** Alternate forms share a card ID and progress, but retain their own grammar. */
export interface NounVariant {
  word: string;
  article: 'der' | 'die' | 'das' | null;
  gender: 'm' | 'f' | 'n' | null;
  plural: string | null;
}
const genders = { der: 'm', die: 'f', das: 'n' } as const;
const strip = (s: string) => s.replace(/^(der|die|das)\s+/i, '').trim();
export function nounVariants(card: { wort?: string; artikel?: string; plural?: string }): NounVariant[] {
  const ambiguous = (card.wort ?? '').match(/^(?:der|die|das)\/(?:der|die|das)\s+(.+)$/i);
  if (ambiguous) return [{ word: ambiguous[1], article: null, gender: null, plural: card.plural ? strip(card.plural) : null }];
  const words = (card.wort ?? '').split(/\s*\/\s*/).filter(Boolean);
  const plurals = (card.plural ?? '').split(/\s*\/\s*/).map(strip).filter(p => p && p !== '–');
  return words.map((form, i) => {
    const explicit = form.match(/^(der|die|das)\s+/i)?.[1].toLowerCase();
    const candidate = explicit ?? (i === 0 ? card.artikel : undefined);
    const article = candidate === 'der' || candidate === 'die' || candidate === 'das' ? candidate : null;
    return { word: strip(form), article, gender: article ? genders[article] : null,
      plural: plurals.length === words.length ? plurals[i] : null };
  });
}
export function matchingNounVariant(variants: NounVariant[], token: string): NounVariant | null {
  const key = token.toLocaleLowerCase('de');
  const matches = variants.filter(v => [v.word, v.plural].some(form => form?.toLocaleLowerCase('de') === key));
  return matches.length === 1 ? matches[0] : null;
}
