import React, { useState, useEffect, useCallback, useRef } from 'react';
import { LeitnerCard } from '../types/leitner';
import { leitnerEngine, stripArticleFromWord, getQuizArticle, calculateNextReviewDate } from '../services/leitnerEngine';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import { vocabText, perfektAnswers, pluralParts, conjugationOf, perfektGuideOf } from '../services/vocabText';
import { ConjugationButton } from './ConjugationDialog';
import { maskParticiples, PerfektResult } from '../services/perfekt';
import { PerfektQuiz } from './PerfektQuiz';
import { PluralInfo } from './PluralInfo';
import { PerfektExplanation } from './PerfektGuide';
import { Volume2, RotateCw, ArrowLeft, BookOpen, CheckCircle2, Sparkles, X, ChevronLeft, Undo2, Check, RotateCcw, ArrowRight, Hand } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { De, Auto } from './ui/Text';
import { SwipeCard, SwipeCardHandle } from './ui/SwipeCard';
import { RoundActionBar } from './ui/RoundActionBar';
import type { SwipeDir } from '../services/swipe';
import { vibrate } from '../services/haptics';

const BANNER_HIDDEN_KEY = 'daf_new_words_banner_hidden';
const SWIPE_HINT_KEY = 'daf_swipe_hint_done';
const readSwipeHintDone = () => {
  try { return localStorage.getItem(SWIPE_HINT_KEY) === '1'; } catch { return true; }
};
const coarsePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

const readBannerHidden = () => {
  try { return localStorage.getItem(BANNER_HIDDEN_KEY) === '1'; } catch { return false; }
};

interface NewWordsStudySessionProps {
  onFinish: () => void;
  onCardAdded: () => void;
}

export const NewWordsStudySession: React.FC<NewWordsStudySessionProps> = ({
  onFinish,
  onCardAdded
}) => {
  const { t, lang } = useI18n();
  const [unlearnedWords, setUnlearnedWords] = useState<LeitnerCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [selectedArticleGuess, setSelectedArticleGuess] = useState<'der' | 'die' | 'das' | null>(null);
  const [addedCount, setAddedCount] = useState<number>(0);
  // Words added to Box 0 in this session (going back to one shows it as added and allows undoing it)
  const [addedIds, setAddedIds] = useState<Set<string>>(() => new Set());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [hadWordsAtStart, setHadWordsAtStart] = useState<boolean>(false);
  const [perfektResult, setPerfektResult] = useState<PerfektResult | null>(null);
  // Read once per session, so the layout never switches in the middle of a card
  const [flipMode] = useState<boolean>(() => !!leitnerEngine.getSettings().newWordsFlipCard);
  const sessionTopRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<SwipeCardHandle>(null);
  const [enterMode, setEnterMode] = useState<'fade' | 'rewind'>('fade');
  const [showSwipeHint, setShowSwipeHint] = useState<boolean>(() => coarsePointer() && !readSwipeHintDone());
  const [bannerHidden, setBannerHidden] = useState<boolean>(readBannerHidden);
  const shownIndexRef = useRef<number>(0);

  useEffect(() => {
    const list = leitnerEngine.getUnlearnedWords();
    setUnlearnedWords(list);
    setHadWordsAtStart(list.length > 0);
    setCurrentIndex(0);
  }, []);

  const currentWord = unlearnedWords[currentIndex];
  const quizArticle = currentWord ? getQuizArticle(currentWord) : null;
  const isNoun = quizArticle !== null;
  // Strip article from the front side so it DOES NOT spoil the article!
  const frontWordDisplay = currentWord 
    ? (isNoun ? stripArticleFromWord(currentWord.wort) : currentWord.wort)
    : '';
  const fullWordDisplay = currentWord
    ? (quizArticle ? `${quizArticle} ${stripArticleFromWord(currentWord.wort)}` : (currentWord.wort || ''))
    : '';

  const handleSpeak = useCallback(async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    await speechService.speak(text, leitnerEngine.getSettings().speechRate);
    setIsSpeaking(false);
  }, [isSpeaking]);

  useEffect(() => {
    if (currentWord && leitnerEngine.getSettings().autoSpeak && !isFlipped) {
      // Two-sided card: speak the stripped word so speech doesn't spoil the article.
      // One-sided card: the article is visible anyway, so say it too.
      handleSpeak((flipMode ? frontWordDisplay : fullWordDisplay) || '');
    }
    setIsFlipped(false);
    setSelectedArticleGuess(null);
    setPerfektResult(null);

    // Moving on from the bottom of a long card: bring the top of the next word back into view
    if (shownIndexRef.current !== currentIndex) {
      shownIndexRef.current = currentIndex;
      const top = sessionTopRef.current;
      if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [currentIndex, currentWord?.id]);

  const handleFlip = () => {
    if (!flipMode) return;
    soundService.playFlip();
    setIsFlipped(!isFlipped);
  };

  const handleArticleSelect = (art: 'der' | 'die' | 'das') => {
    if (!currentWord || !quizArticle || selectedArticleGuess) return;
    const isMatch = art === quizArticle;
    setSelectedArticleGuess(art);
    if (isMatch) {
      soundService.playSuccess();
    } else {
      soundService.playWrong();
    }
  };

  const handleAddToBox0 = () => {
    if (!currentWord) return;
    // Back on a word that is already in Box 0: Enter / the main button just move on
    if (addedIds.has(currentWord.id)) {
      goToNextWord();
      return;
    }
    soundService.playSuccess();

    // The word was just studied, so its first review is tomorrow (Box 0 interval = 2^0 = 1 day)
    leitnerEngine.addCard({
      ...currentWord,
      nextReviewDate: calculateNextReviewDate(0)
    });

    setAddedCount(prev => prev + 1);
    setAddedIds(prev => new Set(prev).add(currentWord.id));
    onCardAdded();
    goToNextWord();
  };

  // Past the last word, currentIndex === unlearnedWords.length shows the end screen (from where "back" still works)
  const goToNextWord = () => {
    setEnterMode('fade');
    setCurrentIndex(i => Math.min(i + 1, unlearnedWords.length));
  };

  const goToPreviousWord = () => {
    setEnterMode('rewind');
    setCurrentIndex(i => Math.max(i - 1, 0));
  };

  /** Right = got it (or next, on a word already added), left = skip */
  const handleSwipe = (dir: SwipeDir) => {
    if (dir === 'right') handleAddToBox0();
    else goToNextWord();
  };

  /** Undo an add from this session, as long as the card hasn't been reviewed yet. */
  const handleUndoAdd = () => {
    if (!currentWord || !addedIds.has(currentWord.id)) return;
    const card = leitnerEngine.getCards().find(c => c.id === currentWord.id);
    if (card && (card.box !== 0 || card.reviewCount > 0)) return;
    if (card) leitnerEngine.deleteCard(card.id);
    setAddedIds(prev => {
      const next = new Set(prev);
      next.delete(currentWord.id);
      return next;
    });
    setAddedCount(prev => Math.max(0, prev - 1));
    onCardAdded();
  };

  // Keyboard shortcut (Space to flip, Enter to add)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentWord) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
      // Enter on a focused button already presses that button; don't also add the card
      const onButton = !!target?.closest('button, a');
      if (e.code === 'Backspace' && !onButton) {
        e.preventDefault();
        goToPreviousWord();
        return;
      }

      // Arrow keys follow the swipe directions: → got it, ← skip
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault();
        swipeRef.current?.fly(e.code === 'ArrowRight' ? 'right' : 'left');
        return;
      }

      if (!flipMode) {
        if (onButton) return;
        if (e.code === 'Space') {
          e.preventDefault();
          handleSpeak(fullWordDisplay);
        } else if (e.code === 'Enter') {
          e.preventDefault();
          swipeRef.current?.fly('right');
        }
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'Enter') {
        if (isFlipped && !onButton) {
          e.preventDefault();
          swipeRef.current?.fly('right');
        }
      } else if (!isFlipped && isNoun) {
        if (e.key === 'd' || e.key === 'D' || e.code === 'Digit1') {
          e.preventDefault();
          handleArticleSelect('der');
        } else if (e.key === 'e' || e.key === 'E' || e.code === 'Digit2') {
          e.preventDefault();
          handleArticleSelect('die');
        } else if (e.key === 's' || e.key === 'S' || e.code === 'Digit3') {
          e.preventDefault();
          handleArticleSelect('das');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentWord, isFlipped, isNoun, currentIndex, flipMode, fullWordDisplay, handleSpeak, addedIds]);


  const kbd = 'px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono-num font-bold';

  if (!currentWord) {
    const finished = addedCount > 0 || hadWordsAtStart;
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {finished ? t.newWords.doneTitle : t.newWords.allAddedTitle}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {finished ? t.newWords.doneBody(addedCount) : t.newWords.allAddedBody}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {unlearnedWords.length > 0 && (
            <button
              onClick={goToPreviousWord}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4 rtl:-scale-x-100" />
              {t.newWords.backToLast}
            </button>
          )}
          <button
            onClick={onFinish}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
          >
            {t.newWords.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  const isAdded = addedIds.has(currentWord.id);

  const text = vocabText(currentWord, lang);
  const plural = isNoun ? pluralParts(currentWord) : [];
  const perfektAccepted = perfektAnswers(currentWord);
  const conjugation = conjugationOf(currentWord);
  const perfektGuide = perfektAccepted.length ? perfektGuideOf(currentWord) : null;
  // Two-sided card: until the practice answer is in, don't give the Perfekt away on the back of the card.
  // One-sided card: no practice, everything is visible.
  const perfektLocked = flipMode && perfektAccepted.length > 0 && !perfektResult;
  const hide = (s: string) => (perfektLocked ? maskParticiples(s, perfektAccepted) : s);

  return (
    <div ref={sessionTopRef} className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-12 scroll-mt-24">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-xs">
        <button
          onClick={onFinish}
          className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />
          <span>{t.newWords.finish}</span>
        </button>

        <span className="font-semibold text-slate-700 dark:text-slate-300">
          {t.newWords.progress(currentIndex + 1, unlearnedWords.length)}
        </span>

        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold">
          {t.newWords.addedCount(addedCount)}
        </span>
      </div>

      {/* Info banner (closing it hides it on this device for good) */}
      {!bannerHidden && (
        <div className="p-3.5 pe-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">{flipMode ? t.newWords.banner : t.newWords.bannerOneSided}</p>
          <button
            type="button"
            onClick={() => {
              setBannerHidden(true);
              try { localStorage.setItem(BANNER_HIDDEN_KEY, '1'); } catch { /* private mode: hidden for this session only */ }
            }}
            title={t.newWords.hideBanner}
            aria-label={t.newWords.hideBanner}
            className="-my-1 p-1.5 shrink-0 rounded-lg text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Card */}
      <div className="relative min-h-[400px] flex flex-col">
        <SwipeCard
          ref={swipeRef}
          cardKey={currentWord.id}
          enter={enterMode}
          onSwipe={handleSwipe}
          canSwipe={dir => (isAdded && dir === 'left' ? '' : true)}
          onGesture={() => {
            vibrate();
            if (showSwipeHint) {
              setShowSwipeHint(false);
              try { localStorage.setItem(SWIPE_HINT_KEY, '1'); } catch { /* ignore */ }
            }
          }}
          stamps={isAdded ? { left: '', right: t.newWords.stampNext } : { left: t.newWords.stampSkip, right: t.newWords.stampAdd }}
          onClick={flipMode ? handleFlip : undefined}
          data-card-mode={flipMode ? 'flip' : 'single'}
          className={`flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-10 flex flex-col justify-between gap-4 shadow-sm ${
            flipMode ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 select-none' : ''
          }`}
        >
          {/* Card meta */}
          <div className="flex items-start justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="dot-list flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="whitespace-nowrap">{t.newWords.source}</span>
              <span className="whitespace-nowrap">{t.common.lesson(currentWord.lektion || '01')}</span>
              <span className="whitespace-nowrap">{t.common.level(currentWord.niveau || 'A1')}</span>
              {currentWord.wortart && (
                <>
                  <De className="italic font-semibold text-indigo-600 dark:text-indigo-400">{currentWord.wortart}</De>
                </>
              )}
            </div>

            {isAdded && (
              <span className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold" data-testid="added-badge">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.newWords.inBox0}
              </span>
            )}
            {flipMode && !isAdded && (
              <span className="flex items-center gap-1.5 shrink-0 text-slate-500" title={isFlipped ? t.review.showFront : t.newWords.flip}>
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">{isFlipped ? t.review.showFront : t.newWords.flip}</span>
              </span>
            )}
          </div>

          {/* FRONT (two-sided card only) */}
          {flipMode && !isFlipped ? (
            <div className="py-6 sm:py-8 text-center space-y-6">
              <div className="space-y-3">
                {isNoun && (
                  <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold block">{t.review.guessArticle}</span>
                )}
                <De as="h2" className="block text-[clamp(1.875rem,9vw,3rem)] leading-tight font-extrabold text-slate-900 dark:text-white tracking-tight break-words hyphens-auto">
                  {frontWordDisplay}
                </De>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak(frontWordDisplay || '');
                  }}
                  disabled={isSpeaking}
                  title={t.review.pronounceTitle}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-indigo-600' : ''}`} />
                  <span>{t.review.pronounce}</span>
                </button>
              </div>

              {isNoun && (
                <div
                  className="max-w-md mx-auto pt-4 border-t border-slate-100 dark:border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2.5">{t.newWords.guessPrompt}</span>
                  <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                    {([
                      { art: 'der', color: 'border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40' },
                      { art: 'die', color: 'border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40' },
                      { art: 'das', color: 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' }
                    ] as const).map(({ art, color }) => {
                      const isMatch = quizArticle === art;
                      const isGuessed = selectedArticleGuess === art;
                      const base = 'py-2.5 px-2 font-bold text-sm rounded-xl border-2 transition-all flex flex-col items-center gap-0.5';

                      let btnStyle = `${base} ${color}`;
                      if (isGuessed) {
                        btnStyle = isMatch
                          ? `${base} bg-emerald-500 text-white border-emerald-500 shadow-md ring-2 ring-emerald-300`
                          : `${base} bg-red-500 text-white border-red-500 shadow-md`;
                      } else if (selectedArticleGuess && isMatch) {
                        btnStyle = `${base} border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400`;
                      }

                      return (
                        <button
                          key={art}
                          type="button"
                          onClick={() => handleArticleSelect(art)}
                          className={btnStyle}
                        >
                          <De className="text-base">{art}</De>
                          <span className="text-[10px] font-normal opacity-75">{t.articles[art]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedArticleGuess && (
                    <p className={`mt-3 text-xs font-semibold ${selectedArticleGuess === quizArticle ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {selectedArticleGuess === quizArticle ? t.newWords.guessRight(selectedArticleGuess) : t.newWords.guessWrong}
                    </p>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">{t.newWords.flipHint}</p>
            </div>
          ) : (
            /* BACK of the two-sided card, or the whole one-sided card */
            <div className="py-4 space-y-6 text-start">
              <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                {flipMode && <span className="text-xs text-slate-500 dark:text-slate-400 block">{t.newWords.fullWord}</span>}
                <div className="flex items-start justify-between gap-3">
                  <De as="div" className="flex flex-wrap items-baseline gap-x-2 min-w-0 break-words hyphens-auto">
                    {quizArticle && (
                      <span className={`text-xl font-bold ${
                        quizArticle === 'der' ? 'text-blue-600 dark:text-blue-400' :
                        quizArticle === 'die' ? 'text-red-600 dark:text-red-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {quizArticle}
                      </span>
                    )}
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                      {quizArticle ? stripArticleFromWord(currentWord.wort) : currentWord.wort}
                    </span>
                  </De>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(fullWordDisplay);
                    }}
                    title={t.review.pronounceTitle}
                    aria-label={t.review.pronounceTitle}
                    className="p-1.5 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                {conjugation && (
                  <div className="pt-1">
                    <ConjugationButton verb={currentWord.wort || ''} conjugation={conjugation} disabled={perfektLocked} />
                  </div>
                )}

                <div className="pt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">{t.review.meaningLabel}</span>
                  <Auto as="p" className="block text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 leading-snug text-start">
                    {text.meaning}
                  </Auto>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {!flipMode && perfektAccepted.length > 0 && (
                  <div className="p-3 rounded-xl bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40 sm:col-span-2">
                    <De className="text-violet-700 dark:text-violet-300 font-semibold block mb-1">Perfekt</De>
                    <De as="div" className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">{perfektAccepted.join(' / ')}</De>
                    {perfektGuide && (
                      <div className="mt-2.5 pt-2.5 border-t border-violet-200/60 dark:border-violet-800/40">
                        <PerfektExplanation guide={perfektGuide} bare />
                      </div>
                    )}
                  </div>
                )}

                {plural.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1">{t.review.plural}</span>
                    <PluralInfo parts={plural} />
                  </div>
                )}

                {text.formen && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                    <span className="text-slate-500 dark:text-slate-400 block mb-1">{t.review.formen}</span>
                    <Auto as="div" className="text-slate-800 dark:text-slate-200 leading-relaxed text-start">{hide(text.formen)}</Auto>
                  </div>
                )}

                {text.oesterreich && (
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 sm:col-span-2">
                    <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1">🇦🇹 {t.review.austria}</span>
                    <Auto as="div" className="text-amber-900 dark:text-amber-200 leading-relaxed text-start">{hide(text.oesterreich)}</Auto>
                  </div>
                )}
              </div>

              {text.exampleDe && (
                <div
                  className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t.review.exampleTitle}</span>
                    <button
                      type="button"
                      onClick={() => handleSpeak(text.exampleDe)}
                      disabled={isSpeaking}
                      title={t.review.playExample}
                      aria-label={t.review.playExample}
                      className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <De as="p" className="text-sm text-slate-900 dark:text-white leading-relaxed">{hide(text.exampleDe)}</De>
                  {text.exampleTranslation && (
                    <Auto as="p" className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-start">{text.exampleTranslation}</Auto>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Keyboard shortcuts (only on devices with a keyboard/mouse) */}
          <div className="hidden pointer-fine:flex pt-4 border-t border-slate-100 dark:border-slate-800 items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            {flipMode
              ? <span>{t.review.kbdFlip} <kbd className={kbd}>Space</kbd></span>
              : <span>{t.newWords.kbdSpeak} <kbd className={kbd}>Space</kbd></span>}
            <span>{t.newWords.kbdSkip} <kbd className={kbd}>←</kbd></span>
            <span>{t.newWords.kbdAdd} <kbd className={kbd}>→</kbd> <kbd className={kbd}>Enter</kbd></span>
            <span>{t.newWords.kbdPrevious} <kbd className={kbd}>Backspace</kbd></span>
          </div>
        </SwipeCard>

        {showSwipeHint && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400" data-testid="swipe-hint">
            <Hand className="w-4 h-4 shrink-0" />
            {t.newWords.swipeHint}
          </p>
        )}

        {flipMode && perfektAccepted.length > 0 && (
          <div className="mt-4">
            <PerfektQuiz
              key={currentWord.id}
              accepted={perfektAccepted}
              practice
              guide={perfektGuide}
              onGraded={r => {
                setPerfektResult(r);
                if (r.correct) soundService.playSuccess();
                else soundService.playWrong();
                if (leitnerEngine.getSettings().autoSpeak) speechService.speak(r.expected, leitnerEngine.getSettings().speechRate);
              }}
            />
            {perfektResult && conjugation && (
              <div className="mt-2 flex justify-end">
                <ConjugationButton verb={currentWord.wort || ''} conjugation={conjugation} />
              </div>
            )}
          </div>
        )}

        {/* Actions: round buttons in swipe order (left = skip, right = got it); fixed at the bottom on phones */}
        <RoundActionBar
          actions={isAdded ? [
            { id: 'undo', tone: 'undo', icon: <Undo2 />, label: t.newWords.undoAdd, hint: t.newWords.undoAddHint, onClick: handleUndoAdd },
            { id: 'back', tone: 'back', size: 'sm', icon: <RotateCcw />, label: t.newWords.previous, hint: t.newWords.previousHint, onClick: goToPreviousWord, disabled: currentIndex === 0 },
            { id: 'next', tone: 'next', icon: <ArrowRight />, label: t.newWords.next, onClick: () => swipeRef.current?.fly('right') }
          ] : [
            { id: 'skip', tone: 'no', icon: <X />, label: t.newWords.skip, hint: t.newWords.skipHint, onClick: () => swipeRef.current?.fly('left') },
            { id: 'back', tone: 'back', size: 'sm', icon: <RotateCcw />, label: t.newWords.previous, hint: t.newWords.previousHint, onClick: goToPreviousWord, disabled: currentIndex === 0 },
            { id: 'add', tone: 'yes', icon: <Check />, label: t.newWords.add, hint: t.newWords.addHint, onClick: () => swipeRef.current?.fly('right') }
          ]}
        />
      </div>

    </div>
  );
};
