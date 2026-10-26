/**
 * Choosing a German voice for speech synthesis. Pure (no browser APIs), unit-tested in tests/voices.test.ts.
 */

export interface VoiceInfo {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
  voiceURI?: string;
}

/** "de_DE" (Android) and "de-de" both become "de-DE". */
export const normalizeLang = (lang: string) => {
  const [l, r] = lang.replace('_', '-').split('-');
  return r ? `${l.toLowerCase()}-${r.toUpperCase()}` : l.toLowerCase();
};

export const isGerman = (v: VoiceInfo) => normalizeLang(v.lang).startsWith('de');

/** Higher is better: standard German first, then natural / online voices; novelty voices last. */
function score(v: VoiceInfo): number {
  const lang = normalizeLang(v.lang);
  let s = 0;
  if (lang === 'de-DE') s += 30;
  else if (lang === 'de-AT') s += 25;
  else if (lang === 'de-CH') s += 15;
  else s += 10;
  if (/natural|neural|premium|enhanced|online/i.test(v.name)) s += 8;
  if (/google/i.test(v.name)) s += 6;
  if (/\b(anna|helena|petra|markus|yannick|katja|conrad|amala|hedda|stefan)\b/i.test(v.name)) s += 4;
  // macOS novelty voices that also exist in German
  if (/eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|bahh|fred|junior|ralph|kathy/i.test(v.name)) s -= 20;
  return s;
}

/**
 * The German voice to use: the user's choice if it is still available, otherwise the best German voice.
 * Returns null when the device has no German voice at all.
 */
export function pickGermanVoice<T extends VoiceInfo>(voices: T[], preferredURI?: string | null): T | null {
  const german = voices.filter(isGerman);
  if (preferredURI) {
    const chosen = german.find(v => (v.voiceURI || v.name) === preferredURI);
    if (chosen) return chosen;
  }
  if (!german.length) return null;
  return [...german].sort((a, b) => score(b) - score(a))[0];
}

/** German voices for a settings list, best first. */
export function germanVoices<T extends VoiceInfo>(voices: T[]): T[] {
  return voices.filter(isGerman).sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name));
}
