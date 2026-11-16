/**
 * Checking typed Perfekt answers ("ist gekommen") for verb cards. Pure functions, no imports,
 * so they can be unit-tested with plain Node (see tests/perfekt.test.ts).
 *
 * Accepted answers come from the CSV `Perfekt` column, alternatives separated by " | "
 * ("ist gerudert | hat gerudert", "hat sich verändert | hat verändert").
 */

export type PerfektVerdict =
  | 'correct'     // right auxiliary and participle
  | 'almost'      // right auxiliary, participle one letter off: counts as correct, show the spelling
  | 'wrongAux'    // participle right (or one letter off) but haben/sein mixed up: counts as wrong
  | 'wrong'
  | 'missingAux'; // only a participle was typed: not graded, ask for haben/sein and let the user retry

export interface PerfektResult {
  verdict: PerfektVerdict;
  /** Whether the card should move forward */
  correct: boolean;
  /** The accepted answer closest to the input, as written in the data (for display) */
  expected: string;
  /** The answer had no "sich" although the verb is reflexive (still counted as correct) */
  missingSich: boolean;
}

const SEIN = new Set(['bin', 'bist', 'ist', 'sind', 'seid']);
const HABEN = new Set(['habe', 'hab', 'hast', 'hat', 'haben', 'habt']);
const PRONOUNS = new Set(['ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'man']);
const REFLEXIVE = new Set(['mich', 'dich', 'sich', 'uns', 'euch']);

/** Lower-case, umlauts and ß spelled out, punctuation removed, single spaces. */
export function foldGerman(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[.,!?;:"'„“”‚‘’()«»…]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseAccepted(perfekt: string | undefined | null): string[] {
  return (perfekt || '').split('|').map(s => s.trim()).filter(Boolean);
}

interface Parsed {
  aux: 'hat' | 'ist' | null;
  /** Everything after the auxiliary except reflexive pronouns, e.g. "ski gefahren" */
  core: string;
  hasSich: boolean;
}

function parse(answer: string): Parsed {
  let tokens = foldGerman(answer).split(' ').filter(Boolean);
  // "ich bin gekommen", "es hat geblitzt": drop a leading subject pronoun
  if (tokens.length > 1 && PRONOUNS.has(tokens[0]) && (SEIN.has(tokens[1]) || HABEN.has(tokens[1]))) {
    tokens = tokens.slice(1);
  }
  let aux: Parsed['aux'] = null;
  if (tokens.length && SEIN.has(tokens[0])) aux = 'ist';
  else if (tokens.length && HABEN.has(tokens[0])) aux = 'hat';
  if (aux) tokens = tokens.slice(1);
  const hasSich = tokens.some(t => REFLEXIVE.has(t));
  const core = tokens.filter(t => !REFLEXIVE.has(t)).join(' ');
  return { aux, core, hasSich };
}

/** Levenshtein distance, stopping early once it exceeds `max`. */
function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const RANK: Record<PerfektVerdict, number> = { correct: 4, almost: 3, wrongAux: 2, missingAux: 1, wrong: 0 };

export function checkPerfekt(input: string, accepted: string[]): PerfektResult {
  const answer = parse(input);
  let best: PerfektResult = { verdict: 'wrong', correct: false, expected: accepted[0] || '', missingSich: false };
  let bestScore = RANK.wrong * 2 + 1;

  for (const option of accepted) {
    const exp = parse(option);
    // An extra "sich" on a non-reflexive verb is a different verb form
    const sichOk = exp.hasSich || !answer.hasSich;
    const d = sichOk ? distance(answer.core, exp.core) : 99;
    const closeEnough = d === 0 || (d === 1 && exp.core.length >= 4);

    let verdict: PerfektVerdict;
    if (!answer.aux) verdict = 'missingAux';
    else if (!closeEnough) verdict = 'wrong';
    else if (answer.aux !== exp.aux) verdict = 'wrongAux';
    else verdict = d === 0 ? 'correct' : 'almost';

    const correct = verdict === 'correct' || verdict === 'almost';
    const missingSich = correct && exp.hasSich && !answer.hasSich;
    // Keep the best match: higher verdict first, then an exact reflexive match over a "missing sich" one.
    // On a full tie the earlier (main) answer wins.
    const score = RANK[verdict] * 2 + (missingSich ? 0 : 1);
    if (score > bestScore) {
      bestScore = score;
      best = { verdict, correct, expected: option, missingSich };
    }
  }
  return best;
}

/**
 * Perfekt of a user's own card, read from its Formen text when it holds exactly one
 * "hat …" / "ist …" part (e.g. "lernt · lernte · hat gelernt"). Returns [] when unsure.
 */
export function perfektFromFormen(formen: string | undefined): string[] {
  const parts = (formen || '')
    .split(/[·|,;]/)
    .map(s => s.replace(/\([^)]*\)/g, '').replace(/\+.*$/, '').trim())
    .filter(s => /^(hat|ist)\b/i.test(s));
  if (parts.length !== 1) return [];
  const m = parts[0].match(/^(hat|ist)(?:\s*\/\s*(hat|ist))?\s+(.+)$/i);
  if (!m) return [];
  const auxes = [m[1], m[2]].filter(Boolean).map(a => a.toLowerCase());
  const rests = m[3].split('/').map(s => s.trim()).filter(Boolean);
  if (!rests.length || rests.some(r => r.split(/\s+/).length > 3)) return [];
  return auxes.flatMap(a => rests.map(r => `${a} ${r}`));
}

/** The participle words of the accepted answers ("gefahren", "gesandt"), for hiding them before the user answers. */
export function participlesOf(accepted: string[]): string[] {
  const words = new Set<string>();
  accepted.forEach(a => {
    const tokens = a.split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last && !HABEN.has(last.toLowerCase()) && !SEIN.has(last.toLowerCase())) words.add(last);
  });
  return [...words];
}

/** Replace the participle(s) in a text (Formen, example) with "…" until the user has answered. */
export function maskParticiples(text: string, accepted: string[]): string {
  return participlesOf(accepted).reduce((t, word) => {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(`(?<!\\p{L})${escaped}(?!\\p{L})`, 'giu'), '…');
  }, text);
}
