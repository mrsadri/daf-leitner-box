import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, RotateCcw, ArrowRight, SkipForward, Check } from 'lucide-react';
import type { GrammarFile, Sentence, Sequence, Story } from '../../types/dictation';
import type { AppSettings, LeitnerCard } from '../../types/leitner';
import { useI18n } from '../../i18n/I18nProvider';
import { STORY_MEDIA_BASE } from '../../config';
import { compare, type CheckResult, type Mark } from '../../services/dictation/compare';
import { shouldSubmit, needsManualSubmitHint } from '../../services/dictation/submitTrigger';
import { resolveTap, type WordTarget } from '../../services/dictation/wordLink';
import { tokenize } from '../../services/dictation/normalize';
import { storyPosition, type SentenceProgress } from '../../services/dictation/progressMerge';
import { DictationQueue, clearDraft, readDraft, writeDraft } from '../../services/dictation/syncCore';
import { audioController } from '../../services/dictation/audioController';
import { hasGermanVoice, prefetch } from '../../services/dictation/browserSources';
import { drawerOpenDefault, keyboardIsUp, pickDrawerContent } from '../../services/dictation/grammarDrawer';
import type { AudioIndex } from '../../services/dictation/content';
import type { AudioMode } from '../../services/dictation/fallback';
import abbreviationsFile from '../../../content/dictation/abbreviations.json';
import cast from '../../../content/dictation/cast.json';
import { FeedbackText, useSummaryLine } from './FeedbackText';
import { UmlautBar } from './UmlautBar';
import { WordSheet } from './WordSheet';
import { GrammarDrawer, GrammarToggle, useMediaQuery } from './GrammarDrawer';

const ABBREVIATIONS = (abbreviationsFile as { abbreviations: string[] }).abbreviations;
const NAMES = new Map((cast as { characters: { id: string; name: string }[] }).characters.map(c => [c.id, c.name]));

interface Props {
  story: Story;
  sequence: Sequence;
  startIndex: number;
  userId: string;
  queue: DictationQueue;
  settings: AppSettings;
  cards: LeitnerCard[];
  indexes: { A: AudioIndex | null; B: AudioIndex | null };
  grammar: GrammarFile | null;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onCardsChanged: () => void;
  onOpenAudioSettings: () => void;
  onSequenceDone: () => void;
  onExit: () => void;
}

type Phase = 'typing' | 'correct' | 'mistakes';
type Finish = 'correct' | 'moved' | 'skipped';

const nowIso = () => new Date().toISOString();

export const SentenceStage: React.FC<Props> = ({
  story, sequence, startIndex, userId, queue, settings, cards, indexes, grammar, onUpdateSettings, onCardsChanged, onOpenAudioSettings, onSequenceDone, onExit
}) => {
  const { t, lang, num } = useI18n();
  const sentences = sequence.sentences;
  const [index, setIndex] = useState(Math.min(startIndex, sentences.length - 1));
  const sentence: Sentence = sentences[index];
  const [value, setValue] = useState('');
  const [phase, setPhase] = useState<Phase>('typing');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [praise, setPraise] = useState('');
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'loading'>('idle');
  const [source, setSource] = useState<AudioMode | null>(null);
  const [fallbackNote, setFallbackNote] = useState<AudioMode | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [audioFailed, setAudioFailed] = useState(false);
  const [sheet, setSheet] = useState<{ target: Exclude<WordTarget, { kind: 'none' }>; word: string } | null>(null);
  const [live, setLive] = useState('');
  // grammar drawer: the trigger is the last sentence the learner entered (submitted, Next, skipped), never a replay
  const [entered, setEntered] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kbUp, setKbUp] = useState(false);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const composing = useRef(false);
  const lastPraise = useRef(-1);
  const draftKeys = useCallback(() => Object.keys(localStorage), []);

  const mode: AudioMode = settings.dictationAudioMode ?? 'B';
  const names = useMemo(() => new Set((story.names ?? [])), [story.names]);
  const ownedIds = useMemo(() => new Set(cards.map(c => c.id)), [cards]);
  const summaryLine = useSummaryLine(result ?? { correct: true, typed: '', marks: [], summary: { total: 0, byCategory: {} as never } });

  // ---- progress -------------------------------------------------------------------------------------------------
  const row = useCallback((s: Sentence): SentenceProgress => queue.getRows().get(s.id) ?? {
    storyId: story.id, sentenceId: s.id, sentenceOrder: 0, status: 'heard', attempts: 0, mistakes: 0, skips: 0, listens: 0,
    leitnerActions: 0, contentHash: s.hash, firstCorrectAt: null, lastAttemptAt: null,
  }, [queue, story.id]);

  const orderOf = useCallback((s: Sentence) => {
    let n = 0;
    for (const q of story.sequences) for (const x of q.sentences) { if (x.id === s.id) return n; n++; }
    return n;
  }, [story]);

  const save = useCallback((s: Sentence, patch: Partial<SentenceProgress>) => {
    const cur = row(s);
    const next: SentenceProgress = { ...cur, ...patch, sentenceOrder: orderOf(s), contentHash: s.hash };
    queue.record(next);
    const pos = storyPosition(story, queue.getRows());
    queue.setStory({ storyId: story.id, finishedCount: pos.finishedCount, totalCount: pos.totalCount, lastSentenceId: s.id, contentVersion: story.contentVersion });
  }, [row, orderOf, queue, story]);

  // ---- audio ----------------------------------------------------------------------------------------------------
  const play = useCallback(async (s: Sentence, isReplay: boolean) => {
    setAudioFailed(false);
    const out = await audioController.play({
      sentence: s, storyId: story.id, selected: mode, rate: settings.speechRate, indexes,
      hasGermanVoice: hasGermanVoice(), mediaBase: STORY_MEDIA_BASE, isReplay,
    });
    if (out.status === 'played') {
      setSource(out.source);
      setFallbackNote(out.fallback ? out.source : null);
      setFailedCount(0);
      save(s, { listens: row(s).listens + 1 });
    } else if (out.status === 'failed') {
      setAudioFailed(true);
      setFailedCount(c => c + 1);
    }
  }, [mode, settings.speechRate, indexes, story.id, save, row]);

  // keep the input visible when the on-screen keyboard opens (visualViewport shrinks)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => { setKbUp(keyboardIsUp(window.innerHeight, vv.height)); textRef.current?.scrollIntoView({ block: 'nearest' }); };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => audioController.onState((st) => { setPlayState(st); }), []);
  useEffect(() => () => audioController.stop(), []);

  // a new sentence: restore the draft, play it, prefetch the next two
  useEffect(() => {
    const draft = readDraft(localStorage, userId, sentence.id, sentence.hash) ?? '';
    setValue(draft); setPhase('typing'); setResult(null); setSheet(null); setFallbackNote(null);
    void play(sentence, false);
    const urls = [1, 2].map(k => sentences[index + k]).filter(Boolean)
      .map(s => indexes.B?.sentences[s.id]?.key).filter(Boolean).map(key => `${STORY_MEDIA_BASE}/audio/B/${key}.mp3`);
    if (urls.length) void prefetch(urls);
    requestAnimationFrame(() => textRef.current?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentence.id]);

  // ---- checking -------------------------------------------------------------------------------------------------
  const submit = useCallback((text: string) => {
    if (!text.trim()) return;
    setEntered(sentence.id);
    const r = compare(text, sentence.text);
    const cur = row(sentence);
    if (r.correct) {
      const idx = Math.floor(Math.random() * t.dictation.feedback.praise.length);
      const pick = idx === lastPraise.current ? (idx + 1) % t.dictation.feedback.praise.length : idx;
      lastPraise.current = pick;
      setPraise(t.dictation.feedback.praise[pick]);
      setLive(t.dictation.feedback.praise[pick]);
      setPhase('correct');
      save(sentence, { status: 'correct', attempts: cur.attempts + 1, firstCorrectAt: cur.firstCorrectAt ?? nowIso(), lastAttemptAt: nowIso() });
      clearDraft(localStorage, userId, sentence.id);
      requestAnimationFrame(() => nextRef.current?.focus());
    } else {
      setPhase('mistakes');
      const rank = cur.status === 'correct' || cur.status === 'moved' || cur.status === 'skipped' ? cur.status : 'attempted';
      save(sentence, { status: rank, attempts: cur.attempts + 1, mistakes: cur.mistakes + 1, lastAttemptAt: nowIso() });
    }
    setResult(r);
  }, [row, sentence, save, t, userId]);

  useEffect(() => {
    if (result && !result.correct) setLive(summaryLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    const next = el.value.replace(/[\r\n]+/g, ' ');
    setValue(next);
    if (phase !== 'typing') { setPhase('typing'); setResult(null); }       // editing clears the marks
    writeDraft(localStorage, userId, draftKeys, sentence.id, sentence.hash, next, Date.now());
    const ne = e.nativeEvent as InputEvent;
    const atEnd = el.selectionStart === next.length && el.selectionEnd === next.length;
    if (shouldSubmit({
      inputType: ne.inputType ?? '', inserted: ne.data ?? null, value: next, caretAtEnd: atEnd, composing: composing.current,
      expected: { text: sentence.text, quoteBalance: sentence.quoteBalance, flags: sentence.flags }, abbreviations: ABBREVIATIONS,
    })) submit(next);
  };

  const insertChar = (ch: string) => {
    const el = textRef.current;
    if (!el) return;
    el.focus();
    const start = el.selectionStart ?? value.length, end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    setValue(next);
    if (phase !== 'typing') { setPhase('typing'); setResult(null); }
    writeDraft(localStorage, userId, draftKeys, sentence.id, sentence.hash, next, Date.now());
    requestAnimationFrame(() => { el.setSelectionRange(start + ch.length, start + ch.length); });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { void play(sentence, true); return; }
      if (!e.shiftKey) submit(value);
    }
  };

  // ---- moving on ------------------------------------------------------------------------------------------------
  const advance = useCallback((finish: Finish) => {
    const cur = row(sentence);
    setEntered(sentence.id);
    if (finish === 'skipped') save(sentence, { status: 'skipped', skips: cur.skips + 1 });
    else if (finish === 'moved') save(sentence, { status: cur.status === 'correct' ? 'correct' : 'moved' });
    clearDraft(localStorage, userId, sentence.id);
    audioController.stop();
    if (index + 1 >= sentences.length) { void queue.flush(); onSequenceDone(); return; }
    setIndex(index + 1);
  }, [row, sentence, save, userId, index, sentences.length, queue, onSequenceDone]);

  // ---- word sheet -----------------------------------------------------------------------------------------------
  const onMarkTap = (mark: Mark) => {
    const target = resolveTap(mark, sentence, ownedIds, names);
    if (target.kind === 'none' || mark.expectedTokenIndex === null) return;
    const tok = tokenize(sentence.text)[mark.expectedTokenIndex];
    setSheet({ target, word: tok.text });
  };

  // ---- rendering ------------------------------------------------------------------------------------------------
  const speaker = sentence.speaker === 'NARRATOR' ? t.dictation.stage.narrator : NAMES.get(sentence.speaker) ?? sentence.speaker;
  const finished = sentences.slice(0, index);
  const isLast = index + 1 >= sentences.length;
  const hint = sentence.flags.includes('digits') ? t.dictation.stage.digitsHint : needsManualSubmitHint(sentence.flags) ? t.dictation.stage.manualSubmitHint : '';
  const pulse = playState === 'playing' || playState === 'loading';
  const trigger = entered ? sentences.find(x => x.id === entered) ?? null : null;
  const drawerOpen = drawerOpenDefault(settings.dictationGrammarOpen, typeof window === 'undefined' ? 0 : window.innerWidth);
  const drawerCount = grammar ? (() => { const c = pickDrawerContent(grammar, story.block, sequence, trigger); return c.fresh.length + c.again.length; })() : 0;
  const drawerId = 'dictation-grammar';

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
    <div className="space-y-4 min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2 text-sm text-slate-600 dark:text-slate-300">
        <button type="button" onClick={() => { audioController.stop(); void queue.flush(); onExit(); }} className="min-h-11 px-2 -mx-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">{t.dictation.back}</button>
        <span className="flex items-center gap-2">
          {grammar && <GrammarToggle open={drawerOpen} count={drawerCount} controls={drawerId}
            onToggle={() => onUpdateSettings({ dictationGrammarOpen: !drawerOpen })} />}
          <span className="font-mono-num" aria-hidden>{num(index + 1)} / {num(sentences.length)}</span>
        </span>
      </div>

      {finished.length > 0 && (
        <ol aria-label={t.dictation.stage.history} className="space-y-1 max-h-48 overflow-y-auto pe-1">
          {finished.map(s => {
            const st = queue.getRows().get(s.id)?.status;
            return (
              <li key={s.id}>
                <button type="button" dir="ltr" lang="de" onClick={() => void play(s, true)} aria-label={`${t.dictation.stage.replayHistory}: ${s.text}`}
                  className="w-full text-start text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg px-2 py-1.5">
                  {s.text}{st === 'skipped' && <span className="ms-2 text-xs text-slate-500 dark:text-slate-400" dir={lang === 'fa' ? 'rtl' : 'ltr'}>· {t.dictation.stage.skippedMark}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3" aria-label={t.dictation.stage.inputLabel}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            <Volume2 className={`w-5 h-5 text-indigo-600 ${pulse ? 'motion-safe:animate-pulse' : ''}`} aria-hidden />
            <span dir="ltr" lang="de" style={{ unicodeBidi: 'isolate' }}>{speaker}</span>
            {source && <span className="text-xs text-slate-500 dark:text-slate-400">· {t.dictation.stage.source[source]}</span>}
          </span>
          <button type="button" onClick={() => void play(sentence, true)} aria-label={t.dictation.stage.replay}
            className="min-h-11 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500">
            <RotateCcw className="w-4 h-4 rtl:-scale-x-100" aria-hidden />{t.dictation.stage.replay}
          </button>
        </div>

        {fallbackNote && <p className="text-xs text-amber-700 dark:text-amber-300" role="status">{t.dictation.stage.fallbackNote(t.dictation.stage.source[fallbackNote])}</p>}
        {audioFailed && (
          <div role="alert" className="rounded-lg bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 text-sm p-3 space-y-2">
            <p>{t.dictation.stage.audioFailed}{failedCount >= 3 ? ` ${t.dictation.stage.audioFailedSkip}` : ''}</p>
            <div className="flex gap-3">
              <button type="button" className="font-semibold underline" onClick={() => void play(sentence, false)}>{t.dictation.retry}</button>
              <button type="button" className="font-semibold underline" onClick={onOpenAudioSettings}>{t.dictation.stage.openSettings}</button>
            </div>
          </div>
        )}

        <textarea
          ref={textRef}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={() => { composing.current = false; }}
          rows={2}
          dir="ltr" lang="de"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
          enterKeyHint="send" inputMode="text" name="dictation-answer"
          aria-label={t.dictation.stage.inputLabel}
          placeholder={t.dictation.stage.placeholder}
          className="w-full resize-none rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-lg leading-8 text-start text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        />
        {/* phones: the bar sticks to the bottom of the visible area, directly above the keyboard */}
        <div className="sticky bottom-0 z-10 -mx-4 px-4 py-2 bg-white/95 dark:bg-slate-900/95 sm:static sm:mx-0 sm:p-0 sm:bg-transparent sm:dark:bg-transparent">
          <UmlautBar onInsert={insertChar} />
        </div>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}

        {phase === 'mistakes' && result && (
          <div className="space-y-2">
            <FeedbackText result={result} onMarkTap={onMarkTap} />
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{summaryLine}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.dictation.feedback.tapHint}</p>
          </div>
        )}
        {phase === 'correct' && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3">
            <p className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200"><Check className="w-5 h-5" aria-hidden />{praise}</p>
            <p dir="ltr" lang="de" className="text-start text-lg mt-1 text-emerald-900 dark:text-emerald-100">{sentence.text}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => submit(value)} disabled={!value.trim()}
            className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-40 hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500">{t.dictation.stage.check}</button>
          <button ref={nextRef} type="button" onClick={() => advance(phase === 'correct' ? 'correct' : 'moved')} disabled={phase === 'typing'}
            className="min-h-11 px-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500">
            {t.dictation.stage.next}<ArrowRight className="w-4 h-4 rtl:-scale-x-100" aria-hidden />
          </button>
          <button type="button" onClick={() => advance('skipped')}
            className="min-h-11 px-4 inline-flex items-center gap-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500 ms-auto">
            <SkipForward className="w-4 h-4 rtl:-scale-x-100" aria-hidden />{t.dictation.stage.skip}
          </button>
        </div>
        {isLast && phase !== 'typing' && <p className="sr-only">{t.dictation.end.sequenceTitle}</p>}
      </section>

      <div aria-live="polite" className="sr-only">{live}</div>

      {sheet && (
        <WordSheet target={sheet.target} expectedWord={sheet.word} sentenceText={sentence.text} lessons={story.lessons}
          onClose={() => setSheet(null)} onCardsChanged={onCardsChanged} />
      )}
    </div>
    {grammar && (
      <GrammarDrawer file={grammar} storyBlock={story.block} sequence={sequence} trigger={trigger} desktop={desktop} open={drawerOpen}
        sheetOpen={sheetOpen && !kbUp} onSheetOpenChange={setSheetOpen} id={drawerId} />
    )}
    </div>
  );
};
