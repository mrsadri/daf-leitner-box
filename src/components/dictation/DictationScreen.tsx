import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Headphones, PlayCircle, CheckCircle2, ImageOff } from 'lucide-react';
import type { AppSettings, LeitnerCard, UserProfile } from '../../types/leitner';
import type { GrammarFile, Sequence, Story, StoryIndex, StoryIndexEntry } from '../../types/dictation';
import { useI18n } from '../../i18n/I18nProvider';
import { STORY_MEDIA_BASE } from '../../config';
import { loadAudioIndex, loadGrammar, loadIndex, loadStory, type AudioIndex } from '../../services/dictation/content';
import { sequenceCounts, storyPosition, type SentenceProgress } from '../../services/dictation/progressMerge';
import { dictationQueue } from '../../services/dictationSync';
import { unlockAudio } from '../../services/dictation/browserSources';
import { audioController } from '../../services/dictation/audioController';
import type { FlagState } from '../../services/dictation/flag';
import { BetaBadge } from './BetaBadge';
import { SentenceStage } from './SentenceStage';

interface Props {
  profile: UserProfile;
  cards: LeitnerCard[];
  settings: AppSettings;
  flag: FlagState;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onCardsChanged: () => void;
  onOpenSettings: () => void;
}

type View =
  | { name: 'home' }
  | { name: 'detail'; entry: StoryIndexEntry }
  | { name: 'sequence'; entry: StoryIndexEntry; seq: number }              // intro screen
  | { name: 'stage'; entry: StoryIndexEntry; seq: number; start: number }
  | { name: 'sequenceEnd'; entry: StoryIndexEntry; seq: number }
  | { name: 'storyEnd'; entry: StoryIndexEntry };

const Spinner: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-16 text-center text-slate-500 dark:text-slate-400" role="status">{text}</div>
);

const Placeholder: React.FC<{ title: string; note: string }> = ({ title, note }) => (
  <div className="aspect-[4/3] w-full max-w-[480px] rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 p-4 text-center">
    <ImageOff className="w-8 h-8" aria-hidden />
    <span className="font-semibold">{title}</span>
    <span className="text-xs">{note}</span>
  </div>
);

export const DictationScreen: React.FC<Props> = ({ profile, cards, settings, flag, onUpdateSettings, onCardsChanged, onOpenSettings }) => {
  const { t, lang, num } = useI18n();
  const queue = useMemo(() => dictationQueue(profile.id), [profile.id]);
  const [view, setView] = useState<View>({ name: 'home' });
  const [index, setIndex] = useState<StoryIndex | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [audioIdx, setAudioIdx] = useState<{ A: AudioIndex | null; B: AudioIndex | null }>({ A: null, B: null });
  const [grammar, setGrammar] = useState<GrammarFile | null>(null);
  const [error, setError] = useState<'offline' | 'failed' | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReadonlyMap<string, SentenceProgress>>(queue.getRows());
  const [notice, setNotice] = useState(false);
  const [intro, setIntro] = useState(false);

  const refreshRows = useCallback(() => setRows(new Map(queue.getRows())), [queue]);

  useEffect(() => queue.onUnavailableNotice(() => setNotice(true)), [queue]);
  useEffect(() => { if (!settings.dictationIntroSeen) setIntro(true); }, [settings.dictationIntroSeen]);

  const loadHome = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const idx = await loadIndex();
      setIndex(idx);
      await queue.load(idx.stories.map(s => s.id));
      refreshRows();
    } catch {
      setError(navigator.onLine === false ? 'offline' : 'failed');
    } finally {
      setLoading(false);
    }
  }, [queue, refreshRows]);

  useEffect(() => { void loadHome(); }, [loadHome]);
  useEffect(() => { const off = () => audioController.stop(); return off; }, []);

  const openStory = useCallback(async (entry: StoryIndexEntry, next: (s: Story) => View) => {
    setLoading(true); setError(null);
    try {
      const [s, a, b, g] = await Promise.all([loadStory(entry.file), loadAudioIndex(entry.id, 'A'), loadAudioIndex(entry.id, 'B'), loadGrammar(entry.id)]);
      setStory(s); setAudioIdx({ A: a, B: b }); setGrammar(g);
      setView(next(s));
    } catch {
      setError(navigator.onLine === false ? 'offline' : 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // ---- states 19, 1, 2 ------------------------------------------------------------------------------------------
  if (!flag.enabled) {
    return <div className="max-w-xl mx-auto py-16 text-center text-slate-700 dark:text-slate-200" role="status">{t.dictation.paused}</div>;
  }

  const Header = (
    <div className="flex items-center gap-3 mb-5">
      <Headphones className="w-6 h-6 text-indigo-600" aria-hidden />
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.dictation.title} <BetaBadge /></h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t.dictation.subtitle}</p>
      </div>
    </div>
  );

  const Banner = (
    <>
      {flag.preview && <p className="mb-3 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 text-xs px-3 py-2">{t.dictation.preview}</p>}
      {notice && <p className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs px-3 py-2" role="status">{t.dictation.progressLocalOnly}</p>}
    </>
  );

  const IntroDialog = intro ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-labelledby="dict-intro">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
        <h2 id="dict-intro" className="text-lg font-bold text-slate-900 dark:text-white mb-3">{t.dictation.intro.title}</h2>
        <ul className="list-disc ps-5 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
          {t.dictation.intro.points.map(p => <li key={p}>{p}</li>)}
        </ul>
        <button type="button" autoFocus className="mt-4 w-full min-h-11 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
          onClick={() => { setIntro(false); onUpdateSettings({ dictationIntroSeen: true }); }}>{t.dictation.intro.ok}</button>
      </div>
    </div>
  ) : null;

  const errorBlock = error && (
    <div className="py-10 text-center space-y-3" role="alert">
      <p className="text-slate-700 dark:text-slate-200">{error === 'offline' ? t.dictation.loadErrorOffline : t.dictation.loadError}</p>
      <button type="button" onClick={() => { void loadHome(); setView({ name: 'home' }); }} className="min-h-11 px-5 rounded-xl bg-indigo-600 text-white font-semibold">{t.dictation.retry}</button>
    </div>
  );

  // ---- stage -----------------------------------------------------------------------------------------------------
  if (view.name === 'stage' && story) {
    const seq = story.sequences[view.seq];
    return (
      <div className="max-w-2xl lg:max-w-5xl mx-auto pb-24">
        {IntroDialog}
        <SentenceStage
          key={seq.id}
          story={story} sequence={seq} startIndex={view.start} userId={profile.id} queue={queue} settings={settings} cards={cards}
          indexes={audioIdx} grammar={grammar} onUpdateSettings={onUpdateSettings} onCardsChanged={onCardsChanged} onOpenAudioSettings={onOpenSettings}
          onSequenceDone={() => { refreshRows(); setView(view.seq + 1 >= story.sequences.length && storyPosition(story, queue.getRows()).completed ? { name: 'storyEnd', entry: view.entry } : { name: 'sequenceEnd', entry: view.entry, seq: view.seq }); }}
          onExit={() => { refreshRows(); setView({ name: 'detail', entry: view.entry }); }}
        />
      </div>
    );
  }

  const back = (to: View) => (
    <button type="button" onClick={() => { refreshRows(); setView(to); }} className="mb-4 min-h-11 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
      <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" aria-hidden />{t.dictation.back}
    </button>
  );

  const startSequence = async (entry: StoryIndexEntry, s: Story, seqIdx: number) => {
    await unlockAudio();                                   // inside the tap: iOS and Chrome autoplay policy
    const seq = s.sequences[seqIdx];
    const pos = storyPosition(s, queue.getRows());
    const first = seq.sentences.findIndex(x => !['moved', 'skipped', 'correct'].includes(queue.getRows().get(x.id)?.status ?? ''));
    void pos;
    setView({ name: 'stage', entry, seq: seqIdx, start: first === -1 ? 0 : first });
  };

  // ---- sequence intro --------------------------------------------------------------------------------------------
  if (view.name === 'sequence' && story) {
    const seq: Sequence = story.sequences[view.seq];
    const counts = sequenceCounts(story, rows)[view.seq];
    const text = lang === 'en' ? seq.situation.en : seq.situation.fa;
    const alt = seq.image ? (lang === 'en' ? seq.image.alt.en : seq.image.alt.fa) : '';
    return (
      <div className="max-w-2xl mx-auto pb-24">
        {IntroDialog}{Banner}
        {back({ name: 'detail', entry: view.entry })}
        <h1 className="text-xl font-bold mb-3 text-slate-900 dark:text-white"><span dir="ltr" lang="de">{seq.title}</span></h1>
        {seq.image
          ? <img src={`${STORY_MEDIA_BASE}/${seq.image.key}.webp`} srcSet={`${STORY_MEDIA_BASE}/${seq.image.key}@800.webp 800w, ${STORY_MEDIA_BASE}/${seq.image.key}.webp 1600w`}
              sizes="(max-width: 520px) calc(100vw - 32px), 480px" alt={alt} width={seq.image.w} height={seq.image.h} decoding="async" className="w-full max-w-[480px] aspect-[4/3] rounded-2xl object-cover" />
          : <Placeholder title={seq.title} note={t.dictation.sequence.noImage} />}
        <h2 className="mt-5 text-sm font-semibold text-slate-500 dark:text-slate-400">{t.dictation.sequence.situation}</h2>
        <p className="mt-1 text-slate-800 dark:text-slate-200 leading-7">{text}</p>
        <button type="button" onClick={() => void startSequence(view.entry, story, view.seq)}
          className="mt-6 w-full sm:w-auto min-h-12 px-8 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500">
          <PlayCircle className="w-5 h-5" aria-hidden />{counts.finished === 0 ? t.dictation.sequence.start : counts.finished >= counts.total ? t.dictation.sequence.review : t.dictation.sequence.continue}
        </button>
      </div>
    );
  }

  // ---- ends ------------------------------------------------------------------------------------------------------
  if (view.name === 'sequenceEnd' && story) {
    const counts = sequenceCounts(story, rows)[view.seq];
    const hasNext = view.seq + 1 < story.sequences.length;
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" aria-hidden />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.dictation.end.sequenceTitle}</h1>
        <p className="text-slate-600 dark:text-slate-300">{t.dictation.end.sequenceStats(counts.finished, counts.total)}</p>
        <div className="flex flex-col gap-2">
          {hasNext && <button type="button" onClick={() => setView({ name: 'sequence', entry: view.entry, seq: view.seq + 1 })} className="min-h-11 rounded-xl bg-indigo-600 text-white font-semibold">{t.dictation.end.nextSequence}</button>}
          <button type="button" onClick={() => setView({ name: 'detail', entry: view.entry })} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold">{t.dictation.end.backToStory}</button>
        </div>
      </div>
    );
  }
  if (view.name === 'storyEnd' && story && index) {
    const nextEntry = index.stories[index.stories.findIndex(s => s.id === view.entry.id) + 1];
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600" aria-hidden />
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t.dictation.end.storyTitle}</h1>
        <p className="text-slate-600 dark:text-slate-300">{t.dictation.end.congrats}</p>
        <div className="flex flex-col gap-2">
          {nextEntry && <button type="button" onClick={() => void openStory(nextEntry, () => ({ name: 'detail', entry: nextEntry }))} className="min-h-11 rounded-xl bg-indigo-600 text-white font-semibold">{t.dictation.end.openNext}</button>}
          <button type="button" onClick={() => setView({ name: 'home' })} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold">{t.dictation.back}</button>
        </div>
      </div>
    );
  }

  // ---- story detail (six tiles) ----------------------------------------------------------------------------------
  if (view.name === 'detail' && story) {
    const counts = sequenceCounts(story, rows);
    return (
      <div className="max-w-3xl mx-auto pb-24">
        {IntroDialog}{Banner}
        {back({ name: 'home' })}
        <h1 className="text-xl font-bold mb-1 text-slate-900 dark:text-white"><span dir="ltr" lang="de">{story.title}</span> <BetaBadge /></h1>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">{t.dictation.detail.sequences}</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {story.sequences.map((q, i) => {
            const c = counts[i];
            const done = c.finished >= c.total;
            return (
              <li key={q.id}>
                <button type="button" onClick={() => setView({ name: 'sequence', entry: view.entry, seq: i })}
                  className="w-full text-start rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500 min-h-24">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{t.dictation.detail.sequence(q.order)}</span>
                  <span dir="ltr" lang="de" className="block font-semibold text-slate-900 dark:text-white">{q.title}</span>
                  <span className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    {done && <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden />}{t.dictation.detail.tile(c.finished, c.total)}
                  </span>
                  <span className="mt-2 block h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" aria-hidden>
                    <span className="block h-full bg-indigo-600" style={{ width: `${Math.round((c.finished / Math.max(1, c.total)) * 100)}%` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ---- home ------------------------------------------------------------------------------------------------------
  return (
    <div className="max-w-3xl mx-auto pb-24">
      {IntroDialog}
      {Header}{Banner}
      {loading && <Spinner text={t.dictation.loading} />}
      {errorBlock}
      {!loading && !error && index && index.stories.length === 0 && <p className="py-10 text-center text-slate-600 dark:text-slate-300">{t.dictation.home.empty}</p>}
      {!loading && !error && index && (
        <ul className="space-y-3">
          {index.stories.map(entry => {
            const finished = [...rows.values()].filter(r => r.storyId === entry.id && ['moved', 'skipped', 'correct'].includes(r.status)).length;
            const done = finished >= entry.sentences;
            return (
              <li key={entry.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 dir="ltr" lang="de" className="text-start font-bold text-slate-900 dark:text-white">{entry.title}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{t.dictation.home.lessons(entry.lessons[0], entry.lessons[1])} · {t.dictation.home.sentences(entry.sentences)}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{done ? t.dictation.home.completed : t.dictation.home.progress(finished, entry.sentences)}</p>
                  </div>
                  <button type="button" onClick={() => void openStory(entry, () => ({ name: 'detail', entry }))}
                    className="min-h-11 px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0">
                    {finished > 0 && !done ? t.dictation.home.continue : t.dictation.home.open}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <span className="sr-only">{num(0)}</span>
    </div>
  );
};

export default DictationScreen;
