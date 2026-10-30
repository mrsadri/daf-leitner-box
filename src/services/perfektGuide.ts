/**
 * How a verb forms its Perfekt: group (regular / irregular / mixed), prefix type (separable, inseparable,
 * -ieren), the participle split into its parts, and why it takes haben or sein.
 * Pure functions, no imports from the app (unit-tested in tests/perfektGuide.test.ts over all book verbs).
 */

/** schwach = regular (ge…t), stark = irregular (ge…en), gemischt = mixed (changed stem + t) */
export type PerfektGroup = 'weak' | 'strong' | 'mixed';
/**
 * Prefix type:
 * - none: plain ge-;
 * - separable: prefix + ge;
 * - inseparable: no ge;
 * - ieren: no ge;
 * - phrase: a two-word verb such as "spazieren gehen" (the first word stays separate);
 * - unstressed: no ge- because the stress isn't on the first syllable (interviewen → interviewt).
 */
export type PrefixKind = 'none' | 'separable' | 'inseparable' | 'ieren' | 'phrase' | 'unstressed';
export type SegmentPart = 'prefix' | 'ge' | 'stem' | 'ending';
/** both: haben or sein depending on the meaning; austria: sein in Austria and southern Germany (stehen, liegen, sitzen) */
export type AuxReason = 'reflexive' | 'special' | 'motion' | 'default' | 'both' | 'austria';

export interface ParticipleSegment {
  text: string;
  part: SegmentPart;
}

export interface PerfektGuide {
  aux: 'haben' | 'sein';
  /** Both auxiliaries are accepted (e.g. stehen: hat/ist gestanden) */
  bothAux: boolean;
  auxReason: AuxReason;
  reflexive: boolean;
  group: PerfektGroup;
  prefix: PrefixKind;
  /** Separable prefix or first word of a phrase ("an", "kennen", "spazieren") */
  separable: string;
  /** Inseparable prefix ("be", "ver", …), also after a separable one ("vor|be|reiten") */
  inseparable: string;
  /** Participle as written in the answer, without auxiliary and sich ("angerufen") */
  participle: string;
  segments: ParticipleSegment[];
  /** Stem of the infinitive (after prefixes), e.g. "ruf" */
  infinitiveStem: string;
  /** Stem as it appears in the participle, e.g. "ruf", "gang" */
  participleStem: string;
  stemChanged: boolean;
  /** Ending "-et" (arbeiten → gearbeitet) instead of "-t" */
  endingEt: boolean;
  /** The prefix is separable in some verbs and inseparable in others (über-, um-, durch-, …) */
  dualPrefix: boolean;
  /** essen → ge|g|essen: an extra g before the stem */
  extraG: boolean;
  /** Other correct participles (senden: gesendet next to gesandt) */
  alternatives: string[];
}

// Longest first, so "zurück" wins over "zu" and "herein" over "her"
const SEPARABLE = [
  'zusammen', 'entgegen', 'herunter', 'hinunter', 'heraus', 'herein', 'herum', 'hinaus', 'hinein', 'vorbei', 'voraus',
  'zurück', 'kennen', 'weiter', 'wieder', 'fertig', 'kaputt', 'sauber', 'nieder', 'statt', 'stehen', 'liegen',
  'hoch', 'fern', 'fest', 'frei', 'fort', 'heim', 'nach', 'teil', 'über', 'unter', 'durch', 'weg', 'los', 'mit',
  'vor', 'auf', 'aus', 'bei', 'ein', 'dar', 'her', 'hin', 'um', 'ab', 'an', 'zu', 'da'
].sort((a, b) => b.length - a.length);

const INSEPARABLE = ['hinter', 'wider', 'miss', 'über', 'unter', 'durch', 'voll', 'wieder', 'emp', 'ent', 'zer', 'ver', 'be', 'er', 'ge', 'um']
  .sort((a, b) => b.length - a.length);

/** Verbs that take sein without being verbs of motion or change of state */
const SPECIAL_SEIN = new Set(['sein', 'bleiben', 'werden', 'passieren', 'geschehen', 'gelingen', 'misslingen', 'begegnen']);

/** Prefixes that are never separable: a ge- right after them belongs to the stem (be|geist|ert) */
const ONLY_INSEPARABLE = new Set(['be', 'emp', 'ent', 'er', 'ge', 'miss', 'ver', 'zer']);

/** Position verbs that take sein in Austria and southern Germany */
const AUSTRIAN_SEIN = new Set(['stehen', 'liegen', 'sitzen', 'hängen']);

/** Prefixes that are separable in some verbs and inseparable in others, depending on stress and meaning */
const DUAL_PREFIXES = new Set(['über', 'unter', 'durch', 'um', 'wieder', 'wider', 'hinter', 'voll']);

const lower = (s: string) => s.toLocaleLowerCase('de');

/**
 * Does the participle add a ge- in front of this (prefix-free) infinitive?
 * Verbs that start with ge- themselves: gehen → ge|gangen and geben → ge|geben add one,
 * gehören → gehört and gewinnen → gewonnen (inseparable ge-) don't.
 */
function addsGe(inf: string, pp: string): boolean {
  if (!pp.startsWith('ge')) return false;
  if (!inf.startsWith('ge')) return true;
  return pp.startsWith('gege') || pp[2] !== inf[2];
}

/** "rufen" → "ruf", "sammeln" → "sammel", "tun" → "tu" */
function stemOf(infinitive: string): string {
  if (infinitive.endsWith('en')) return infinitive.slice(0, -2);
  if (infinitive.endsWith('n')) return infinitive.slice(0, -1);
  return infinitive;
}

/** Split "hat sich angerufen" into its parts. */
function parseAnswer(answer: string): { aux: 'haben' | 'sein'; reflexive: boolean; participle: string } | null {
  const words = answer.trim().split(/\s+/);
  const auxWord = lower(words[0] ?? '');
  if (auxWord !== 'hat' && auxWord !== 'ist') return null;
  const rest = words.slice(1);
  const reflexive = rest.length > 0 && lower(rest[0]) === 'sich';
  const participle = (reflexive ? rest.slice(1) : rest).join(' ');
  if (!participle) return null;
  return { aux: auxWord === 'hat' ? 'haben' : 'sein', reflexive, participle };
}

interface Core {
  separable: string;
  inseparable: string;
  hasGe: boolean;
  /** Participle after the separable prefix and ge- */
  body: string;
  /** Infinitive after the separable prefix */
  coreInfinitive: string;
}

function splitPrefixes(infL: string, ppL: string): Core {
  // Known separable prefixes first, then any other word in front of a ge- (klar|ge|macht, raus|ge|bracht)
  const candidates = [...SEPARABLE];
  for (let k = 2; k < ppL.length - 3; k++) {
    const p = ppL.slice(0, k);
    if (ppL.startsWith('ge', k) && infL.startsWith(p) && !ONLY_INSEPARABLE.has(p) && !candidates.includes(p)) candidates.push(p);
  }
  for (const p of candidates) {
    if (!infL.startsWith(p) || !ppL.startsWith(p) || infL.length < p.length + 3) continue;
    const coreInf = infL.slice(p.length);
    const corePp = ppL.slice(p.length);
    // Separable means a ge- appears after the prefix
    if (addsGe(coreInf, corePp)) return { separable: p, inseparable: '', hasGe: true, body: corePp.slice(2), coreInfinitive: coreInf };
    // No ge-: an inseparable prefix follows (vor|be|reiten, wieder|er|kennen) or an -ieren verb (aus|probiert) …
    const inner = INSEPARABLE.find(q => coreInf.startsWith(q) && coreInf.length > q.length + 2);
    if (inner) return { separable: p, inseparable: inner, hasGe: false, body: corePp, coreInfinitive: coreInf };
    if (coreInf.endsWith('ieren') && corePp.endsWith('iert') && !INSEPARABLE.includes(p)) {
      return { separable: p, inseparable: '', hasGe: false, body: corePp, coreInfinitive: coreInf };
    }
    // … or this prefix doesn't fit (her|ankommen: try "heran") or is inseparable here (über|setzt, wieder|holt)
  }
  if (addsGe(infL, ppL)) return { separable: '', inseparable: '', hasGe: true, body: ppL.slice(2), coreInfinitive: infL };
  const insep = INSEPARABLE.find(q => infL.startsWith(q) && infL.length > q.length + 2) ?? '';
  return { separable: '', inseparable: insep, hasGe: false, body: ppL, coreInfinitive: infL };
}

/**
 * Explain the Perfekt of a verb.
 * @param infinitive e.g. "anrufen", "sich waschen", "spazieren gehen" (extra words like "+ Akk" are ignored)
 * @param accepted accepted answers, e.g. ["hat angerufen"] or ["hat gestanden", "ist gestanden"]
 */
export function explainPerfekt(infinitive: string, accepted: string[]): PerfektGuide | null {
  const parsed = accepted.map(parseAnswer).filter((x): x is NonNullable<typeof x> => x !== null);
  if (!parsed.length) return null;
  const first = parsed[0];
  const auxes = new Set(parsed.map(p => p.aux));
  const bothAux = auxes.size > 1;

  // Infinitive without "sich", objects and notes: "sich freuen auf + Akk" → "freuen"
  let inf = infinitive.replace(/\(.*?\)/g, ' ').replace(/\+.*$/, ' ').replace(/\bsich\b/g, ' ').trim().replace(/\s+/g, ' ');
  if (!inf) return null;

  let phraseWord = '';
  let participle = first.participle;
  const ppWords = participle.split(' ');
  if (ppWords.length > 1) {
    // "spazieren gegangen", "Ski gefahren": the first word(s) stay as they are
    phraseWord = ppWords.slice(0, -1).join(' ');
    participle = ppWords[ppWords.length - 1];
    inf = inf.split(' ').pop() ?? inf;
  } else if (inf.includes(' ')) {
    const words = inf.split(' ');
    if (lower(participle).startsWith(lower(words[0])) && !lower(participle).startsWith('ge')) {
      // "weh tun" → "wehgetan": written as one word in the participle
      inf = words.join('');
    } else {
      // "arbeiten als" → "arbeiten": the verb is the word that ends in -n
      const verbWords = words.filter(w => /n$/.test(w));
      inf = verbWords.length ? verbWords[verbWords.length - 1] : words[0];
    }
  }

  const infL = lower(inf);
  const ppL = lower(participle);
  const core = splitPrefixes(infL, ppL);

  // Stem comparison (inseparable prefix stays part of both sides)
  const infStem = stemOf(core.coreInfinitive);
  let body = core.body;
  let ending = '';
  let group: PerfektGroup;
  let endingEt = false;
  if (/[^e]t$|et$/.test(body) && !body.endsWith('en')) {
    endingEt = body.endsWith('et') && body.slice(0, -2) === infStem;
    ending = endingEt ? 'et' : 't';
    body = body.slice(0, -ending.length);
    group = body === infStem ? 'weak' : 'mixed';
  } else {
    ending = body.endsWith('en') ? 'en' : body.endsWith('n') ? 'n' : '';
    body = ending ? body.slice(0, -ending.length) : body;
    group = 'strong';
  }
  const participleStem = body;
  const stemChanged = participleStem !== infStem;

  let prefix: PrefixKind = 'none';
  if (phraseWord) prefix = 'phrase';
  else if (core.coreInfinitive.endsWith('ieren') && ppL.endsWith('iert') && !core.hasGe) prefix = 'ieren';
  else if (core.inseparable && !core.hasGe) prefix = 'inseparable';
  else if (core.separable) prefix = 'separable';
  else if (!core.hasGe) prefix = 'unstressed';

  // Segments in the participle's own spelling (keeps capital letters of "Ski")
  const segments: ParticipleSegment[] = [];
  let pos = 0;
  const take = (len: number, part: SegmentPart) => {
    if (len <= 0) return;
    segments.push({ text: participle.slice(pos, pos + len), part });
    pos += len;
  };
  take(core.separable.length, 'prefix');
  if (core.hasGe) take(2, 'ge');
  if (core.inseparable && !core.hasGe) take(core.inseparable.length, 'prefix');
  take(participle.length - pos - ending.length, 'stem');
  take(ending.length, 'ending');

  const reflexive = parsed.some(p => p.reflexive);
  const shownPrefix = prefix === 'separable' ? core.separable : prefix === 'inseparable' ? (core.separable ? '' : core.inseparable) : '';
  const alternatives = [...new Set(parsed.map(p => p.participle))].filter(p => p !== first.participle);
  const aux = first.aux;
  const baseVerb = infL.slice(core.separable.length);
  const auxReason: AuxReason = bothAux ? (AUSTRIAN_SEIN.has(baseVerb) ? 'austria' : 'both')
    : reflexive ? 'reflexive'
    : aux === 'sein' ? (SPECIAL_SEIN.has(baseVerb) || SPECIAL_SEIN.has(infL) ? 'special' : 'motion')
    : 'default';

  return {
    aux,
    bothAux,
    auxReason,
    reflexive,
    group,
    prefix,
    separable: phraseWord || core.separable,
    inseparable: core.hasGe ? '' : core.inseparable,
    participle: phraseWord ? `${phraseWord} ${participle}` : participle,
    segments: phraseWord ? [{ text: phraseWord + ' ', part: 'prefix' }, ...segments] : segments,
    infinitiveStem: infStem.slice(core.inseparable && !core.hasGe ? core.inseparable.length : 0),
    participleStem: participleStem.slice(core.inseparable && !core.hasGe ? core.inseparable.length : 0),
    stemChanged,
    endingEt,
    dualPrefix: DUAL_PREFIXES.has(shownPrefix),
    extraG: participleStem === 'g' + infStem,
    alternatives
  };
}
