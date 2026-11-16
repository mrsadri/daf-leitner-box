/**
 * The browser side of playback: one reused <audio> element (unlocked by the Start tap, which is what makes iOS Safari
 * accept later play() calls), the Cache API prefetch, and Mode C with speechSynthesis through the character voice map.
 */
import type { Sentence } from '../../types/dictation';
import { speechService } from '../speechService';
import { buildVoiceMap, needsRecompute, voiceListHash, type CastMember, type StoredVoiceMap, type VoiceMap } from './voiceMap';
import { PlayError, type Sources } from './playback';
import cast from '../../../content/dictation/cast.json';

const CACHE_NAME = 'daf-dictation-audio-v1';
const MAX_CACHE_ENTRIES = 200;
const LOAD_TIMEOUT_MS = 8000;
const MAP_KEY = 'daf_dictation_voicemap_v1';
// 0.1 s of silence, so play() inside the user's tap counts as the unlock
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

let audio: HTMLAudioElement | null = null;
function element(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
  }
  return audio;
}

/** Call inside the Start button's click handler. */
export async function unlockAudio(): Promise<void> {
  try {
    const a = element();
    a.src = SILENT_WAV;
    a.muted = true;
    await a.play();
    a.pause();
  } catch {
    // the first real play() will report the problem
  } finally {
    if (audio) audio.muted = false;
  }
}

// ---- Cache API ---------------------------------------------------------------------------------------------------

async function cachedBlobUrl(url: string): Promise<string | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(url);
    return hit ? URL.createObjectURL(await hit.blob()) : null;
  } catch {
    return null;
  }
}

/** Prefetch the next sentences into the Cache API (LRU: the oldest entries go above 200). Failures are silent. */
export async function prefetch(urls: string[]): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const url of urls) {
      if (await cache.match(url)) continue;
      const res = await fetch(url);
      if (res.ok) await cache.put(url, res);
    }
    const keys = await cache.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_CACHE_ENTRIES))) await cache.delete(k);
  } catch {
    // offline or CORS: playback streams from the URL instead
  }
}

// ---- Mode C: device voices ----------------------------------------------------------------------------------------

let voiceMap: VoiceMap | null = null;
const members = (cast as { characters: CastMember[] }).characters;

function currentVoiceMap(): VoiceMap {
  const voices = speechService.availableVoices();
  if (voiceMap && !needsRecompute({ voiceListHash: voiceListHash(voices), map: voiceMap }, voices) && Object.keys(voiceMap).length) return voiceMap;
  try {
    const stored = JSON.parse(localStorage.getItem(MAP_KEY) ?? 'null') as StoredVoiceMap | null;
    if (stored && !needsRecompute(stored, voices)) return (voiceMap = stored.map);
  } catch { /* recompute */ }
  const map = buildVoiceMap(voices, members, speechService.preferredVoice());
  try { localStorage.setItem(MAP_KEY, JSON.stringify({ voiceListHash: voiceListHash(voices), map } satisfies StoredVoiceMap)); } catch { /* ignore */ }
  return (voiceMap = map);
}

export const hasGermanVoice = () => speechService.currentVoice() !== null;

function speakSegment(text: string, speaker: string, rate: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const synth = window.speechSynthesis;
    const map = currentVoiceMap();
    const entry = map[speaker] ?? map.NARRATOR;
    const voice = speechService.availableVoices().find(v => (v.voiceURI || v.name) === entry?.voiceURI) ?? speechService.currentVoice();
    const u = new SpeechSynthesisUtterance(text.replace(/[„“”‚‘«»"]/g, ''));
    u.lang = 'de-DE';
    if (voice) u.voice = voice;
    u.pitch = entry?.pitch ?? 1;
    u.rate = Math.min(2, Math.max(0.5, (entry?.rate ?? 1) * rate));
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === 'canceled' || e.error === 'interrupted' ? resolve() : reject(new PlayError('decode', e.error)));
    signal.addEventListener('abort', () => { synth.cancel(); resolve(); }, { once: true });
    synth.speak(u);
  });
}

// ---- the Sources the controller uses ------------------------------------------------------------------------------

export const browserSources: Sources = {
  async playFile(url, rate, signal) {
    const a = element();
    const blobUrl = await cachedBlobUrl(url);
    if (signal.aborted) { if (blobUrl) URL.revokeObjectURL(blobUrl); return; }
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(new PlayError('timeout')), LOAD_TIMEOUT_MS);
      const finish = (err?: PlayError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        a.onended = a.onerror = a.onplaying = null;
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (err) reject(err); else resolve();
      };
      a.onplaying = () => clearTimeout(timer);                       // loaded: the watchdog is only for starting
      a.onended = () => finish();
      a.onerror = () => finish(new PlayError(a.error?.code === 4 ? 'http404' : 'network'));
      signal.addEventListener('abort', () => { a.pause(); finish(); }, { once: true });
      a.src = blobUrl ?? url;
      a.playbackRate = rate;
      a.currentTime = 0;
      a.play().catch((e: unknown) => {
        const name = (e as { name?: string })?.name;
        finish(new PlayError(name === 'NotAllowedError' ? 'decode' : 'network', name));
      });
    });
  },

  async speak(sentence: Sentence, rate, signal) {
    const synth = window.speechSynthesis;
    synth.cancel();
    await new Promise(r => setTimeout(r, 50));                       // Chrome drops an utterance queued right after cancel()
    const parts = sentence.segments?.length ? sentence.segments : [{ text: sentence.text, speaker: sentence.speaker }];
    for (const p of parts) {
      if (signal.aborted) return;
      await speakSegment(p.text, p.speaker, rate, signal);
    }
  },
};
