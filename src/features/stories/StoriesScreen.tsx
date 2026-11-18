/**
 * Stories: bookshelf -> a book's six stories -> the reader. Every book is open; inside a book a story opens once
 * the quiz of the one before is answered (progress.ts). Progress is kept by StoriesProgressStore (storiesSync.ts).
 * Loaded lazily (its own chunk), like the book files.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Lock, ChevronLeft, BookOpen } from 'lucide-react';
import type { LeitnerCard } from '../../core/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, Card, Badge, cx } from '../../shared/ui';
import { NewCardModal } from '../vocab/NewCardModal';
import { loadBook, loadIndex, imageUrl } from './content';
import { StoriesProgressStore } from './storiesSync';
import type { StorySaveStatus } from './progressStore';
import { storyStates, nextStory, withPage, withQuizDone } from './progress';
import { resolveTap, type WordTarget } from './wordTap';
import { WordSheet } from './WordSheet';
import { Reader } from './Reader';
import { readStoryLocation, writeStoryLocation, type StoryView } from './storyNavigation';
import type { Book, StoriesIndex, StoryProgress, WordSegment } from './types';

interface Props {
  userId: string;
  cards: LeitnerCard[];
  onCardsChanged: () => void;
  onAddCard: (card: Partial<LeitnerCard>) => void;
}



const COVER_TINTS = ['bg-amber-100', 'bg-sky-100', 'bg-emerald-100', 'bg-rose-100', 'bg-violet-100', 'bg-lime-100', 'bg-orange-100', 'bg-teal-100', 'bg-indigo-100', 'bg-yellow-100'];

export default function StoriesScreen({ userId, cards, onCardsChanged, onAddCard }: Props) {
  const { t } = useI18n();
  const s = t.stories;
  const [index, setIndex] = useState<StoriesIndex | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [requestedView, updateView] = useState<StoryView>(() => readStoryLocation(window.location.href));
  const setView = (next: StoryView) => { writeStoryLocation(next); updateView(next); };
  useEffect(() => {
    const pop = () => updateView(readStoryLocation(window.location.href));
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const [target, setTarget] = useState<Exclude<WordTarget, { kind: 'none' }> | null>(null);
  const [newWord, setNewWord] = useState<string | null>(null);
  const store = useMemo(() => new StoriesProgressStore(userId), [userId]);
  const [progress, setProgress] = useState<Record<string, StoryProgress>>(() => store.get());

  const [saveStatus, setSaveStatus] = useState<StorySaveStatus>('idle');

  useEffect(() => {
    const offStatus = store.onStatus(setSaveStatus);
    const off = store.subscribe(setProgress);
    void store.start();
    return () => { offStatus(); off(); store.dispose(); };
  }, [store]);

  // eslint-disable-next-line react/set-state-in-effect -- This shared retry/mount callback starts an external content load.
  const load = () => { setError(false); setLoadAttempt(a => a + 1); loadIndex().then(setIndex).catch(() => setError(true)); };
  useEffect(load, []);

  const requestedBook = requestedView.kind === 'shelf' ? undefined : index?.books.find(b => b.n === requestedView.n);
  const requestedStory = requestedView.kind === 'read' ? requestedBook?.stories.findIndex(st => st.id === requestedView.storyId) ?? -1 : -1;
  const view: StoryView = !index ? requestedView : !requestedBook ? { kind: 'shelf' }
    : requestedView.kind === 'read' && (requestedStory < 0 || storyStates(requestedBook.stories.map(st => st.id), progress)[requestedStory] === 'locked')
      ? { kind: 'book', n: requestedBook.n } : requestedView;

  const bookN = view.kind === 'shelf' ? null : view.n;
  useEffect(() => {
    if (bookN === null) return;
    let live = true;
    // eslint-disable-next-line react/set-state-in-effect -- Changing the book invalidates the previous fetched book before loading its replacement.
    setBook(b => (b?.n === bookN ? b : null));
    loadBook(bookN).then(b => { if (live) setBook(b); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
    // eslint-disable-next-line react/exhaustive-effect-dependencies -- Retry reloads the same book after a failed request.
  }, [bookN, loadAttempt]);

  const owned = useMemo(() => new Set(cards.map(c => c.id)), [cards]);
  const names = useMemo(() => new Set(book?.names ?? []), [book]);
  const onWord = (w: WordSegment | string) => {
    const tgt = resolveTap(w, owned, names);
    if (tgt.kind !== 'none') setTarget(tgt);
  };

  const now = () => new Date().toISOString();

  if (error) {
    return (
      <Card className="max-w-md mx-auto text-center space-y-3" role="alert">
        <p>{s.loadError}</p>
        <Button onClick={load}>{s.retry}</Button>
      </Card>
    );
  }
  if (!index) return <p className="text-center py-16 text-slate-500" role="status">{s.loading}</p>;

  const overlays = (
    <>
      {(saveStatus !== 'idle' || store.getSaveInfo().lastSuccess) && (
        <div role="status" className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
          <span>{saveStatus !== 'idle' && s.saveStatus[saveStatus]} {s.pendingCount(store.getSaveInfo().pending)} {store.getSaveInfo().lastSuccess && t.sync.lastSaved(new Date(store.getSaveInfo().lastSuccess!).toLocaleString())}</span>
          {saveStatus === 'error' && <Button onClick={() => { void store.retry(); }}>{s.retry}</Button>}
        </div>
      )}
      {target && (
        <WordSheet
          target={target}
          onClose={() => setTarget(null)}
          onCardsChanged={onCardsChanged}
          onAddNew={(word) => { setTarget(null); setNewWord(word); }}
        />
      )}
      <NewCardModal isOpen={newWord !== null} initialWord={newWord ?? undefined} onClose={() => setNewWord(null)} onAddCard={onAddCard} />
    </>
  );

  // ----- Bookshelf -----
  if (view.kind === 'shelf') {
    return (
      <div className="space-y-6 pb-12" data-testid="stories-shelf">
        <header className="space-y-1">
          <h1 className="font-story-title text-3xl text-slate-900 dark:text-white">{s.title}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">{s.subtitle}</p>
        </header>
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {index.books.map(b => {
            const done = b.stories.filter(st => progress[st.id]?.completedAt).length;
            const cover = b.stories.find(st => st.image)?.image;
            return (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => setView({ kind: 'book', n: b.n })}
                  data-testid="book-cover"
                  className="group w-full text-start rounded-card overflow-hidden border border-paper-edge bg-paper shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  {cover
                    ? <img src={imageUrl(cover, true)} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" decoding="async" />
                    : <div className={cx('w-full aspect-[4/3] flex items-center justify-center', COVER_TINTS[(b.n - 1) % COVER_TINTS.length], 'dark:opacity-80')}>
                        <span className="font-story-title text-5xl text-slate-700/70">{b.n}</span>
                      </div>}
                  <div className="p-3 space-y-1">
                    <p className="text-caption font-semibold text-ink-soft">{s.book(b.n)} · {s.lessons(b.lessons[0], b.lessons[1])}</p>
                    <p dir="ltr" lang="de" className="font-story-title text-lg leading-tight text-ink text-start">{b.title}</p>
                    <p className="text-caption text-ink-soft">{s.bookProgress(done, b.stories.length)}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
        {overlays}
      </div>
    );
  }

  const summary = index.books.find(b => b.n === view.n)!;
  const ids = summary.stories.map(st => st.id);
  const states = storyStates(ids, progress);

  // ----- A book's stories -----
  if (view.kind === 'book') {
    const cont = nextStory(ids, progress);
    return (
      <div className="max-w-2xl mx-auto space-y-5 pb-12" data-testid="stories-book">
        <Button variant="ghost" size="sm" icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />} onClick={() => setView({ kind: 'shelf' })}>{s.backToShelf}</Button>
        <header className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{s.book(summary.n)} · {s.lessons(summary.lessons[0], summary.lessons[1])}</p>
          <h1 dir="ltr" lang="de" className="font-story-title text-3xl text-slate-900 dark:text-white text-start">{summary.title}</h1>
        </header>
        <ol className="space-y-3">
          {summary.stories.map((st, i) => {
            const state = states[i];
            const p = progress[st.id];
            const isCurrent = st.id === cont;
            return (
              <li key={st.id}>
                <button
                  type="button"
                  disabled={state === 'locked'}
                  onClick={() => setView({ kind: 'read', n: summary.n, storyId: st.id, continueAt: state === 'open' && p ? p.page : undefined })}
                  data-testid="story-item"
                  data-state={state}
                  aria-describedby={state === 'locked' ? 'story-locked-note' : undefined}
                  className={cx(
                    'w-full flex items-center gap-4 p-3 rounded-card border text-start transition-colors min-h-16',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    state === 'locked' ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70 cursor-not-allowed'
                      : 'bg-paper border-paper-edge hover:border-indigo-400',
                    isCurrent && 'ring-2 ring-indigo-500/60',
                  )}
                >
                  {st.image
                    ? <img src={imageUrl(st.image, true)} alt="" className="w-20 h-15 rounded-control object-cover shrink-0" loading="lazy" />
                    : <div className="w-20 h-15 rounded-control bg-paper-edge/60 flex items-center justify-center shrink-0"><BookOpen className="w-6 h-6 text-ink-soft" aria-hidden /></div>}
                  <span className="flex-1 min-w-0">
                    <span className="block text-caption text-ink-soft font-mono-num">{st.n}</span>
                    <span dir="ltr" lang="de" className="block font-story-title text-lg leading-tight text-ink text-start">{st.title}</span>
                  </span>
                  {state === 'done' && <Badge tone="success" icon={<Check className="w-3.5 h-3.5" />}>{s.done}</Badge>}
                  {state === 'locked' && <Lock className="w-5 h-5 text-slate-400 shrink-0" aria-label={s.locked} />}
                </button>
              </li>
            );
          })}
        </ol>
        {states.includes('locked') && <p id="story-locked-note" className="text-caption text-slate-500 dark:text-slate-400">{s.locked}</p>}
        {overlays}
      </div>
    );
  }

  // ----- Reading -----
  if (!book || book.n !== view.n) return <p className="text-center py-16 text-slate-500" role="status">{s.loading}</p>;
  const story = book.stories.find(st => st.id === view.storyId);
  if (!story) return <Button onClick={() => setView({ kind: 'book', n: book.n })}>{s.backToShelf}</Button>;
  const idx = book.stories.indexOf(story);
  const nextSt = book.stories[idx + 1];
  return (
    <>
      <Reader
        key={story.id}
        story={story}
        startPage={view.continueAt && view.continueAt > 0 ? view.continueAt : undefined}
        hasNext={!!nextSt}
        onPage={(page) => {
          writeStoryLocation({ kind: 'read', n: book.n, storyId: story.id, continueAt: page }, true);
          store.save(withPage(progress[story.id], story.id, page, story.pages.length, now()), book.contentVersion);
        }}
        onQuizDone={(score) => store.save(withQuizDone(progress[story.id], story.id, story.pages.length, score, now()), book.contentVersion)}
        onWord={onWord}
        onNextStory={() => nextSt && setView({ kind: 'read', n: book.n, storyId: nextSt.id })}
        onBack={() => setView({ kind: 'book', n: book.n })}
      />
      {overlays}
    </>
  );
}
