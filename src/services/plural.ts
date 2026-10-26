/**
 * Dictionary-style plural patterns for nouns: "der Name, -n", "die Stadt, ¨-e", "das Zimmer, –".
 * Pure functions, no imports, unit-tested in tests/plural.test.ts.
 */

export type PluralLabel = 'singularOnly' | 'singularOnlyHere' | 'pluralOnly' | 'mostlySingular' | 'pluralRare';

export interface PluralPart {
  /** Full plural form as given in the data, e.g. "die Städte" */
  form?: string;
  /** Pattern relative to the singular, e.g. "¨-e"; missing when the plural is irregular */
  pattern?: string;
  /** A note instead of a form, e.g. singular only */
  label?: PluralLabel;
}

const LABELS: [RegExp, PluralLabel][] = [
  [/^\(hier nur sg\.?\)$/i, 'singularOnlyHere'],
  // "(nur Sg.)", or naming the noun it applies to: "(Zustimmung nur Sg.)"
  [/^\((?:[^\s()]+ )?nur sg\.?\)$/i, 'singularOnly'],
  [/^\((hier )?kein sg\.?\)$|^\(nur pl\.?\)$/i, 'pluralOnly'],
  [/^\(meist sg\.?\)$/i, 'mostlySingular'],
  [/^\(pl\.? selten\)$|^\(kein pl\.?\)$/i, 'pluralRare']
];

const ARTICLE = /^(der|die|das)(\s*\/\s*(der|die|das))?\s+/i;

const clean = (s: string) => s.replace(/\([^)]*\)/g, '').replace(ARTICLE, '').trim();

const UMLAUT: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };

/** The singular with its stem vowel umlauted: the last a/o/u, with "au" becoming "äu". */
function umlauted(word: string): string | null {
  for (let i = word.length - 1; i >= 0; i--) {
    const c = word[i];
    if (!(c in UMLAUT)) continue;
    // "Saal" → "Säle": a doubled vowel becomes a single umlaut
    if ((c === 'a' || c === 'o') && i > 0 && word[i - 1] === c) {
      return word.slice(0, i - 1) + UMLAUT[c] + word.slice(i + 1);
    }
    if ((c === 'u' || c === 'U') && i > 0 && (word[i - 1] === 'a' || word[i - 1] === 'A')) {
      return word.slice(0, i - 1) + UMLAUT[word[i - 1]] + word.slice(i);
    }
    return word.slice(0, i) + UMLAUT[c] + word.slice(i + 1);
  }
  return null;
}

/** "Name" + "Namen" → "-n"; "Stadt" + "Städte" → "¨-e"; null when irregular ("Museum" → "Museen"). */
export function patternOf(singular: string, plural: string): string | null {
  const sg = clean(singular);
  const pl = clean(plural);
  if (!sg || !pl || /\s/.test(sg) || /\s/.test(pl)) return null;
  if (pl === sg) return '–';
  if (pl.startsWith(sg)) return '-' + pl.slice(sg.length);
  const um = umlauted(sg);
  if (um) {
    if (pl === um) return '¨';
    if (pl.startsWith(um)) return '¨-' + pl.slice(um.length);
  }
  return null;
}

/** Split on " / " and " · " outside parentheses ("die Krägen (Südd. / A / CH)" stays one part). */
function splitParts(s: string): string[] {
  const shielded = s.replace(/\([^)]*\)/g, m => m.replace(/\//g, '\u0000').replace(/·/g, '\u0001'));
  return shielded
    .split(/\s+[\/·]\s+/)
    .map(p => p.replace(/\u0000/g, '/').replace(/\u0001/g, '·').trim())
    .filter(Boolean);
}

function labelOf(part: string): PluralLabel | null {
  const p = part.trim();
  for (const [re, label] of LABELS) if (re.test(p)) return label;
  return null;
}

/**
 * Describe a noun's plural for display. `wort` is the card's German word(s) ("der Partner / die Partnerin"),
 * `plural` the CSV value ("die Partner / die Partnerinnen", "(nur Sg.)", "-n").
 */
export function describePlural(wort: string | undefined, plural: string | undefined): PluralPart[] {
  const pl = (plural || '').trim();
  const w = (wort || '')
    .trim()
    // "ankommen → die Ankunft": the noun is after the arrow
    .replace(/^.*→\s*/, '')
    // "der / die Verwandte" is one noun with two articles, not two nouns
    .replace(/\b(der|die|das)\s*\/\s*(?=(?:der|die|das)\s)/gi, '');
  if (!pl) return /\(pl\.?\)/i.test(w) ? [{ label: 'pluralOnly' }] : [];

  const singulars = w.split(/\s+(?:\/|·|≠)\s+(?=(?:der|die|das)\s)/i);
  const plurals = splitParts(pl);

  return plurals.map((part, i): PluralPart => {
    const label = labelOf(part);
    if (label) return { label };
    if (/^[-–¨]/.test(part.trim())) return { pattern: part.trim() };
    const sg = singulars.length === plurals.length ? singulars[i] : singulars[0];
    const pattern = sg ? patternOf(sg, part) : null;
    return pattern ? { form: part.trim(), pattern } : { form: part.trim() };
  });
}
