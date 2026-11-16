/**
 * Mode C: a deterministic, persisted map from story characters to device voices plus pitch and rate offsets
 * (docs/dictation/05-audio.md, "Mode C"). Pure (no browser APIs), unit-tested in tests/dictationVoiceMap.test.ts.
 * The same character gets the same voice across stories and sessions because the cast is walked in cast.json order.
 */
import type { VoiceInfo } from '../voices.ts';

export interface CastMember {
  id: string;
  sex: 'f' | 'm' | 'n';
  gender?: string;            // 'c' marks a child
  age?: number;
}

export interface MappedVoice {
  voiceURI: string;           // voiceURI, or the name when the device gives none
  pitch: number;
  rate: number;
}

export type VoiceMap = Record<string, MappedVoice>;

export interface StoredVoiceMap {
  voiceListHash: string;
  map: VoiceMap;
}

const FEMALE_NAMES = /\b(anna|petra|marlene|vicki|katja|helena|hedda|amala|sabine|vicki|marie|nicole|elke|steffi)\b/i;
const MALE_NAMES = /\b(markus|yannick|stefan|conrad|hans|viktor|jonas|reed|thomas|klaus|ralf|daniel)\b/i;

export function voiceGender(v: VoiceInfo): 'f' | 'm' | 'n' {
  if (FEMALE_NAMES.test(v.name)) return 'f';
  if (MALE_NAMES.test(v.name)) return 'm';
  return 'n';
}

const idOf = (v: VoiceInfo) => v.voiceURI || v.name;

/** FNV-1a: a stable tie-breaker that does not depend on story order or the session. */
export function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function voiceListHash(voices: VoiceInfo[]): string {
  return stableHash(voices.map(idOf).sort().join('|')).toString(16);
}

type VoiceClass = 'narrator' | 'child' | 'young-woman' | 'older-woman' | 'elder' | 'man';

export function voiceClass(c: CastMember): VoiceClass {
  if (c.sex === 'n') return 'narrator';
  if (c.gender === 'c' || (c.age !== undefined && c.age < 13)) return 'child';
  if (c.age !== undefined && c.age >= 70) return 'elder';
  if (c.sex === 'f') return c.age !== undefined && c.age >= 36 ? 'older-woman' : 'young-woman';
  return 'man';
}

const BASE_PITCH: Record<VoiceClass, number> = { narrator: 1.0, child: 1.35, 'young-woman': 1.1, 'older-woman': 0.88, elder: 0.82, man: 0.92 };
const BASE_RATE: Record<VoiceClass, number> = { narrator: 0.92, child: 1.0, 'young-woman': 1.0, 'older-woman': 1.0, elder: 0.92, man: 1.0 };
export const MIN_PITCH_GAP = 0.15;
export const MIN_RATE_GAP = 0.05;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * @param voices German voices only, best first (the output of `germanVoices()`)
 * @param cast   all characters in cast.json order; NARRATOR uses `narratorVoiceURI` or the best voice
 */
export function buildVoiceMap(voices: VoiceInfo[], cast: readonly CastMember[], narratorVoiceURI?: string | null): VoiceMap {
  if (voices.length === 0) return {};
  const usage = new Map<string, number>(voices.map(v => [idOf(v), 0]));
  const assigned: { member: CastMember; voice: VoiceInfo }[] = [];

  const narratorVoice = voices.find(v => idOf(v) === narratorVoiceURI) ?? voices[0];

  for (const member of cast) {
    if (member.sex === 'n') {
      assigned.push({ member, voice: narratorVoice });
      usage.set(idOf(narratorVoice), (usage.get(idOf(narratorVoice)) ?? 0) + 1);
      continue;
    }
    // matching gender first; neutral voices serve any; if nothing matches use every voice
    let pool = voices.filter(v => voiceGender(v) === member.sex || voiceGender(v) === 'n');
    const exact = voices.filter(v => voiceGender(v) === member.sex);
    if (exact.length) pool = exact.concat(voices.filter(v => voiceGender(v) === 'n'));
    if (!pool.length) pool = voices;
    const least = Math.min(...pool.map(v => usage.get(idOf(v)) ?? 0));
    const candidates = pool.filter(v => (usage.get(idOf(v)) ?? 0) === least);
    const voice = candidates[stableHash(member.id) % candidates.length];
    usage.set(idOf(voice), (usage.get(idOf(voice)) ?? 0) + 1);
    assigned.push({ member, voice });
  }

  // offsets: base by class, then spread the characters that share a voice
  const byVoice = new Map<string, { member: CastMember; voice: VoiceInfo }[]>();
  for (const a of assigned) byVoice.set(idOf(a.voice), [...(byVoice.get(idOf(a.voice)) ?? []), a]);

  const map: VoiceMap = {};
  for (const group of byVoice.values()) {
    const rows = group.map(({ member, voice }) => {
      const cls = voiceClass(member);
      return { member, voice, pitch: BASE_PITCH[cls], rate: BASE_RATE[cls] };
    });
    // enforce the minimum distance between any two characters on the same voice: sort by pitch, push apart
    rows.sort((a, b) => a.pitch - b.pitch || a.member.id.localeCompare(b.member.id));
    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i].pitch - rows[i - 1].pitch;
      if (gap < MIN_PITCH_GAP) rows[i].pitch = rows[i - 1].pitch + MIN_PITCH_GAP;
    }
    // a run pushed above the clamp is shifted down as a whole (keeps the gaps)
    const top = rows[rows.length - 1].pitch;
    if (top > 1.5) for (const r of rows) r.pitch -= top - 1.5;
    // rate: alternate +/- steps along the same order so neighbouring characters differ as well
    rows.forEach((r, i) => { r.rate = r.rate + (i % 2 === 1 ? MIN_RATE_GAP : 0); });
    for (const r of rows) {
      map[r.member.id] = { voiceURI: idOf(r.voice), pitch: round2(clamp(r.pitch, 0.7, 1.5)), rate: round2(clamp(r.rate, 0.6, 1.3)) };
    }
  }
  return map;
}

/** Characters that sound alike (same voice, pitch within 0.12, rate within 0.05) although they appear in the same sequence. */
export function findClashes(map: VoiceMap, speakersInSequence: readonly string[]): [string, string][] {
  const out: [string, string][] = [];
  const ids = [...new Set(speakersInSequence)].filter(id => map[id]);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = map[ids[i]], b = map[ids[j]];
      if (a.voiceURI === b.voiceURI && Math.abs(a.pitch - b.pitch) < 0.12 && Math.abs(a.rate - b.rate) < 0.05) out.push([ids[i], ids[j]]);
    }
  }
  return out;
}

/** Recompute only when the list of voices changed (which includes a mapped voice disappearing); otherwise keep the stored map. */
export function needsRecompute(stored: StoredVoiceMap | null, voices: VoiceInfo[]): boolean {
  return !stored || stored.voiceListHash !== voiceListHash(voices);
}
