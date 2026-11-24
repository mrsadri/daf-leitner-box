/**
 * Stories: bookshelf -> a book's six stories -> the reader. Every book is open; inside a book a story opens once
 * the quiz of the one before is answered (progress.ts). Progress is kept by StoriesProgressStore (storiesSync.ts).
 * Loaded lazily (its own chunk), like the book files.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Check, Lock, ChevronLeft, BookOpen } from 'lucide-react';
import type { LeitnerCard } from '../../core/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Button, Card, Badge, Dialog } from '../../shared/ui';
import { NewCardModal } from '../vocab/NewCardModal';
import { loadBook, loadIndex, imageUrl } from './content';
import { StoriesProgressStore, importGuestProgress } from './storiesSync';
import type { SignInReason } from '../auth/SignInPrompt';
import type { StorySaveStatus } from './progressStore';
import { storyStates, nextStory, withPage, withQuizDone } from './progress';
import { resolveTap, type WordTarget } from './wordTap';
import { WordSheet } from './WordSheet';
import { Icon3D } from '../../shared/ui/Icon3D';
import { Reader } from './Reader';
import { readStoryLocation, writeStoryLocation, type StoryView } from './storyNavigation';
import type { NarrativeStory, StoriesIndex, StoryProgress, WordSegment } from './types';
import { De } from '../../shared/ui/Text';
import { EditorialLibrary, BookArt, BookProgress } from './EditorialLibrary';
import { bookTitle } from './library';
import './stories.css';

interface Props {
  onReadingChange?: (reading: boolean) => void;
  /** Signed out: the first story of every book can be read; anything more asks to sign in */
  guest?: { onRequireSignIn: (reason: SignInReason) => void };
  userId: string;
  cards: LeitnerCard[];
  onCardsChanged: () => void;
  onAddCard: (card: Partial<LeitnerCard>) => void;
}



export default function StoriesScreen({ userId, cards, onCardsChanged, onAddCard, onReadingChange, guest }: Props) {
  const { t } = useI18n();
  const s = t.stories;
  const [reward, setReward] = useState<number | null>(null);
  const [index, setIndex] = useState<StoriesIndex | null>(null);
  const [book, setBook] = useState<NarrativeStory | null>(null);
  const [error, setError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [requestedView, updateView] = useState<StoryView>(() => readStoryLocation(window.location.href));
  const setView = (next: StoryView) => { writeStoryLocation(next); updateView(next); window.scrollTo({ top: 0 }); };
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
    // Signed in after reading as a guest on this device: that reading moves into the account
    if (!guest) importGuestProgress(store);
    void store.start();
    return () => { offStatus(); off(); store.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

  // eslint-disable-next-line react/set-state-in-effect -- This shared retry/mount callback starts an external content load.
  const load = () => { setError(false); setLoadAttempt(a => a + 1); loadIndex().then(setIndex).catch(() => setError(true)); };
  useEffect(load, []);

  const requestedBook = requestedView.kind === 'shelf' ? undefined : index?.books.find(b => b.n === requestedView.n);
  const requestedStory = requestedView.kind === 'read' ? requestedBook?.stories.findIndex(st => st.id === requestedView.storyId) ?? -1 : -1;
  const view: StoryView = !index ? requestedView : !requestedBook ? { kind: 'shelf' }
    : requestedView.kind === 'read' && (requestedStory < 0 || (guest && requestedStory > 0) || storyStates(requestedBook.stories.map(st => st.id), progress)[requestedStory] === 'locked')
      ? { kind: 'book', n: requestedBook.n } : requestedView;

  useEffect(() => {
    onReadingChange?.(view.kind === 'read');
    return () => onReadingChange?.(false);
  }, [view.kind, onReadingChange]);

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
  /** Open a story; a guest gets the first story of a book, and is asked to sign in for the others. */
  const openStory = (n: number, storyId: string, continueAt?: number) => {
    const summaryOf = index?.books.find(b => b.n === n);
    if (guest && summaryOf && summaryOf.stories.findIndex(st => st.id === storyId) > 0) { guest.onRequireSignIn('next'); return; }
    setView({ kind: 'read', n, storyId, continueAt });
  };

  if (error) {
    return (
      <Card className="max-w-md mx-auto text-center space-y-3" role="alert">
        <p>{s.loadError}</p>
        <Button onClick={load}>{s.retry}</Button>
        {view.kind !== 'shelf' && <Button variant="ghost" onClick={() => { setError(false); setView({ kind: 'shelf' }); }}>{s.backToShelf}</Button>}
      </Card>
    );
  }
  if (!index) return <p className="text-center py-16 text-slate-500" role="status">{s.loading}</p>;

  const overlays = (
    <>
      {reward !== null && <Dialog title={s.rewardTitle} onClose={() => setReward(null)}>
        <Icon3D name="trophy" className="w-24 h-24 mx-auto" />
        <p className="text-center text-xl font-bold">{s.rewardPoints(reward)}</p>
      </Dialog>}
      {(saveStatus !== 'idle' || store.getSaveInfo().lastSuccess) && (
        <div role="status" className={view.kind === 'read' && saveStatus !== 'error' ? 'reader-silent-status' : 'flex flex-wrap items-center gap-3 text-sm text-slate-700 dark:text-slate-200'}>
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
          onRequireSignIn={guest ? () => { setTarget(null); guest.onRequireSignIn('word'); } : undefined}
        />
      )}
      {!guest && <NewCardModal isOpen={newWord !== null} initialWord={newWord ?? undefined} onClose={() => setNewWord(null)} onAddCard={onAddCard} />}
    </>
  );

  // ----- Bookshelf -----
  if (view.kind === 'shelf') {
    return <>
      <EditorialLibrary index={index} progress={progress}
        onBook={n => setView({ kind: 'book', n })}
        onResume={(n, storyId, page) => openStory(n, storyId, page)} />
      {overlays}
    </>;
  }

  const summary = index.books.find(b => b.n === view.n)!;
  const ids = summary.stories.map(st => st.id);
  const states = storyStates(ids, progress);

  // ----- A book's stories -----
  if (view.kind === 'book') {
    const cont = nextStory(ids, progress);
    return (
      <div className="editorial-library space-y-8 pb-12" data-testid="stories-book">
        <Button data-testid="back-to-library" variant="ghost" size="sm" icon={<ChevronLeft className="w-4 h-4 rtl:rotate-180" />} onClick={() => setView({ kind: 'shelf' })}>{s.backToShelf}</Button>
        <section className="editorial-feature">
          <BookArt book={summary} eager />
          <div className="space-y-5 min-w-0">
            <p className="text-sm text-ink-soft">{s.book(summary.n)} · {s.lessons(...summary.lessons)}</p>
            <h1 className="editorial-title text-3xl sm:text-4xl"><De className="block text-start">{bookTitle(summary)}</De></h1>
            <p className="text-base leading-8 text-ink-soft">{s.bookTeasers[summary.n - 1]}</p>
            <BookProgress book={summary} progress={progress} />
            <Button onClick={() => {
              const storyId = cont ?? ids[0];
              openStory(summary.n, storyId, cont ? progress[storyId]?.page : undefined);
            }}>{cont ? progress[cont] ? s.continueReading : s.start : s.readAgain}</Button>
          </div>
        </section>
        <h2 className="text-xl font-semibold border-t border-paper-edge pt-8">{s.scenePreview}</h2>
        <ol className="editorial-scenes">
          {summary.stories.map((st, i) => {
            const state = states[i];
            const p = progress[st.id];
            const isCurrent = st.id === cont;
            const fullStory = book?.n === summary.n ? book.stories.find(story => story.id === st.id) : undefined;
            const excerpt = fullStory?.pages[0]?.[0]?.map(segment => typeof segment === 'string' ? segment : segment.t).join('');
            return (
              <li key={st.id}>
                <button
                  type="button"
                  disabled={state === 'locked'}
                  onClick={() => openStory(summary.n, st.id, state === 'open' && p ? p.page : undefined)}
                  data-testid="story-item"
                  data-state={state}
                  aria-describedby={state === 'locked' ? 'story-locked-note' : undefined}
                  className="editorial-scene disabled:cursor-not-allowed text-ink hover:bg-paper/50"
                >
                  {st.image
                    ? <img src={imageUrl(st.image, true)} alt="" width={800} height={600} loading="lazy" />
                    : <div className="editorial-scene-art"><BookOpen className="w-6 h-6 text-ink-soft" aria-hidden /></div>}
                  <span className="flex-1 min-w-0 space-y-2">
                    <span className="block text-caption text-ink-soft font-mono-num">{st.n}</span>
                    <span dir="ltr" lang="de" className="block editorial-title text-lg text-ink text-start">{st.title}</span>
                    {excerpt && <De className="text-sm leading-7 text-ink-soft line-clamp-2 text-start">{excerpt}</De>}
                    {isCurrent && <span className="block text-caption text-indigo-700 dark:text-indigo-300">{p ? s.continueReading : s.start}</span>}
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
        startPage={view.continueAt}
        hasNext={!!nextSt}
        onPage={(page) => {
          writeStoryLocation({ kind: 'read', n: book.n, storyId: story.id, continueAt: page }, true);
          store.save(withPage(progress[story.id], story.id, page, story.pages.length, now()), book.contentVersion);
        }}
        onQuizDone={(score) => {
          if (!guest && !progress[story.id]?.completedAt) setReward(story.sentenceCount);   // guests earn points once signed in
          store.save(withQuizDone(progress[story.id], story.id, story.pages.length, score, now()), book.contentVersion);
        }}
        onWord={onWord}
        onNextStory={() => nextSt && openStory(book.n, nextSt.id)}
        onBack={() => setView({ kind: 'book', n: book.n })}
      />
      {overlays}
    </>
  );
}
