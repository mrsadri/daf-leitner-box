/**
 * Conjugation tables (Präsens, Präteritum, Perfekt) for the verb popup, with irregular letters marked.
 * Pure functions, no imports; unit-tested in tests/conjugation.test.ts and checked against every verb
 * in the word list in tests/data.test.ts.
 *
 * Input comes from the CSV columns built by scripts/build-conjugation-data.py:
 *   infinitiv "mitfahren" · praesens (er-form) "fährt mit" · praeteritum (er-form, empty = regular) "fuhr mit"
 *   perfekt "ist mitgefahren" · reflexiv "akk" | "dat" | "akk?" | "dat?" | ""
 *
 * Irregular letters: every form is compared with the form the regular rule would give
 * (character diff), and the letters that differ are marked: "du f[ä]hrst", "er f[u]hr", "ge[gang]en".
 */

export interface VerbData {
  infinitiv: string;
  praesens: string;
  praeteritum?: string;
  perfekt: string;
  reflexiv?: string;
}

export type Person = 'ich' | 'du' | 'er' | 'wir' | 'ihr' | 'sie';
export const PERSONS: Person[] = ['ich', 'du', 'er', 'wir', 'ihr', 'sie'];
export const PRONOUNS: Record<Person, string> = { ich: 'ich', du: 'du', er: 'er/sie/es', wir: 'wir', ihr: 'ihr', sie: 'sie/Sie' };

export interface Segment {
  text: string;
  irregular: boolean;
}

export interface ConjugatedForm {
  person: Person;
  /** Whole form after the pronoun, e.g. "stelle mich vor" */
  text: string;
  /** The same text split into regular and irregular parts */
  segments: Segment[];
}

export type VerbKind = 'regular' | 'irregular' | 'mixed';

export interface Conjugation {
  kind: VerbKind;
  praesens: ConjugatedForm[];
  praeteritum: ConjugatedForm[];
  perfekt: ConjugatedForm[];
}

const REFLEXIVE: Record<'akk' | 'dat', Record<Person, string>> = {
  akk: { ich: 'mich', du: 'dich', er: 'sich', wir: 'uns', ihr: 'euch', sie: 'sich' },
  dat: { ich: 'mir', du: 'dir', er: 'sich', wir: 'uns', ihr: 'euch', sie: 'sich' }
};
const AUX: Record<'hat' | 'ist', Record<Person, string>> = {
  hat: { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt', sie: 'haben' },
  ist: { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', sie: 'sind' }
};
const SEIN_PRAESENS: Record<Person, string> = { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', sie: 'sind' };

const endsSibilant = (s: string) => /(s|ß|z|x)$/.test(s);
/** Stems that take an extra -e-: arbeit-e-st, find-e-t, atm-e-t, öffn-e-t */
const needsE = (stem: string) => /[td]$/.test(stem) || /([^aeiouäöülrhmn]|ch)[mn]$/.test(stem);

/**
 * Mark the letters of `actual` that are not part of a longest common subsequence with `regular`.
 * When several alignments are equally long, the one with the fewest marked runs wins
 * ("ges[ess]en" rather than "gese[sse]n").
 */
export function diffSegments(actual: string, regular: string): Segment[] {
  const a = actual, b = regular;
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const trace = (preferSkipRegular: boolean): boolean[] => {
    const marks: boolean[] = [];
    let i = 0, j = 0;
    while (i < a.length) {
      if (j < b.length && a[i] === b[j] && dp[i][j] === dp[i + 1][j + 1] + 1) { marks.push(false); i++; j++; continue; }
      const skipRegular = j < b.length && (preferSkipRegular ? dp[i][j + 1] >= dp[i + 1][j] : dp[i][j + 1] > dp[i + 1][j]);
      if (skipRegular) j++;
      else { marks.push(true); i++; }
    }
    return marks;
  };
  // Fewer marked runs first, then the run that starts earlier (the stem rather than the ending)
  const score = (m: boolean[]) => m.filter((x, k) => x && !m[k - 1]).length * 1000 + (m.indexOf(true) + 1 || 999);
  const options = [trace(true), trace(false)];
  const marks = score(options[1]) < score(options[0]) ? options[1] : options[0];

  const segments: Segment[] = [];
  marks.forEach((irregular, k) => {
    const last = segments[segments.length - 1];
    if (last && last.irregular === irregular) last.text += a[k];
    else segments.push({ text: a[k], irregular });
  });
  return segments;
}

const plain = (text: string): Segment[] => (text ? [{ text, irregular: false }] : []);

/** Join pieces with spaces, keeping their segments. */
function join(pieces: Segment[][]): { text: string; segments: Segment[] } {
  const segments: Segment[] = [];
  pieces.filter(p => p.length).forEach((p, k) => {
    if (k > 0) segments.push({ text: ' ', irregular: false });
    segments.push(...p);
  });
  const merged: Segment[] = [];
  segments.forEach(s => {
    const last = merged[merged.length - 1];
    if (last && last.irregular === s.irregular) last.text += s.text;
    else merged.push({ ...s });
  });
  return { text: merged.map(s => s.text).join(''), segments: merged };
}

export function conjugate(v: VerbData): Conjugation | null {
  const praesensWords = v.praesens.trim().split(/\s+/);
  const finite3 = praesensWords[0];
  const particle = praesensWords.slice(1).join(' ');
  const infCompact = v.infinitiv.replace(/\s+/g, '');
  const particleCompact = particle.replace(/\s+/g, '');
  const base = particle && infCompact.toLowerCase().startsWith(particleCompact.toLowerCase())
    ? infCompact.slice(particleCompact.length)
    : v.infinitiv.trim().split(/\s+/).pop() || '';
  const perfektAnswers = v.perfekt.split('|').map(s => s.trim()).filter(Boolean);
  if (!finite3 || !base || !perfektAnswers.length) return null;

  // Stem: fahr-en, sammel-n, änder-n, tu-n
  const isElnErn = /(el|er)n$/.test(base);
  const stem = isElnErn ? base.slice(0, -1) : base.endsWith('en') ? base.slice(0, -2) : base.slice(0, -1);

  // Regular present
  const regular: Record<Person, string> = {
    ich: isElnErn && stem.endsWith('el') ? stem.slice(0, -2) + 'le' : stem + 'e',
    du: stem + (needsE(stem) ? 'est' : endsSibilant(stem) ? 't' : 'st'),
    er: stem + (needsE(stem) ? 'et' : 't'),
    wir: base,
    ihr: stem + (needsE(stem) ? 'et' : 't'),
    sie: base
  };
  if (stem === 'tu') regular.ich = 'tue';

  // Actual present: du and er from the data (stem changes: fährt, nimmt, hält, kann, wird)
  const actual: Record<Person, string> = { ...regular, er: finite3 };
  if (base === 'sein') Object.assign(actual, SEIN_PRAESENS);
  else if (finite3 !== regular.er) {
    let du: string;
    if (finite3.endsWith('dt')) du = finite3.slice(0, -1) + 'st';                              // lädt → lädst
    else if (finite3.endsWith('d')) du = finite3.slice(0, -1) + 'st';                          // wird → wirst
    else if (finite3.endsWith('t')) {
      const body = finite3.slice(0, -1);
      if (/t$/.test(stem) && !finite3.endsWith('et')) du = finite3 + 'st';                     // hält → hältst
      else if (endsSibilant(body)) du = finite3;                                               // liest, isst, lässt
      else du = body + 'st';                                                                    // fährt → fährst
    } else {
      du = finite3 + (endsSibilant(finite3) ? 't' : 'st');                                     // kann → kannst, weiß → weißt
      actual.ich = finite3;                                                                     // modal verbs, wissen: ich kann
    }
    actual.du = du;
  }

  // Präteritum (er-form)
  const regularPrat = stem + (needsE(stem) ? 'ete' : 'te');
  const prat3 = (v.praeteritum || '').trim().split(/\s+/)[0] || regularPrat;
  const weakLike = prat3.endsWith('e');
  const pratForms: Record<Person, string> = weakLike
    ? { ich: prat3, du: prat3 + 'st', er: prat3, wir: prat3 + 'n', ihr: prat3 + 't', sie: prat3 + 'n' }
    : {
        ich: prat3,
        du: prat3 + (/[tdsßz]$/.test(prat3) ? 'est' : 'st'),
        er: prat3,
        wir: prat3 + (/ie$/.test(prat3) ? 'n' : 'en'),
        ihr: prat3 + (/[td]$/.test(prat3) ? 'et' : 't'),
        sie: prat3 + (/ie$/.test(prat3) ? 'n' : 'en')
      };
  // What each Präteritum form is compared with: strong forms with the infinitive stem + the same ending
  const pratBase = (form: string) => (weakLike ? regularPrat : stem) + form.slice(prat3.length);

  // Perfekt: auxiliaries and participle phrase(s) ("Ski gefahren")
  const parsed = perfektAnswers.map(a => {
    const words = a.split(/\s+/);
    return { aux: words[0] as 'hat' | 'ist', rest: words.slice(1).filter(w => w !== 'sich').join(' ') };
  });
  const auxes = [...new Set(parsed.map(p => p.aux))].filter(a => a === 'hat' || a === 'ist');
  const rests = [...new Set(parsed.map(p => p.rest))];
  if (!auxes.length) return null;

  const participleBase = (participle: string) => {
    let core = participle;
    let prefix = '';
    if (particleCompact && core.toLowerCase().startsWith(particleCompact.toLowerCase())) {
      prefix = core.slice(0, particleCompact.length);
      core = core.slice(particleCompact.length);
    }
    const hasGe = core.startsWith('ge') && !(base.startsWith('ge') && !core.startsWith('gege'));
    const strong = /en$/.test(core) && !/(ier)?t$/.test(core);
    return prefix + (hasGe ? 'ge' : '') + stem + (strong ? 'en' : needsE(stem) ? 'et' : 't');
  };
  const participleSegments = (rest: string): Segment[] => {
    const words = rest.split(/\s+/);
    const participle = words.pop() || '';
    return join([...words.map(plain), diffSegments(participle, participleBase(participle))]).segments;
  };

  // Kind
  const anyIrregular = (segs: Segment[]) => segs.some(s => s.irregular);
  const pratIrregular = anyIrregular(diffSegments(prat3, pratBase(prat3)));
  const presentIrregular = PERSONS.some(p => actual[p] !== regular[p]);
  const participleIrregular = rests.some(r => anyIrregular(participleSegments(r)));
  const kind: VerbKind = !pratIrregular && !presentIrregular && !participleIrregular
    ? 'regular'
    : weakLike && prat3.endsWith('te') && base !== 'sein' && base !== 'werden' && !presentIrregular ? 'mixed' : 'irregular';

  const refl = v.reflexiv ? (v.reflexiv.startsWith('dat') ? 'dat' : 'akk') : null;
  const optionalRefl = !!v.reflexiv && v.reflexiv.endsWith('?');
  const reflOf = (p: Person) => (refl ? plain(optionalRefl ? `(${REFLEXIVE[refl][p]})` : REFLEXIVE[refl][p]) : []);
  const particleSegs = plain(particle);

  const praesens = PERSONS.map(p => ({
    person: p,
    ...join([diffSegments(actual[p], regular[p]), reflOf(p), particleSegs])
  }));
  const praeteritum = PERSONS.map(p => ({
    person: p,
    ...join([diffSegments(pratForms[p], pratBase(pratForms[p])), reflOf(p), particleSegs])
  }));
  const perfekt = PERSONS.map(p => {
    const auxText = auxes.map(a => AUX[a][p]).join(' / ');
    const restSegs: Segment[] = [];
    rests.forEach((r, k) => {
      if (k > 0) restSegs.push({ text: ' / ', irregular: false });
      restSegs.push(...participleSegments(r));
    });
    return { person: p, ...join([plain(auxText), reflOf(p), restSegs]) };
  });

  return { kind, praesens, praeteritum, perfekt };
}
