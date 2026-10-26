import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conjugate, diffSegments } from '../src/services/conjugation.ts';
import type { VerbData, Conjugation } from '../src/services/conjugation.ts';

const conj = (v: VerbData) => {
  const c = conjugate(v);
  assert.ok(c, `no conjugation for ${v.infinitiv}`);
  return c as Conjugation;
};
const forms = (c: Conjugation, tense: 'praesens' | 'praeteritum' | 'perfekt') => c[tense].map(f => f.text);
/** Irregular letters written as [..]: "f[ä]hrst" */
const marked = (c: Conjugation, tense: 'praesens' | 'praeteritum' | 'perfekt') =>
  c[tense].map(f => f.segments.map(s => (s.irregular ? `[${s.text}]` : s.text)).join(''));

test('regular verb: no irregular letters', () => {
  const c = conj({ infinitiv: 'machen', praesens: 'macht', perfekt: 'hat gemacht' });
  assert.equal(c.kind, 'regular');
  assert.deepEqual(forms(c, 'praesens'), ['mache', 'machst', 'macht', 'machen', 'macht', 'machen']);
  assert.deepEqual(forms(c, 'praeteritum'), ['machte', 'machtest', 'machte', 'machten', 'machtet', 'machten']);
  assert.deepEqual(forms(c, 'perfekt'), ['habe gemacht', 'hast gemacht', 'hat gemacht', 'haben gemacht', 'habt gemacht', 'haben gemacht']);
  assert.ok(['praesens', 'praeteritum', 'perfekt'].every(t => marked(c, t as 'praesens').every(f => !f.includes('['))));
});

test('stems ending in t/d, m/n after a consonant, and sibilants', () => {
  const arbeiten = conj({ infinitiv: 'arbeiten', praesens: 'arbeitet', perfekt: 'hat gearbeitet' });
  assert.deepEqual(forms(arbeiten, 'praesens'), ['arbeite', 'arbeitest', 'arbeitet', 'arbeiten', 'arbeitet', 'arbeiten']);
  assert.deepEqual(forms(arbeiten, 'praeteritum'), ['arbeitete', 'arbeitetest', 'arbeitete', 'arbeiteten', 'arbeitetet', 'arbeiteten']);
  assert.equal(arbeiten.kind, 'regular');
  const oeffnen = conj({ infinitiv: 'öffnen', praesens: 'öffnet', perfekt: 'hat geöffnet' });
  assert.deepEqual(forms(oeffnen, 'praesens'), ['öffne', 'öffnest', 'öffnet', 'öffnen', 'öffnet', 'öffnen']);
  const heissen = conj({ infinitiv: 'heißen', praesens: 'heißt', praeteritum: 'hieß', perfekt: 'hat geheißen' });
  assert.deepEqual(forms(heissen, 'praesens'), ['heiße', 'heißt', 'heißt', 'heißen', 'heißt', 'heißen']);
  assert.deepEqual(forms(heissen, 'praeteritum'), ['hieß', 'hießest', 'hieß', 'hießen', 'hießt', 'hießen']);
});

test('-eln and -ern verbs', () => {
  const sammeln = conj({ infinitiv: 'sammeln', praesens: 'sammelt', perfekt: 'hat gesammelt' });
  assert.deepEqual(forms(sammeln, 'praesens'), ['sammle', 'sammelst', 'sammelt', 'sammeln', 'sammelt', 'sammeln']);
  assert.deepEqual(forms(sammeln, 'praeteritum'), ['sammelte', 'sammeltest', 'sammelte', 'sammelten', 'sammeltet', 'sammelten']);
  assert.equal(sammeln.kind, 'regular');
  const aendern = conj({ infinitiv: 'ändern', praesens: 'ändert', perfekt: 'hat geändert' });
  assert.deepEqual(forms(aendern, 'praesens'), ['ändere', 'änderst', 'ändert', 'ändern', 'ändert', 'ändern']);
});

test('strong verb with vowel change: fahren', () => {
  const c = conj({ infinitiv: 'fahren', praesens: 'fährt', praeteritum: 'fuhr', perfekt: 'ist gefahren | hat gefahren' });
  assert.equal(c.kind, 'irregular');
  assert.deepEqual(marked(c, 'praesens'), ['fahre', 'f[ä]hrst', 'f[ä]hrt', 'fahren', 'fahrt', 'fahren']);
  assert.deepEqual(marked(c, 'praeteritum'), ['f[u]hr', 'f[u]hrst', 'f[u]hr', 'f[u]hren', 'f[u]hrt', 'f[u]hren']);
  assert.deepEqual(forms(c, 'perfekt')[0], 'bin / habe gefahren');
  // strong participle ending -en is not marked
  assert.ok(!marked(c, 'perfekt')[0].includes('['));
});

test('e → i, stem ending in t, d+t', () => {
  const nehmen = conj({ infinitiv: 'nehmen', praesens: 'nimmt', praeteritum: 'nahm', perfekt: 'hat genommen' });
  assert.deepEqual(forms(nehmen, 'praesens'), ['nehme', 'nimmst', 'nimmt', 'nehmen', 'nehmt', 'nehmen']);
  assert.ok(marked(nehmen, 'perfekt')[0].includes('['));
  const halten = conj({ infinitiv: 'halten', praesens: 'hält', praeteritum: 'hielt', perfekt: 'hat gehalten' });
  assert.deepEqual(forms(halten, 'praesens'), ['halte', 'hältst', 'hält', 'halten', 'haltet', 'halten']);
  assert.deepEqual(forms(halten, 'praeteritum'), ['hielt', 'hieltest', 'hielt', 'hielten', 'hieltet', 'hielten']);
  const lesen = conj({ infinitiv: 'lesen', praesens: 'liest', praeteritum: 'las', perfekt: 'hat gelesen' });
  assert.deepEqual(forms(lesen, 'praesens'), ['lese', 'liest', 'liest', 'lesen', 'lest', 'lesen']);
  assert.deepEqual(forms(lesen, 'praeteritum'), ['las', 'lasest', 'las', 'lasen', 'last', 'lasen']);
  const finden = conj({ infinitiv: 'finden', praesens: 'findet', praeteritum: 'fand', perfekt: 'hat gefunden' });
  assert.deepEqual(forms(finden, 'praeteritum'), ['fand', 'fandest', 'fand', 'fanden', 'fandet', 'fanden']);
  assert.deepEqual(marked(finden, 'praeteritum')[0], 'f[a]nd');
});

test('mixed verbs: bringen, kennen, denken', () => {
  const bringen = conj({ infinitiv: 'bringen', praesens: 'bringt', praeteritum: 'brachte', perfekt: 'hat gebracht' });
  assert.equal(bringen.kind, 'mixed');
  assert.deepEqual(forms(bringen, 'praeteritum'), ['brachte', 'brachtest', 'brachte', 'brachten', 'brachtet', 'brachten']);
  assert.ok(marked(bringen, 'praeteritum')[0].includes('['));
  const kennen = conj({ infinitiv: 'kennen', praesens: 'kennt', praeteritum: 'kannte', perfekt: 'hat gekannt' });
  assert.equal(kennen.kind, 'mixed');
  assert.deepEqual(marked(kennen, 'praeteritum')[0], 'k[a]nnte');
  assert.deepEqual(marked(kennen, 'perfekt')[0], 'habe gek[a]nnt');
});

test('separable, reflexive, and both together', () => {
  const ankommen = conj({ infinitiv: 'ankommen', praesens: 'kommt an', praeteritum: 'kam an', perfekt: 'ist angekommen' });
  assert.deepEqual(forms(ankommen, 'praesens'), ['komme an', 'kommst an', 'kommt an', 'kommen an', 'kommt an', 'kommen an']);
  assert.deepEqual(forms(ankommen, 'praeteritum')[0], 'kam an');
  assert.deepEqual(forms(ankommen, 'perfekt')[0], 'bin angekommen');
  assert.ok(!marked(ankommen, 'perfekt')[0].includes('['));
  const freuen = conj({ infinitiv: 'freuen', praesens: 'freut', perfekt: 'hat sich gefreut', reflexiv: 'akk' });
  assert.deepEqual(forms(freuen, 'praesens'), ['freue mich', 'freust dich', 'freut sich', 'freuen uns', 'freut euch', 'freuen sich']);
  assert.deepEqual(forms(freuen, 'perfekt')[0], 'habe mich gefreut');
  const vorstellen = conj({ infinitiv: 'vorstellen', praesens: 'stellt vor', perfekt: 'hat sich vorgestellt', reflexiv: 'akk' });
  assert.deepEqual(forms(vorstellen, 'praesens')[0], 'stelle mich vor');
  const merken = conj({ infinitiv: 'merken', praesens: 'merkt', perfekt: 'hat sich gemerkt', reflexiv: 'dat' });
  assert.deepEqual(forms(merken, 'praesens').slice(0, 2), ['merke mir', 'merkst dir']);
  const veraendern = conj({ infinitiv: 'verändern', praesens: 'verändert', perfekt: 'hat sich verändert | hat verändert', reflexiv: 'akk?' });
  assert.deepEqual(forms(veraendern, 'praesens')[0], 'verändere (mich)');
});

test('inseparable prefix and -ieren: no ge-', () => {
  const verstehen = conj({ infinitiv: 'verstehen', praesens: 'versteht', praeteritum: 'verstand', perfekt: 'hat verstanden' });
  assert.equal(verstehen.kind, 'irregular');
  assert.equal(forms(verstehen, 'perfekt')[0], 'habe verstanden');
  const studieren = conj({ infinitiv: 'studieren', praesens: 'studiert', perfekt: 'hat studiert' });
  assert.equal(studieren.kind, 'regular');
});

test('multi-word verbs keep the complement at the end', () => {
  const ski = conj({ infinitiv: 'Ski fahren', praesens: 'fährt Ski', praeteritum: 'fuhr Ski', perfekt: 'ist Ski gefahren' });
  assert.deepEqual(forms(ski, 'praesens').slice(0, 2), ['fahre Ski', 'fährst Ski']);
  assert.equal(forms(ski, 'perfekt')[0], 'bin Ski gefahren');
  const weh = conj({ infinitiv: 'weh tun', praesens: 'tut weh', praeteritum: 'tat weh', perfekt: 'hat wehgetan | hat weh getan' });
  assert.deepEqual(forms(weh, 'praesens'), ['tue weh', 'tust weh', 'tut weh', 'tun weh', 'tut weh', 'tun weh']);
});

test('special verbs: sein, haben, werden, wissen, modal verbs', () => {
  const sein = conj({ infinitiv: 'sein', praesens: 'ist', praeteritum: 'war', perfekt: 'ist gewesen' });
  assert.deepEqual(forms(sein, 'praesens'), ['bin', 'bist', 'ist', 'sind', 'seid', 'sind']);
  assert.deepEqual(forms(sein, 'praeteritum'), ['war', 'warst', 'war', 'waren', 'wart', 'waren']);
  assert.equal(sein.kind, 'irregular');
  const haben = conj({ infinitiv: 'haben', praesens: 'hat', praeteritum: 'hatte', perfekt: 'hat gehabt' });
  assert.deepEqual(forms(haben, 'praesens'), ['habe', 'hast', 'hat', 'haben', 'habt', 'haben']);
  assert.deepEqual(forms(haben, 'praeteritum'), ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten']);
  const werden = conj({ infinitiv: 'werden', praesens: 'wird', praeteritum: 'wurde', perfekt: 'ist geworden' });
  assert.deepEqual(forms(werden, 'praesens'), ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden']);
  assert.deepEqual(forms(werden, 'praeteritum'), ['wurde', 'wurdest', 'wurde', 'wurden', 'wurdet', 'wurden']);
  const wissen = conj({ infinitiv: 'wissen', praesens: 'weiß', praeteritum: 'wusste', perfekt: 'hat gewusst' });
  assert.deepEqual(forms(wissen, 'praesens'), ['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen']);
  const koennen = conj({ infinitiv: 'können', praesens: 'kann', praeteritum: 'konnte', perfekt: 'hat gekonnt' });
  assert.deepEqual(forms(koennen, 'praesens'), ['kann', 'kannst', 'kann', 'können', 'könnt', 'können']);
  const muessen = conj({ infinitiv: 'müssen', praesens: 'muss', praeteritum: 'musste', perfekt: 'hat gemusst' });
  assert.deepEqual(forms(muessen, 'praesens'), ['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen']);
  const vorhaben = conj({ infinitiv: 'vorhaben', praesens: 'hat vor', praeteritum: 'hatte vor', perfekt: 'hat vorgehabt' });
  assert.deepEqual(forms(vorhaben, 'praesens').slice(0, 3), ['habe vor', 'hast vor', 'hat vor']);
});

test('two participles and laden', () => {
  const senden = conj({ infinitiv: 'senden', praesens: 'sendet', praeteritum: 'sandte', perfekt: 'hat gesandt | hat gesendet' });
  assert.equal(forms(senden, 'perfekt')[0], 'habe gesandt / gesendet');
  const laden = conj({ infinitiv: 'laden', praesens: 'lädt', praeteritum: 'lud', perfekt: 'hat geladen' });
  assert.deepEqual(forms(laden, 'praesens').slice(0, 3), ['lade', 'lädst', 'lädt']);
});

test('diffSegments marks the changed letters', () => {
  assert.deepEqual(diffSegments('fuhr', 'fahr'), [{ text: 'f', irregular: false }, { text: 'u', irregular: true }, { text: 'hr', irregular: false }]);
  assert.deepEqual(diffSegments('macht', 'macht'), [{ text: 'macht', irregular: false }]);
});
