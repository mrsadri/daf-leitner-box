/**
 * German adjective declension: the noun and adjective banks, the three ending tables (weak after a
 * definite article, mixed after an indefinite article, strong with no article) and generateRound /
 * declinePhrase, used by the adjective drill screen (DrillScreen.tsx) and ReferenceTables.tsx.
 *
 * Scope: Nominativ, Akkusativ, Dativ (the cases DaF kompakt A1-B1 drills; Genitiv is out of scope).
 * Ported from the owner's AI Studio prototype (adjektivdeklination-training/src/grammar.ts): the same noun and
 * adjective banks (adjectives with an invariant stem only: no hoch, dunkel, teuer), the same article types
 * (definite, indefinite, negative «kein», none) and the same round rules; its self-test is SELF_TEST_CASES below.
 */

export type GCase = 'nom' | 'akk' | 'dat';
export type Gender = 'm' | 'f' | 'n';
export type GNumber = 'sg' | 'pl';
export type ArticleType = 'definite' | 'indefinite' | 'negative' | 'none';

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
  // regular nouns
  { id: 'dialekt', gender: 'm', singular: 'Dialekt', plural: 'Dialekte' },
  { id: 'tisch', gender: 'm', singular: 'Tisch', plural: 'Tische' },
  { id: 'stuhl', gender: 'm', singular: 'Stuhl', plural: 'Stühle' },
  { id: 'baum', gender: 'm', singular: 'Baum', plural: 'Bäume' },
  { id: 'apfel', gender: 'm', singular: 'Apfel', plural: 'Äpfel' },
  { id: 'freund', gender: 'm', singular: 'Freund', plural: 'Freunde' },
  { id: 'lehrer', gender: 'm', singular: 'Lehrer', plural: 'Lehrer' },
  { id: 'arzt', gender: 'm', singular: 'Arzt', plural: 'Ärzte' },
  { id: 'mann', gender: 'm', singular: 'Mann', plural: 'Männer' },
  { id: 'hund', gender: 'm', singular: 'Hund', plural: 'Hunde' },
  { id: 'brief', gender: 'm', singular: 'Brief', plural: 'Briefe' },
  { id: 'film', gender: 'm', singular: 'Film', plural: 'Filme' },
  { id: 'tag', gender: 'm', singular: 'Tag', plural: 'Tage' },
  { id: 'zug', gender: 'm', singular: 'Zug', plural: 'Züge' },
  { id: 'bus', gender: 'm', singular: 'Bus', plural: 'Busse' },
  { id: 'park', gender: 'm', singular: 'Park', plural: 'Parks' },
  { id: 'computer', gender: 'm', singular: 'Computer', plural: 'Computer' },
  { id: 'garten', gender: 'm', singular: 'Garten', plural: 'Gärten' },
  { id: 'schluessel', gender: 'm', singular: 'Schlüssel', plural: 'Schlüssel' },
  { id: 'berg', gender: 'm', singular: 'Berg', plural: 'Berge' },
  { id: 'auto', gender: 'n', singular: 'Auto', plural: 'Autos' },
  { id: 'lied', gender: 'n', singular: 'Lied', plural: 'Lieder' },
  { id: 'getraenk', gender: 'n', singular: 'Getränk', plural: 'Getränke' },
  { id: 'buch', gender: 'n', singular: 'Buch', plural: 'Bücher' },
  { id: 'kind', gender: 'n', singular: 'Kind', plural: 'Kinder' },
  { id: 'haus', gender: 'n', singular: 'Haus', plural: 'Häuser' },
  { id: 'zimmer', gender: 'n', singular: 'Zimmer', plural: 'Zimmer' },
  { id: 'fenster', gender: 'n', singular: 'Fenster', plural: 'Fenster' },
  { id: 'handy', gender: 'n', singular: 'Handy', plural: 'Handys' },
  { id: 'kino', gender: 'n', singular: 'Kino', plural: 'Kinos' },
  { id: 'foto', gender: 'n', singular: 'Foto', plural: 'Fotos' },
  { id: 'hotel', gender: 'n', singular: 'Hotel', plural: 'Hotels' },
  { id: 'bild', gender: 'n', singular: 'Bild', plural: 'Bilder' },
  { id: 'dorf', gender: 'n', singular: 'Dorf', plural: 'Dörfer' },
  { id: 'jahr', gender: 'n', singular: 'Jahr', plural: 'Jahre' },
  { id: 'problem', gender: 'n', singular: 'Problem', plural: 'Probleme' },
  { id: 'geschenk', gender: 'n', singular: 'Geschenk', plural: 'Geschenke' },
  { id: 'fahrrad', gender: 'n', singular: 'Fahrrad', plural: 'Fahrräder' },
  { id: 'tradition', gender: 'f', singular: 'Tradition', plural: 'Traditionen' },
  { id: 'frau', gender: 'f', singular: 'Frau', plural: 'Frauen' },
  { id: 'stadt', gender: 'f', singular: 'Stadt', plural: 'Städte' },
  { id: 'hand', gender: 'f', singular: 'Hand', plural: 'Hände' },
  { id: 'wohnung', gender: 'f', singular: 'Wohnung', plural: 'Wohnungen' },
  { id: 'strasse', gender: 'f', singular: 'Straße', plural: 'Straßen' },
  { id: 'tasche', gender: 'f', singular: 'Tasche', plural: 'Taschen' },
  { id: 'blume', gender: 'f', singular: 'Blume', plural: 'Blumen' },
  { id: 'schule', gender: 'f', singular: 'Schule', plural: 'Schulen' },
  { id: 'frage', gender: 'f', singular: 'Frage', plural: 'Fragen' },
  { id: 'sprache', gender: 'f', singular: 'Sprache', plural: 'Sprachen' },
  { id: 'geschichte', gender: 'f', singular: 'Geschichte', plural: 'Geschichten' },
  { id: 'idee', gender: 'f', singular: 'Idee', plural: 'Ideen' },
  { id: 'nacht', gender: 'f', singular: 'Nacht', plural: 'Nächte' },
  { id: 'tuer', gender: 'f', singular: 'Tür', plural: 'Türen' },
  { id: 'reise', gender: 'f', singular: 'Reise', plural: 'Reisen' },
  { id: 'zeitung', gender: 'f', singular: 'Zeitung', plural: 'Zeitungen' },
  { id: 'pruefung', gender: 'f', singular: 'Prüfung', plural: 'Prüfungen' },
  // n-Deklination (masculine)
  { id: 'herr', gender: 'm', singular: 'Herr', plural: 'Herren', weakSingular: 'Herrn' },
  { id: 'junge', gender: 'm', singular: 'Junge', plural: 'Jungen', weakSingular: 'Jungen' },
  { id: 'student', gender: 'm', singular: 'Student', plural: 'Studenten', weakSingular: 'Studenten' },
  { id: 'kollege', gender: 'm', singular: 'Kollege', plural: 'Kollegen', weakSingular: 'Kollegen' },
  { id: 'kunde', gender: 'm', singular: 'Kunde', plural: 'Kunden', weakSingular: 'Kunden' },
  { id: 'nachbar', gender: 'm', singular: 'Nachbar', plural: 'Nachbarn', weakSingular: 'Nachbarn' },
  { id: 'mensch', gender: 'm', singular: 'Mensch', plural: 'Menschen', weakSingular: 'Menschen' },
  { id: 'polizist', gender: 'm', singular: 'Polizist', plural: 'Polizisten', weakSingular: 'Polizisten' },
  { id: 'tourist', gender: 'm', singular: 'Tourist', plural: 'Touristen', weakSingular: 'Touristen' },
  { id: 'journalist', gender: 'm', singular: 'Journalist', plural: 'Journalisten', weakSingular: 'Journalisten' },
  { id: 'patient', gender: 'm', singular: 'Patient', plural: 'Patienten', weakSingular: 'Patienten' },
  { id: 'fotograf', gender: 'm', singular: 'Fotograf', plural: 'Fotografen', weakSingular: 'Fotografen' },
  { id: 'architekt', gender: 'm', singular: 'Architekt', plural: 'Architekten', weakSingular: 'Architekten' },
  { id: 'experte', gender: 'm', singular: 'Experte', plural: 'Experten', weakSingular: 'Experten' },
  // mass nouns (no plural; may go without an article)
  { id: 'kaffee', gender: 'm', singular: 'Kaffee', noArticle: true },
  { id: 'tee', gender: 'm', singular: 'Tee', noArticle: true },
  { id: 'wein', gender: 'm', singular: 'Wein', noArticle: true },
  { id: 'zucker', gender: 'm', singular: 'Zucker', noArticle: true },
  { id: 'schnee', gender: 'm', singular: 'Schnee', noArticle: true },
  { id: 'mut', gender: 'm', singular: 'Mut', noArticle: true },
  { id: 'wasser', gender: 'n', singular: 'Wasser', noArticle: true },
  { id: 'geld', gender: 'n', singular: 'Geld', noArticle: true },
  { id: 'brot', gender: 'n', singular: 'Brot', noArticle: true },
  { id: 'obst', gender: 'n', singular: 'Obst', noArticle: true },
  { id: 'gemuese', gender: 'n', singular: 'Gemüse', noArticle: true },
  { id: 'glueck', gender: 'n', singular: 'Glück', noArticle: true },
  { id: 'salz', gender: 'n', singular: 'Salz', noArticle: true },
  { id: 'milch', gender: 'f', singular: 'Milch', noArticle: true },
  { id: 'zeit', gender: 'f', singular: 'Zeit', noArticle: true },
  { id: 'luft', gender: 'f', singular: 'Luft', noArticle: true },
  { id: 'musik', gender: 'f', singular: 'Musik', noArticle: true },
  { id: 'geduld', gender: 'f', singular: 'Geduld', noArticle: true },
];

/** Adjectives whose stem never changes when declined (so no hoch -> hohe, dunkel -> dunkle, teuer -> teure). */
export const ADJECTIVES: string[] = [
  'alt', 'lang', 'neu', 'lebendig', 'kalt', 'gelb', 'rot', 'blau', 'grün', 'weiß', 'schwarz', 'braun', 'grau', 'groß', 'klein', 'jung', 'gut', 'schlecht', 'schön', 'hässlich', 'warm', 'heiß', 'kühl', 'frisch', 'süß', 'salzig', 'scharf', 'stark', 'schwach', 'schnell', 'langsam', 'kurz', 'breit', 'schmal', 'dick', 'dünn', 'schwer', 'leicht', 'hart', 'weich', 'voll', 'leer', 'hell', 'klar', 'laut', 'ruhig', 'still', 'modern', 'traditionell', 'klassisch', 'interessant', 'langweilig', 'wichtig', 'richtig', 'falsch', 'einfach', 'schwierig', 'möglich', 'bekannt', 'berühmt', 'beliebt', 'freundlich', 'höflich', 'nett', 'klug', 'fleißig', 'faul', 'gesund', 'krank', 'reich', 'arm', 'billig', 'günstig', 'wertvoll', 'nützlich', 'praktisch', 'bequem', 'gemütlich', 'spannend', 'lustig', 'traurig', 'glücklich', 'zufrieden', 'ehrlich', 'mutig'
];

/** Grammar terms, always German regardless of the interface language; wrap with <De> at the call site. */
export const GENDER_LABEL: Record<Gender | 'pl', string> = { m: 'Maskulin', f: 'Feminin', n: 'Neutral', pl: 'Plural' };
export const CASE_LABEL: Record<GCase, string> = { nom: 'Nominativ', akk: 'Akkusativ', dat: 'Dativ' };
export const ARTICLE_TYPE_LABEL: Record<ArticleType, string> = {
  definite: 'bestimmter Artikel', indefinite: 'unbestimmter Artikel', negative: 'Negativartikel', none: 'ohne Artikel'
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

// The indefinite article has no plural form; «kein» takes the same singular endings (see below for its plural).
export const INDEFINITE_ARTICLE_ENDING: Record<GCase, Record<Gender, string>> = {
  nom: { m: '', f: 'e', n: '' },
  akk: { m: 'en', f: 'e', n: '' },
  dat: { m: 'em', f: 'er', n: 'em' }
};

/** The plural of the negative article: keine, keine, keinen. */
export const NEGATIVE_PLURAL_ARTICLE_ENDING: Record<GCase, string> = { nom: 'e', akk: 'e', dat: 'en' };

/** After a der-word (definite article): weak declension. */
export const WEAK_ADJECTIVE_ENDING: Record<GCase, Record<Gender | 'pl', string>> = {
  nom: { m: 'e', f: 'e', n: 'e', pl: 'en' },
  akk: { m: 'en', f: 'e', n: 'e', pl: 'en' },
  dat: { m: 'en', f: 'en', n: 'en', pl: 'en' }
};

/** After an ein-word (ein, kein): mixed declension. The plural column applies to «keine». */
export const MIXED_ADJECTIVE_ENDING: Record<GCase, Record<Gender | 'pl', string>> = {
  nom: { m: 'er', f: 'e', n: 'es', pl: 'en' },
  akk: { m: 'en', f: 'e', n: 'es', pl: 'en' },
  dat: { m: 'en', f: 'en', n: 'en', pl: 'en' }
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
  negative: ['', 'e', 'en', 'em', 'er'],
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
  if (type === 'indefinite' || type === 'negative') {
    const prefix = type === 'indefinite' ? 'ein' : 'kein';
    const ending = num === 'pl' ? NEGATIVE_PLURAL_ARTICLE_ENDING[c] : INDEFINITE_ARTICLE_ENDING[c][gender];
    return { prefix, ending, full: `${prefix}${ending}` };
  }
  const key = num === 'pl' ? 'pl' : gender;
  const ending = DEFINITE_ARTICLE_ENDING[c][key];
  return { prefix: 'd', ending, full: `d${ending}` };
}

function adjectiveSlot(lemma: string, type: ArticleType, c: GCase, gender: Gender, num: GNumber): Slot {
  const key = num === 'pl' ? 'pl' : gender;
  const ending =
    type === 'definite' ? WEAK_ADJECTIVE_ENDING[c][key]
    : type === 'indefinite' || type === 'negative' ? MIXED_ADJECTIVE_ENDING[c][key]
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

export interface SessionWords {
  nouns: NounEntry[];
  adjectives: string[];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** The words for one run, as in the prototype: 2 n-Deklination nouns, 2 mass nouns, 6 others, 10 adjectives. */
export function drawSessionWords(): SessionWords {
  const weak = shuffle(NOUNS.filter(n => n.weakSingular));
  const mass = shuffle(NOUNS.filter(n => n.noArticle));
  const regular = shuffle(NOUNS.filter(n => !n.weakSingular && !n.noArticle));
  return {
    nouns: shuffle([...weak.slice(0, 2), ...mass.slice(0, 2), ...regular.slice(0, 6)]),
    adjectives: shuffle(ADJECTIVES).slice(0, 10)
  };
}

/**
 * A random, grammatically consistent round (the prototype's rules):
 *   mass noun:  singular; definite, «kein» or no article
 *   other noun: singular with definite, indefinite or «kein»; or plural with definite, «keine» or no article
 * Four rounds in five have an adjective; a round without an article always has one (otherwise there is
 * nothing to decline).
 */
export function generateRound(words: SessionWords = { nouns: NOUNS, adjectives: ADJECTIVES }): Round {
  const noun = pick(words.nouns);
  const gender = noun.gender;
  const gcase = pick(CASES);

  let number: GNumber;
  let articleType: ArticleType;
  if (noun.noArticle || !noun.plural) {
    number = 'sg';
    articleType = pick<ArticleType>(noun.noArticle ? ['definite', 'negative', 'none'] : ['definite', 'indefinite', 'negative']);
  } else {
    number = Math.random() < 0.5 ? 'sg' : 'pl';
    articleType = pick<ArticleType>(number === 'sg' ? ['definite', 'indefinite', 'negative'] : ['definite', 'negative', 'none']);
  }

  const adjective = articleType === 'none' || Math.random() < 0.8 ? pick(words.adjectives) : null;

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
  /** The whole phrase, e.g. "keinen alten Liedern". */
  expected: string;
}

const byId = (id: string): NounEntry => {
  const n = NOUNS.find(x => x.id === id);
  if (!n) throw new Error(`unknown noun ${id}`);
  return n;
};

// "Leben" is not in the bank; the prototype's self-test uses it for neuter singular.
const LEBEN: NounEntry = { id: 'leben', gender: 'n', singular: 'Leben' };

function tc(nounRef: string | NounEntry, adjective: string | null, articleType: ArticleType, c: GCase, number: GNumber, expected: string): SelfTestCase {
  const noun = typeof nounRef === 'string' ? byId(nounRef) : nounRef;
  return { name: `${articleType} ${c} ${number === 'pl' ? 'pl' : noun.gender}: ${expected}`, params: { noun, adjective, articleType, case: c, gender: noun.gender, number }, expected };
}

/** The prototype's self-test (every case), plus n-Deklination, dative plural and no-adjective cases. */
export const SELF_TEST_CASES: SelfTestCase[] = [
  // ein / kein
  tc('dialekt', 'lebendig', 'indefinite', 'nom', 'sg', 'ein lebendiger Dialekt'),
  tc('dialekt', 'lebendig', 'indefinite', 'akk', 'sg', 'einen lebendigen Dialekt'),
  tc('dialekt', 'lebendig', 'indefinite', 'dat', 'sg', 'einem lebendigen Dialekt'),
  tc(LEBEN, 'neu', 'indefinite', 'nom', 'sg', 'ein neues Leben'),
  tc(LEBEN, 'neu', 'indefinite', 'akk', 'sg', 'ein neues Leben'),
  tc(LEBEN, 'neu', 'indefinite', 'dat', 'sg', 'einem neuen Leben'),
  tc('tradition', 'lang', 'indefinite', 'nom', 'sg', 'eine lange Tradition'),
  tc('tradition', 'lang', 'indefinite', 'akk', 'sg', 'eine lange Tradition'),
  tc('tradition', 'lang', 'indefinite', 'dat', 'sg', 'einer langen Tradition'),
  tc('lied', 'alt', 'none', 'nom', 'pl', 'alte Lieder'),
  tc('lied', 'alt', 'none', 'akk', 'pl', 'alte Lieder'),
  tc('lied', 'alt', 'none', 'dat', 'pl', 'alten Liedern'),
  tc('lied', 'alt', 'negative', 'nom', 'pl', 'keine alten Lieder'),
  tc('lied', 'alt', 'negative', 'akk', 'pl', 'keine alten Lieder'),
  tc('lied', 'alt', 'negative', 'dat', 'pl', 'keinen alten Liedern'),
  tc('dialekt', 'lebendig', 'negative', 'akk', 'sg', 'keinen lebendigen Dialekt'),
  tc('kaffee', 'kalt', 'negative', 'dat', 'sg', 'keinem kalten Kaffee'),
  // der / die / das
  tc('dialekt', 'lebendig', 'definite', 'nom', 'sg', 'der lebendige Dialekt'),
  tc('dialekt', 'lebendig', 'definite', 'akk', 'sg', 'den lebendigen Dialekt'),
  tc('dialekt', 'lebendig', 'definite', 'dat', 'sg', 'dem lebendigen Dialekt'),
  tc(LEBEN, 'neu', 'definite', 'nom', 'sg', 'das neue Leben'),
  tc(LEBEN, 'neu', 'definite', 'akk', 'sg', 'das neue Leben'),
  tc(LEBEN, 'neu', 'definite', 'dat', 'sg', 'dem neuen Leben'),
  tc('tradition', 'lang', 'definite', 'nom', 'sg', 'die lange Tradition'),
  tc('tradition', 'lang', 'definite', 'akk', 'sg', 'die lange Tradition'),
  tc('tradition', 'lang', 'definite', 'dat', 'sg', 'der langen Tradition'),
  tc('lied', 'alt', 'definite', 'nom', 'pl', 'die alten Lieder'),
  tc('lied', 'alt', 'definite', 'akk', 'pl', 'die alten Lieder'),
  tc('lied', 'alt', 'definite', 'dat', 'pl', 'den alten Liedern'),
  // no article (strong)
  tc('kaffee', 'kalt', 'none', 'nom', 'sg', 'kalter Kaffee'),
  tc('kaffee', 'kalt', 'none', 'akk', 'sg', 'kalten Kaffee'),
  tc('kaffee', 'kalt', 'none', 'dat', 'sg', 'kaltem Kaffee'),
  tc('wasser', 'kalt', 'none', 'nom', 'sg', 'kaltes Wasser'),
  tc('wasser', 'kalt', 'none', 'akk', 'sg', 'kaltes Wasser'),
  tc('wasser', 'kalt', 'none', 'dat', 'sg', 'kaltem Wasser'),
  tc('milch', 'kalt', 'none', 'nom', 'sg', 'kalte Milch'),
  tc('milch', 'kalt', 'none', 'akk', 'sg', 'kalte Milch'),
  tc('milch', 'kalt', 'none', 'dat', 'sg', 'kalter Milch'),
  tc('getraenk', 'kalt', 'none', 'dat', 'pl', 'kalten Getränken'),
  // n-Deklination and dative plural
  tc('herr', 'nett', 'definite', 'akk', 'sg', 'den netten Herrn'),
  tc('student', 'fleißig', 'indefinite', 'dat', 'sg', 'einem fleißigen Studenten'),
  tc('nachbar', 'nett', 'definite', 'dat', 'sg', 'dem netten Nachbarn'),
  tc('kollege', 'neu', 'negative', 'akk', 'sg', 'keinen neuen Kollegen'),
  tc('student', 'jung', 'definite', 'nom', 'sg', 'der junge Student'),
  tc('auto', 'gelb', 'definite', 'dat', 'pl', 'den gelben Autos'),
  tc('park', 'klein', 'definite', 'dat', 'pl', 'den kleinen Parks'),
  tc('frau', 'freundlich', 'none', 'dat', 'pl', 'freundlichen Frauen'),
  tc('kind', 'klein', 'definite', 'dat', 'pl', 'den kleinen Kindern'),
  tc('fahrrad', 'neu', 'negative', 'dat', 'pl', 'keinen neuen Fahrrädern'),
  // no adjective
  tc('stadt', null, 'definite', 'nom', 'sg', 'die Stadt'),
  tc('lehrer', null, 'indefinite', 'dat', 'sg', 'einem Lehrer'),
  tc('zeit', null, 'negative', 'akk', 'sg', 'keine Zeit')
];

/** Runs every SELF_TEST_CASES case; throws with the first mismatch. Used by the unit tests. */
export function runDeclensionSelfTest(): void {
  for (const t of SELF_TEST_CASES) {
    const got = phraseText(declinePhrase(t.params));
    if (got !== t.expected) throw new Error(`${t.name}: expected "${t.expected}", got "${got}"`);
  }
}
