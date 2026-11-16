/**
 * Playback controller (docs/dictation/05-audio.md, "Playback controller" and "Fallback order").
 * The browser pieces (one reused <audio> element, speechSynthesis, Cache API) are injected as `Sources`, so the logic
 * is unit-tested with fakes: one token guards everything, replays are debounced by 150 ms, and each request walks the
 * fallback chain with a circuit breaker.
 */
import type { Sentence } from '../../types/dictation';
import type { AudioIndex } from './content';
import { CircuitBreaker, RETRY_DELAY_MS, nextStepAfter, planSources, type AudioMode, type FailureKind } from './fallback.ts';

export class PlayError extends Error {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, message: string = kind) {
    super(message);
    this.name = 'PlayError';
    this.kind = kind;
  }
}

export interface Sources {
  /** Play one audio file to its end. Rejects with PlayError. Must stop quickly when the signal aborts. */
  playFile(url: string, rate: number, signal: AbortSignal): Promise<void>;
  /** Speak the sentence with device voices (Mode C), segment by segment. */
  speak(sentence: Sentence, rate: number, signal: AbortSignal): Promise<void>;
}

export interface PlayRequest {
  sentence: Sentence;
  storyId: string;
  selected: AudioMode;
  rate: number;
  indexes: { A: AudioIndex | null; B: AudioIndex | null };
  hasGermanVoice: boolean;
  mediaBase: string;
  /** The user pressed Replay (debounced) rather than the sentence starting by itself. */
  isReplay?: boolean;
}

export type PlayOutcome =
  | { status: 'played'; source: AudioMode; fallback: boolean; failures: { mode: AudioMode; kind: FailureKind }[] }
  | { status: 'failed'; failures: { mode: AudioMode; kind: FailureKind }[] }
  | { status: 'cancelled' };

export type PlayState = 'idle' | 'loading' | 'playing';

export interface ControllerDeps {
  sources: Sources;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  breaker?: CircuitBreaker;
  debounceMs?: number;
}

export const DEBOUNCE_MS = 150;

export class PlaybackController {
  private token = 0;
  private abort: AbortController | null = null;
  private lastReplayAt = -Infinity;
  private state: PlayState = 'idle';
  private listeners = new Set<(s: PlayState, source: AudioMode | null) => void>();
  private readonly deps: Required<Omit<ControllerDeps, 'breaker'>> & { breaker: CircuitBreaker };

  constructor(deps: ControllerDeps) {
    this.deps = {
      sources: deps.sources,
      now: deps.now ?? (() => Date.now()),
      wait: deps.wait ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms))),
      breaker: deps.breaker ?? new CircuitBreaker(),
      debounceMs: deps.debounceMs ?? DEBOUNCE_MS,
    };
  }

  onState(fn: (s: PlayState, source: AudioMode | null) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private set(s: PlayState, source: AudioMode | null = null) {
    this.state = s;
    this.listeners.forEach(fn => fn(s, source));
  }

  getState(): PlayState { return this.state; }

  /** Stop whatever plays and invalidate every pending callback (a stale token is ignored everywhere). */
  stop(): void {
    this.token++;
    this.abort?.abort();
    this.abort = null;
    if (this.state !== 'idle') this.set('idle');
  }

  async play(req: PlayRequest): Promise<PlayOutcome> {
    const now = this.deps.now();
    if (req.isReplay) {
      if (now - this.lastReplayAt < this.deps.debounceMs) return { status: 'cancelled' };
      this.lastReplayAt = now;
    }
    this.stop();
    const mine = ++this.token;
    const abort = new AbortController();
    this.abort = abort;
    const alive = () => this.token === mine && !abort.signal.aborted;

    const plan = planSources(req.selected, {
      hasKey: { A: !!req.indexes.A?.sentences[req.sentence.id], B: !!req.indexes.B?.sentences[req.sentence.id] },
      hasGermanVoice: req.hasGermanVoice,
      breaker: this.deps.breaker,
      now,
    });
    const failures: { mode: AudioMode; kind: FailureKind }[] = [];
    this.set('loading');

    for (const mode of plan) {
      let retried = false;
      for (;;) {
        try {
          if (mode === 'C') {
            this.set('playing', 'C');
            await this.deps.sources.speak(req.sentence, req.rate, abort.signal);
          } else {
            const entry = req.indexes[mode]!.sentences[req.sentence.id];
            this.set('loading', mode);
            await this.deps.sources.playFile(`${req.mediaBase}/audio/${mode}/${entry.key}.mp3`, req.rate, abort.signal);
          }
          if (!alive()) return { status: 'cancelled' };
          this.deps.breaker.recordSuccess(mode);
          this.set('idle');
          return { status: 'played', source: mode, fallback: mode !== req.selected, failures };
        } catch (e) {
          if (!alive()) return { status: 'cancelled' };
          const kind = e instanceof PlayError ? e.kind : 'network';
          // a missing key never reaches this point (planSources skips it); a 404 or decode error does not count as a dead network
          if (kind === 'network' || kind === 'timeout') this.deps.breaker.recordFailure(mode, this.deps.now());
          if (nextStepAfter(kind, retried) === 'retry') {
            retried = true;
            await this.deps.wait(RETRY_DELAY_MS);
            if (!alive()) return { status: 'cancelled' };
            continue;
          }
          failures.push({ mode, kind });
          break;
        }
      }
    }
    if (!alive()) return { status: 'cancelled' };
    this.set('idle');
    return { status: 'failed', failures };
  }
}
