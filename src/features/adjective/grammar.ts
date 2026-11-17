/**
 * German adjective declension: the noun and adjective banks, the three ending tables (weak after a
 * definite article, mixed after an indefinite article, strong with no article) and generateRound /
 * declinePhrase, used by the adjective drill screen (DrillScreen.tsx) and ReferenceTables.tsx.
 *
 * Scope: Nominativ, Akkusativ, Dativ (the cases DaF kompakt A1-B1 drills; Genitiv is out of scope).
 * Written from the standard declension tables, not ported from any source file.
 */

export type GCase = 'nom' | 'akk' | 'dat';
export type Gender = 'm' | 'f' | 'n';
export type GNumber = 'sg' | 'pl';
export type ArticleType = 'definite' | 'indefinite' | 'none';

export const CASES: GCase[] = ['nom', 'akk', 'dat'];

export interface NounEntry {
  id: string;
  gender: Gender;
  singular: string;
  /** Nominative/accusative plural form. Omit for mass nouns that have no plural used in the drill. */
  plural?: string;
  /** n-Deklination (weak masculine) nouns: the Akkusativ/Dativ singular form, e.g. Herr -> Herrn. */
  weakSingular?: string;
  /** Mass/uncountable nouns that may appear with no article at all (kalter Kaffee, frische Milch). */
  noArticle?: boolean;
}

export const NOUNS: NounEntry[] = [
  // masculine
  { id: 'mann', gender: 'm', singular: 'Mann', plural: 'Männer' },
  { id: 'tisch', gender: 'm', singular: 'Tisch', plural: 'Tische' },
  { id: 'hund', gender: 'm', singular: 'Hund', plural: 'Hunde' },
  { id: 'lehrer', gender: 'm', singular: 'Lehrer', plural: 'Lehrer' },
  { id: 'park', gender: 'm', singular: 'Park', plural: 'Parks' },
  { id: 'herr', gender: 'm', singular: 'Herr', plural: 'Herren', weakSingular: 'Herrn' },
  { id: 'nachbar', gender: 'm', singular: 'Nachbar', plural: 'Nachbarn', weakSingular: 'Nachbarn' },
  { id: 'student', gender: 'm', singular: 'Student', plural: 'Studenten', weakSingular: 'Studenten' },
  { id: 'kaffee', gender: 'm', singular: 'Kaffee', noArticle: true },
  // feminine
  { id: 'frau', gender: 'f', singular: 'Frau', plural: 'Frauen' },
  { id: 'wohnung', gender: 'f', singular: 'Wohnung', plural: 'Wohnungen' },
  { id: 'stadt', gender: 'f', singular: 'Stadt', plural: 'Städte' },
  { id: 'tasche', gender: 'f', singular: 'Tasche', plural: 'Taschen' },
  { id: 'blume', gender: 'f', singular: 'Blume', plural: 'Blumen' },
  { id: 'milch', gender: 'f', singular: 'Milch', noArticle: true },
  // neuter
  { id: 'kind', gender: 'n', singular: 'Kind', plural: 'Kinder' },
  { id: 'auto', gender: 'n', singular: 'Auto', plural: 'Autos' },
  { id: 'fahrrad', gender: 'n', singular: 'Fahrrad', plural: 'Fahrräder' },
  { id: 'buch', gender: 'n', singular: 'Buch', plural: 'Bücher' },
  { id: 'haus', gender: 'n', singular: 'Haus', plural: 'Häuser' }
];

export const ADJECTIVES: string[] = [
  'alt', 'neu', 'groß', 'klein', 'jung', 'schön', 'gut', 'schlecht', 'lang', 'kurz',
  'schnell', 'langsam', 'billig', 'teuer', 'kalt', 'warm', 'frisch', 'laut', 'ruhig', 'nett'
];

/** Grammar terms, always German regardless of the interface language; wrap with <De> at the call site. */
export const GENDER_LABEL: Record<Gender | 'pl', string> = { m: 'Maskulin', f: 'Feminin', n: 'Neutral', pl: 'Plural' };
export const CASE_LABEL: Record<GCase, string> = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ' };
export const ARTICLE_TYPE_LABEL: Record<ArticleType, string> = {
  definite: 'bestimmter Artikel', indefinite: 'unbestimmter Artikel', none: 'kein Artikel'
};

/** The "Dativ · Maskulin · bestimmter Artikel" context line shown next to a mistake. */
export function roundContext(r: Pick<Round, 'case' | 'gender' | 'number' | 'articleType'>): string {
  const genderKey = r.number === 'pl' ? 'pl' : r.gender;
  return [CASE_LABEL[r.case], GENDER_LABEL[genderKey], ARTICLE_TYPE_LABEL[r.articleType]].join(' · ');
}

/** The full phrase as plain text ("der alte Mann"), skipping slots that aren't shown. */
export function phraseText(p: DeclinedPhrase): string {
  return [p.article?.full, p.adjective?.full, p.noun.full].filter((x): x is string => !!x).join(' ');
}

// ---------------------------------------------------------------------------
// Ending tables
// ---------------------------------------------------------------------------

export const DEFINITE_ARTICLE_ENDING: Record<GCase, Record<Gender | 'pl', string>> = {
  nom: { m: 'er', f: 'ie', n: 'as', pl: 'ie' },
  akk: { m: 'en', f: 'ie', n: 'as', pl: 'ie' },
  dat: { m: 'em', f: 'er', n: 'em', pl: 'en' }
};

// The indefinite article has no plural form.
export const INDEFINITE_ARTICLE_ENDING: Record<GCase, Record<Gender, string>> = {
  nom: { m: '', f: 'e', n: '' },
  akk: { m: 'en', f: 'e', n: '' },
  dat: { m: 'em', f: 'er', n: 'em' }
};

/** After a der-word (definite article): weak declension. */
export const WEAK_ADJECTIVE_ENDING: Record<GCase, Record<Gender | 'pl', string>> = {
  nom: { m: 'e', f: 'e', n: 'e', pl: 'en' },
  akk: { m: 'en', f: 'e', n: 'e', pl: 'en' },
  dat: { m: 'en', f: 'en', n: 'en', pl: 'en' }
};

/** After an ein-word (indefinite article): mixed declension. Singular only. */
export const MIXED_ADJECTIVE_ENDING: Record<GCase, Record<Gender, string>> = {
  nom: { m: 'er', f: 'e', n: 'es' },
  akk: { m: 'en', f: 'e', n: 'es' },
  dat: { m: 'en', f: 'en', n: 'en' }
};

/** No article at all: strong declension. */
export const STRONG_ADJECTIVE_ENDING: Record<GCase, Record<Gender | 'pl', string>> = {
  nom: { m: 'er', f: 'e', n: 'es', pl: 'e' },
  akk: { m: 'en', f: 'e', n: 'es', pl: 'e' },
  dat: { m: 'em', f: 'er', n: 'em', pl: 'en' }
};

/** The suffixes offered as multiple-choice options for each slot. */
export const ARTICLE_ENDING_OPTIONS: Record<ArticleType, string[]> = {
  definite: ['er', 'ie', 'as', 'en', 'em'],
  indefinite: ['', 'e', 'en', 'em', 'er'],
  none: []
};
export const ADJECTIVE_ENDING_OPTIONS = ['e', 'en', 'er', 'es', 'em'];
export const NOUN_ENDING_OPTIONS = ['', 'n', 'en'];

// ---------------------------------------------------------------------------
// Declension
// ---------------------------------------------------------------------------

export interface Slot {
  /** The part shown before the blank, e.g. "d", "ein", "kalt", "Kaffee". */
  prefix: string;
  /** The correct suffix (may be ''). */
  ending: string;
  /** prefix + ending. */
  full: string;
}

export interface DeclinedPhrase {
  article: Slot | null;
  adjective: Slot | null;
  noun: Slot;
}

function articleSlot(type: ArticleType, c: GCase, gender: Gender, num: GNumber): Slot | null {
  if (type === 'none') return null;
  if (type === 'indefinite') {
    const ending = INDEFINITE_ARTICLE_ENDING[c][gender];
    return { prefix: 'ein', ending, full: `ein${ending}` };
  }
  const key = num === 'pl' ? 'pl' : gender;
  const ending = DEFINITE_ARTICLE_ENDING[c][key];
  return { prefix: 'd', ending, full: `d${ending}` };
}

function adjectiveSlot(lemma: string, type: ArticleType, c: GCase, gender: Gender, num: GNumber): Slot {
  const key = num === 'pl' ? 'pl' : gender;
  const ending =
    type === 'definite' ? WEAK_ADJECTIVE_ENDING[c][key]
    : type === 'indefinite' ? MIXED_ADJECTIVE_ENDING[c][gender]
    : STRONG_ADJECTIVE_ENDING[c][key];
  return { prefix: lemma, ending, full: `${lemma}${ending}` };
}

/** Dative plural adds -n unless the plural already ends in -n or -s (Kindern, but Parks / Autos). */
export function datPluralSuffix(pluralForm: string): string {
  return /[ns]$/.test(pluralForm) ? '' : 'n';
}

function nounSlot(noun: NounEntry, c: GCase, num: GNumber): Slot {
  if (num === 'pl') {
    const base = noun.plural ?? noun.singular;
    const ending = c === 'dat' ? datPluralSuffix(base) : '';
    return { prefix: base, ending, full: `${base}${ending}` };
  }
  if (c !== 'nom' && noun.weakSingular) {
    const extra = noun.weakSingular.slice(noun.singular.length);
    return { prefix: noun.singular, ending: extra, full: noun.weakSingular };
  }
  return { prefix: noun.singular, ending: '', full: noun.singular };
}

export interface DeclineParams {
  noun: NounEntry;
  adjective: string | null;
  articleType: ArticleType;
  case: GCase;
  gender: Gender;
  number: GNumber;
}

export function declinePhrase(params: DeclineParams): DeclinedPhrase {
  const { noun, adjective, articleType, case: c, gender, number } = params;
  return {
    article: articleSlot(articleType, c, gender, number),
    adjective: adjective ? adjectiveSlot(adjective, articleType, c, gender, number) : null,
    noun: nounSlot(noun, c, number)
  };
}

// ---------------------------------------------------------------------------
// Round generation (for the drill screen)
// ---------------------------------------------------------------------------

export interface Round extends DeclineParams {
  id: string;
  phrase: DeclinedPhrase;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let roundCounter = 0;

/** A random, grammatically consistent round: article type and case fit the chosen noun and number. */
export function generateRound(): Round {
  const number: GNumber = Math.random() < 0.3 ? 'pl' : 'sg';
  const pool = number === 'pl' ? NOUNS.filter(n => n.plural) : NOUNS;
  const noun = pick(pool);
  const gender = noun.gender;
  const gcase = pick(CASES);

  const allowed: ArticleType[] = ['definite'];
  if (number === 'sg') allowed.push('indefinite');
  if (number === 'pl' || noun.noArticle) allowed.push('none');
  const articleType = pick(allowed);

  const adjective = Math.random() < 0.85 ? pick(ADJECTIVES) : null;

  const params: DeclineParams = { noun, adjective, articleType, case: gcase, gender, number };
  roundCounter += 1;
  return { ...params, id: `r${Date.now()}_${roundCounter}`, phrase: declinePhrase(params) };
}

// ---------------------------------------------------------------------------
// Self-test cases (asserted individually by tests/adjectiveGrammar.test.ts)
// ---------------------------------------------------------------------------

export interface SelfTestCase {
  name: string;
  params: DeclineParams;
  expected: { article?: string; adjective?: string; noun: string };
}

const byId = (id: string): NounEntry => {
  const n = NOUNS.find(x => x.id === id);
  if (!n) throw new Error(`unknown noun ${id}`);
  return n;
};

export const SELF_TEST_CASES: SelfTestCase[] = [
  {
    name: 'definite nominativ masculine: der alte Mann',
    params: { noun: byId('mann'), adjective: 'alt', articleType: 'definite', case: 'nom', gender: 'm', number: 'sg' },
    expected: { article: 'der', adjective: 'alte', noun: 'Mann' }
  },
  {
    name: 'definite akkusativ feminine: die junge Frau',
    params: { noun: byId('frau'), adjective: 'jung', articleType: 'definite', case: 'akk', gender: 'f', number: 'sg' },
    expected: { article: 'die', adjective: 'junge', noun: 'Frau' }
  },
  {
    name: 'definite dativ neuter: dem kleinen Kind',
    params: { noun: byId('kind'), adjective: 'klein', articleType: 'definite', case: 'dat', gender: 'n', number: 'sg' },
    expected: { article: 'dem', adjective: 'kleinen', noun: 'Kind' }
  },
  {
    name: 'indefinite akkusativ masculine: einen kleinen Hund',
    params: { noun: byId('hund'), adjective: 'klein', articleType: 'indefinite', case: 'akk', gender: 'm', number: 'sg' },
    expected: { article: 'einen', adjective: 'kleinen', noun: 'Hund' }
  },
  {
    name: 'indefinite nominativ neuter: ein neues Auto',
    params: { noun: byId('auto'), adjective: 'neu', articleType: 'indefinite', case: 'nom', gender: 'n', number: 'sg' },
    expected: { article: 'ein', adjective: 'neues', noun: 'Auto' }
  },
  {
    name: 'strong declension, uncountable masculine, dativ: kaltem Kaffee',
    params: { noun: byId('kaffee'), adjective: 'kalt', articleType: 'none', case: 'dat', gender: 'm', number: 'sg' },
    expected: { adjective: 'kaltem', noun: 'Kaffee' }
  },
  {
    name: 'strong declension, uncountable feminine, nominativ: frische Milch',
    params: { noun: byId('milch'), adjective: 'frisch', articleType: 'none', case: 'nom', gender: 'f', number: 'sg' },
    expected: { adjective: 'frische', noun: 'Milch' }
  },
  {
    name: 'dative plural, ending in a consonant: den kleinen Kindern',
    params: { noun: byId('kind'), adjective: 'klein', articleType: 'definite', case: 'dat', gender: 'n', number: 'pl' },
    expected: { article: 'den', adjective: 'kleinen', noun: 'Kindern' }
  },
  {
    name: 'dative plural, already ending in -s: den kleinen Parks',
    params: { noun: byId('park'), adjective: 'klein', articleType: 'definite', case: 'dat', gender: 'm', number: 'pl' },
    expected: { article: 'den', adjective: 'kleinen', noun: 'Parks' }
  },
  {
    name: 'dative plural, already ending in -s: den neuen Autos',
    params: { noun: byId('auto'), adjective: 'neu', articleType: 'definite', case: 'dat', gender: 'n', number: 'pl' },
    expected: { article: 'den', adjective: 'neuen', noun: 'Autos' }
  },
  {
    name: 'n-Deklination akkusativ: den alten Herrn',
    params: { noun: byId('herr'), adjective: 'alt', articleType: 'definite', case: 'akk', gender: 'm', number: 'sg' },
    expected: { article: 'den', adjective: 'alten', noun: 'Herrn' }
  },
  {
    name: 'n-Deklination dativ: dem netten Nachbarn',
    params: { noun: byId('nachbar'), adjective: 'nett', articleType: 'definite', case: 'dat', gender: 'm', number: 'sg' },
    expected: { article: 'dem', adjective: 'netten', noun: 'Nachbarn' }
  },
  {
    name: 'n-Deklination akkusativ: den jungen Studenten',
    params: { noun: byId('student'), adjective: 'jung', articleType: 'definite', case: 'akk', gender: 'm', number: 'sg' },
    expected: { article: 'den', adjective: 'jungen', noun: 'Studenten' }
  },
  {
    name: 'no adjective, definite nominativ feminine: die Stadt',
    params: { noun: byId('stadt'), adjective: null, articleType: 'definite', case: 'nom', gender: 'f', number: 'sg' },
    expected: { article: 'die', noun: 'Stadt' }
  },
  {
    name: 'no adjective, indefinite dativ masculine: einem Lehrer',
    params: { noun: byId('lehrer'), adjective: null, articleType: 'indefinite', case: 'dat', gender: 'm', number: 'sg' },
    expected: { article: 'einem', noun: 'Lehrer' }
  }
];

/** Runs every SELF_TEST_CASES case; throws with the first mismatch. Used by the unit tests. */
export function runDeclensionSelfTest(): void {
  for (const tc of SELF_TEST_CASES) {
    const phrase = declinePhrase(tc.params);
    if ((tc.expected.article ?? null) !== (phrase.article?.full ?? null)) {
      throw new Error(`${tc.name}: expected article "${tc.expected.article}", got "${phrase.article?.full}"`);
    }
    if ((tc.expected.adjective ?? null) !== (phrase.adjective?.full ?? null)) {
      throw new Error(`${tc.name}: expected adjective "${tc.expected.adjective}", got "${phrase.adjective?.full}"`);
    }
    if (tc.expected.noun !== phrase.noun.full) {
      throw new Error(`${tc.name}: expected noun "${tc.expected.noun}", got "${phrase.noun.full}"`);
    }
  }
}
