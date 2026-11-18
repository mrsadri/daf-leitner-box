/**
 * Pronunciation with the browser's German voice (Web Speech API): voice choice, rate, and a promise per utterance.
 */
import { speechText } from './speechText';
import { pickGermanVoice, germanVoices } from './voices';

/**
 * German pronunciation with the Web Speech API.
 *
 * Browsers (desktop Chrome in particular) load their voice list asynchronously. Speaking before it
 * has arrived, or without an explicit voice, makes the browser fall back to its default voice, which
 * reads German words with an English accent. So we always set a German voice, waiting briefly for
 * the list when needed. The chosen voice can be changed in settings (stored per device, because
 * every device has different voices).
 */

const VOICE_KEY = 'daf_german_voice';
const VOICE_WAIT_MS = 1500;

function readPreferred(): string | null {
  try {
    return localStorage.getItem(VOICE_KEY);
  } catch {
    return null;
  }
}

export class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private finishActive: (() => void) | null = null;
  private generation = 0;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.refresh();
      this.synth.addEventListener?.('voiceschanged', () => this.refresh());
    }
  }

  private refresh() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    this.listeners.forEach(fn => fn());
  }

  /** Resolve once the voice list is available (or after a short timeout). */
  private ready(): Promise<void> {
    if (!this.synth) return Promise.resolve();
    if (!this.voices.length) this.voices = this.synth.getVoices();
    if (this.voices.length) return Promise.resolve();
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer);
        this.listeners.delete(done);
        resolve();
      };
      const timer = setTimeout(done, VOICE_WAIT_MS);
      this.listeners.add(done);
    });
  }

  /** The voice that will be used, or null if this device has no German voice. */
  public currentVoice(): SpeechSynthesisVoice | null {
    return pickGermanVoice(this.voices, readPreferred());
  }

  /** German voices on this device, best first. */
  public availableVoices(): SpeechSynthesisVoice[] {
    return germanVoices(this.voices);
  }

  public setPreferredVoice(voiceURI: string | null) {
    try {
      if (voiceURI) localStorage.setItem(VOICE_KEY, voiceURI);
      else localStorage.removeItem(VOICE_KEY);
    } catch {
      // storage unavailable: the choice applies until reload
    }
    this.listeners.forEach(fn => fn());
  }

  public preferredVoice(): string | null {
    return readPreferred();
  }

  /** Subscribe to voice list / choice changes (for the settings page). */
  public onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Invalidate a pending voice load and settle an interrupted utterance even on browsers without onend. */
  public cancel(): void {
    this.generation += 1;
    this.finishActive?.();
    this.activeUtterance = null;
    try { this.synth?.cancel(); } catch { /* unavailable audio device */ }
  }

  public async speak(text: string, rate: number = 0.9): Promise<void> {
    if (!this.synth || !text) return;
    // Only the German part ("Wie heißt du? · اسمت چیه؟", "die Partner / die Partnerinnen")
    const cleanText = speechText(text);
    if (!cleanText) return;

    this.cancel();
    const generation = this.generation;
    await this.ready();
    if (generation !== this.generation) return;
    return new Promise(resolve => {
      let complete = () => resolve();
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voice = this.currentVoice();
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        } else {
          utterance.lang = 'de-DE';
        }
        utterance.rate = rate;
        utterance.pitch = 1.0;
        const finish = () => {
          clearTimeout(timeout);
          if (this.finishActive === finish) {
            this.finishActive = null;
            this.activeUtterance = null;
          }
          resolve();
        };
        const timeout = setTimeout(() => {
          if (this.finishActive === finish) {
            finish();
            try { this.synth?.cancel(); } catch { /* device error */ }
          }
        }, Math.max(15000, cleanText.length * 200));
        complete = finish;
        this.finishActive = finish;
        this.activeUtterance = utterance;
        utterance.onend = finish;
        utterance.onerror = finish;
        this.synth!.speak(utterance);
      } catch {
        complete();
      }
    });
  }

  public isSupported(): boolean {
    return this.synth !== null;
  }
}

export const speechService = new SpeechService();
