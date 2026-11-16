/**
 * Audio source fallback chain and circuit breaker (docs/dictation/05-audio.md, "Fallback order"). Pure: time is passed in.
 */

export type AudioMode = 'A' | 'B' | 'C';

const CHAINS: Record<AudioMode, AudioMode[]> = {
  A: ['A', 'B', 'C'],
  B: ['B', 'A', 'C'],
  C: ['C', 'A', 'B'],
};

export const chainFor = (selected: AudioMode): AudioMode[] => [...CHAINS[selected]];

export type FailureKind = 'missing' | 'http404' | 'network' | 'timeout' | 'decode';

/** What to do after one failed attempt: go straight to the next source, or retry once after 500 ms first. */
export function nextStepAfter(kind: FailureKind, alreadyRetried: boolean): 'next' | 'retry' {
  if (kind === 'network' || kind === 'timeout') return alreadyRetried ? 'next' : 'retry';
  return 'next';                             // missing key, 404 and decode errors never retry
}

export const RETRY_DELAY_MS = 500;
export const TIMEOUT_MS = 8000;

/** After `threshold` consecutive failures a mode is skipped for `openMs`, so a dead network does not add 16 s to every sentence. */
export class CircuitBreaker {
  private failures = new Map<AudioMode, number>();
  private openUntil = new Map<AudioMode, number>();
  private readonly threshold: number;
  private readonly openMs: number;

  constructor(threshold = 3, openMs = 5 * 60 * 1000) {      // no parameter properties: node's type stripping rejects them
    this.threshold = threshold;
    this.openMs = openMs;
  }

  recordFailure(mode: AudioMode, now: number): void {
    const n = (this.failures.get(mode) ?? 0) + 1;
    this.failures.set(mode, n);
    if (n >= this.threshold) this.openUntil.set(mode, now + this.openMs);
  }

  recordSuccess(mode: AudioMode): void {
    this.failures.set(mode, 0);
    this.openUntil.delete(mode);
  }

  isOpen(mode: AudioMode, now: number): boolean {
    const until = this.openUntil.get(mode);
    if (until === undefined) return false;
    if (now >= until) {                      // half-open: one more try, and the count starts again
      this.openUntil.delete(mode);
      this.failures.set(mode, this.threshold - 1);
      return false;
    }
    return true;
  }
}

export interface PlanContext {
  /** Does the audio index of the story have a key for this sentence in mode A or B? */
  hasKey: { A: boolean; B: boolean };
  /** currentVoice() is not null: Mode C needs a German device voice. */
  hasGermanVoice: boolean;
  breaker: CircuitBreaker;
  now: number;
}

/** The sources to try for one sentence, in order. An empty list means the chain is exhausted from the start (UI state 16). */
export function planSources(selected: AudioMode, ctx: PlanContext): AudioMode[] {
  return chainFor(selected).filter(mode => {
    if (mode === 'C') return ctx.hasGermanVoice && !ctx.breaker.isOpen('C', ctx.now);
    return ctx.hasKey[mode] && !ctx.breaker.isOpen(mode, ctx.now);
  });
}

/** True when the source that played is not the one the learner selected (the player shows an unobtrusive note). */
export const isFallback = (selected: AudioMode, played: AudioMode) => selected !== played;
