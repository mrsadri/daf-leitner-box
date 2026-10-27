import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LeitnerCard, BOX_CONFIGS, MASTERED_BOX } from '../types/leitner';
import { leitnerEngine, isNounCard, stripArticleFromWord, getQuizArticle } from '../services/leitnerEngine';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import { vocabText, perfektAnswers, pluralParts, conjugationOf } from '../services/vocabText';
import { ConjugationButton } from './ConjugationDialog';
import { maskParticiples, PerfektResult } from '../services/perfekt';
import { PerfektQuiz } from './PerfektQuiz';
import { MOBILE_STICKY_ACTIONS } from './ui/sticky';
import { PluralInfo } from './PluralInfo';
import { Volume2, RotateCw, Check, X, Sparkles, ArrowLeft, Trophy, BookOpen, Quote, Edit3 } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { De, Auto } from './ui/Text';
import { Switch } from './ui/Switch';

interface ReviewSessionProps {
  /** Cards due when the session started. Snapshotted on mount (remount with a new `key` to start a new session). */
  initialCards: LeitnerCard[];
  /** Live card list, used to show edits made during the session. */
  allCards: LeitnerCard[];
  initialNounsOnly?: boolean;
  onFinishSession: () => void;
  onCardUpdated: () => void;
  onStartNewWordsLearning?: () => void;
}

const ARTICLE_COLOR: Record<'der' | 'die' | 'das', string> = {
  der: 'text-blue-600 dark:text-blue-400',
  die: 'text-red-600 dark:text-red-400',
  das: 'text-emerald-600 dark:text-emerald-400'
};

export const ReviewSession: React.FC<ReviewSessionProps> = ({
  initialCards,
  allCards,
  initialNounsOnly = false,
  onFinishSession,
  onCardUpdated,
  onStartNewWordsLearning
}) => {
  const { t, lang, num } = useI18n();
  const [nounsOnly, setNounsOnly] = useState<boolean>(initialNounsOnly || leitnerEngine.getSettings().nounsOnlyMode);

  // The session works on a fixed snapshot. Answered cards stop being "due" and disappear from the
  // live list, so indexing into the live list skipped every other card; we track answered ids instead.
  const [sessionCards] = useState<LeitnerCard[]>(() => initialCards);
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(() => new Set());

  const liveById = useMemo(() => new Map(allCards.map(c => [c.id, c])), [allCards]);

  const remaining = useMemo(
    () => sessionCards.filter(c => !answeredIds.has(c.id) && (!nounsOnly || isNounCard(c))),
    [sessionCards, answeredIds, nounsOnly]
  );

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [selectedArticleGuess, setSelectedArticleGuess] = useState<'der' | 'die' | 'das' | null>(null);
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    wrong: 0,
    mastered: 0,
    reflectionsRead: 0
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [editingContent, setEditingContent] = useState<string | null>(null);
  const [perfektResult, setPerfektResult] = useState<PerfektResult | null>(null);
  const knewRef = useRef<HTMLButtonElement>(null);
  const forgotRef = useRef<HTMLButtonElement>(null);
  const cardAreaRef = useRef<HTMLDivElement>(null);
  const shownCardIdRef = useRef<string | undefined>(undefined);

  const handleToggleNounsOnly = (checked: boolean) => {
    setNounsOnly(checked);
    leitnerEngine.saveSettings({ nounsOnlyMode: checked });
    onCardUpdated();
  };

  const snapshotCard = remaining[0];
  const currentCard = snapshotCard ? (liveById.get(snapshotCard.id) || snapshotCard) : undefined;
  const answeredCount = answeredIds.size;
  const sessionTotal = answeredCount + remaining.length;
  const isComplete = !currentCard && answeredCount > 0;
  const quizArticle = currentCard ? getQuizArticle(currentCard) : null;
  const articleGuessWrong = !!selectedArticleGuess && !!quizArticle && selectedArticleGuess !== quizArticle;
  // Verbs: the typed Perfekt decides; "Knew it" stays locked until it was answered correctly
  const perfektAccepted = useMemo(() => (currentCard ? perfektAnswers(currentCard) : []), [currentCard]);
  const hasPerfektQuiz = perfektAccepted.length > 0;
  const perfektLocked = hasPerfektQuiz && !perfektResult?.correct;

  const handleSpeak = useCallback(async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    await speechService.speak(text, leitnerEngine.getSettings().speechRate);
    setIsSpeaking(false);
  }, [isSpeaking]);

  // Reset card UI and auto-speak when a new card comes up
  useEffect(() => {
    setIsFlipped(false);
    setSelectedArticleGuess(null);
    setEditingContent(null);
    setPerfektResult(null);
    // Answered from further down a long card: bring the top of the next card back into view
    if (shownCardIdRef.current && currentCard) {
      const area = cardAreaRef.current;
      if (area && area.getBoundingClientRect().top < 0) area.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    shownCardIdRef.current = currentCard?.id;
    if (currentCard && currentCard.type === 'vocab' && currentCard.wort && leitnerEngine.getSettings().autoSpeak) {
      const speakWord = isNounCard(currentCard) ? stripArticleFromWord(currentCard.wort) : currentCard.wort;
      handleSpeak(speakWord);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard?.id]);

  // Celebrate once when the last card is answered
  useEffect(() => {
    if (isComplete) soundService.playMastered();
  }, [isComplete]);

  const handleFlip = () => {
    soundService.playFlip();
    setIsFlipped(f => !f);
  };

  const markAnswered = (id: string) => {
    setAnsweredIds(prev => new Set(prev).add(id));
  };

  const handleVocabAnswer = (isCorrect: boolean) => {
    if (!currentCard) return;
    // A wrong article guess or a missing / wrong Perfekt means the card wasn't really known
    if (isCorrect && (articleGuessWrong || perfektLocked)) return;

    if (isCorrect) {
      soundService.playSuccess();
    } else {
      soundService.playWrong();
    }

    const { newBox } = leitnerEngine.recordVocabAnswer(currentCard.id, isCorrect);
    const graduated = newBox >= MASTERED_BOX;
    if (graduated) soundService.playMastered();

    setSessionStats(prev => ({
      ...prev,
      correct: isCorrect ? prev.correct + 1 : prev.correct,
      wrong: !isCorrect ? prev.wrong + 1 : prev.wrong,
      mastered: graduated ? prev.mastered + 1 : prev.mastered
    }));

    markAnswered(currentCard.id);
    onCardUpdated();
  };

  const handleReflectionAcknowledge = () => {
    if (!currentCard) return;
    soundService.playSuccess();

    const { newBox } = leitnerEngine.acknowledgeReflection(currentCard.id);
    const graduated = newBox >= MASTERED_BOX;
    if (graduated) soundService.playMastered();

    setSessionStats(prev => ({
      ...prev,
      reflectionsRead: prev.reflectionsRead + 1,
      mastered: graduated ? prev.mastered + 1 : prev.mastered
    }));

    markAnswered(currentCard.id);
    onCardUpdated();
  };

  const handleSaveReflectionEdit = () => {
    if (!currentCard || editingContent === null) return;
    leitnerEngine.updateCard(currentCard.id, { content: editingContent });
    setEditingContent(null);
    onCardUpdated();
  };

  const handlePerfektGraded = (result: PerfektResult) => {
    setPerfektResult(result);
    if (result.correct) soundService.playSuccess();
    else soundService.playWrong();
    if (leitnerEngine.getSettings().autoSpeak) speechService.speak(result.expected, leitnerEngine.getSettings().speechRate);
    // Enter now records the result
    requestAnimationFrame(() => (result.correct ? knewRef : forgotRef).current?.focus());
  };

  const handleArticleSelect = (art: 'der' | 'die' | 'das') => {
    if (!currentCard || !quizArticle || selectedArticleGuess) return;
    setSelectedArticleGuess(art);
    if (art === quizArticle) {
      soundService.playSuccess();
    } else {
      soundService.playWrong();
    }
  };

  // Keyboard shortcuts (Space: flip, 1: wrong, 2: correct; D/E/S guess der/die/das; in noun mode 1/2/3 guess before flipping)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete || !currentCard) return;
      if (editingContent !== null) return; // Don't trigger shortcuts while editing
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      const canGuess = !isFlipped && !!quizArticle && !selectedArticleGuess;
      if (canGuess) {
        const key = e.key.toLowerCase();
        if (key === 'd') { e.preventDefault(); handleArticleSelect('der'); return; }
        if (key === 'e') { e.preventDefault(); handleArticleSelect('die'); return; }
        if (key === 's' || key === 'a') { e.preventDefault(); handleArticleSelect('das'); return; }
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
        if (canGuess && nounsOnly) {
          handleArticleSelect('der');
        } else if (currentCard.type === 'vocab') {
          handleVocabAnswer(false);
        }
      } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
        if (canGuess && nounsOnly) {
          handleArticleSelect('die');
        } else if (currentCard.type === 'vocab') {
          handleVocabAnswer(true);
        } else {
          handleReflectionAcknowledge();
        }
      } else if ((e.code === 'Digit3' || e.code === 'Numpad3') && canGuess && nounsOnly) {
        handleArticleSelect('das');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });


  const kbd = 'px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono-num font-bold';

  // If queue is empty
  if (!currentCard && answeredCount === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {nounsOnly ? t.review.emptyTitleNouns : t.review.emptyTitle}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {nounsOnly ? t.review.emptyBodyNouns : t.review.emptyBody}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {nounsOnly && (
            <button
              onClick={() => handleToggleNounsOnly(false)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              {t.review.showAllCards}
            </button>
          )}
          <button
            onClick={onFinishSession}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            {t.review.backToDashboard}
          </button>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete || !currentCard) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center shadow-lg animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{t.review.doneTitle}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t.review.doneBody(answeredCount)}</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: t.review.statCorrect, value: sessionStats.correct, cls: 'text-emerald-600' },
            { label: t.review.statWrong, value: sessionStats.wrong, cls: 'text-red-500' },
            { label: t.review.statInsights, value: sessionStats.reflectionsRead, cls: 'text-indigo-600' },
            { label: t.review.statMastered, value: sessionStats.mastered, cls: 'text-amber-500' }
          ].map(s => (
            <div key={s.label}>
              <span className="text-xs text-slate-600 dark:text-slate-400 block">{s.label}</span>
              <span className={`text-2xl font-bold font-mono-num ${s.cls}`}>{num(s.value)}</span>
            </div>
          ))}
        </div>

        <div className="p-5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-start space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{t.review.continueTitle}</span>
          </div>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">{t.review.continueBody}</p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {onStartNewWordsLearning && (
              <button
                onClick={onStartNewWordsLearning}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>{t.review.continueYes}</span>
              </button>
            )}
            <button
              onClick={onFinishSession}
              className="py-3 px-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              {t.review.continueNo}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const intervalDays = BOX_CONFIGS[currentCard.box]?.intervalDays ?? Math.pow(2, currentCard.box);
  const isNoun = currentCard.type === 'vocab' && isNounCard(currentCard);
  const frontWord = isNoun ? stripArticleFromWord(currentCard.wort) : currentCard.wort;
  const text = currentCard.type === 'vocab' ? vocabText(currentCard, lang) : null;
  const plural = isNoun ? pluralParts(currentCard) : [];
  const conjugation = conjugationOf(currentCard);
  const conjugationLocked = hasPerfektQuiz && !perfektResult;
  // Until the Perfekt is answered, don't give it away on the back of the card
  const hide = (s: string) => (hasPerfektQuiz && !perfektResult ? maskParticiples(s, perfektAccepted) : s);

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-12">

      {/* Session progress */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onFinishSession}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />
            <span>{t.review.exit}</span>
          </button>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {t.review.cardOf(answeredCount + 1, sessionTotal)}
          </span>
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
            <span className="hidden sm:inline">{t.review.currentBox(t.boxes.name(currentCard.box))}</span>
            <span className="sm:hidden">{t.boxes.name(currentCard.box)}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold whitespace-nowrap">
              {t.review.interval(intervalDays)}
            </span>
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
            style={{ width: `${((answeredCount + 1) / sessionTotal) * 100}%` }}
          />
        </div>
      </div>

      {/* Noun mode */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-3">
          <Switch id="nomenSwitch" checked={nounsOnly} onChange={handleToggleNounsOnly} className="mt-0.5" />
          <label htmlFor="nomenSwitch" className="cursor-pointer min-w-0">
            <span className="font-bold text-xs text-slate-900 dark:text-white block">{t.review.nounsToggleTitle}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-relaxed">{t.review.nounsToggleBody}</span>
          </label>
        </div>

        {nounsOnly && (
          <span className="self-start sm:self-auto text-xs text-indigo-700 dark:text-indigo-300 font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 shrink-0">
            {t.review.nounsInQueue(remaining.length)}
          </span>
        )}
      </div>

      {/* Flashcard */}
      <div ref={cardAreaRef} className="relative min-h-[400px] sm:min-h-[460px] flex flex-col scroll-mt-24">
        <div
          onClick={handleFlip}
          className="cursor-pointer flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-10 flex flex-col justify-between gap-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all relative overflow-hidden group select-none"
        >
          {/* Card header */}
          <div className="flex items-start justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="dot-list flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
              {currentCard.type === 'vocab' ? (
                <>
                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="whitespace-nowrap">{t.review.vocabSource}</span>
                  <span className="whitespace-nowrap">{t.common.lesson(currentCard.lektion || '01')}</span>
                  <span className="whitespace-nowrap">{t.common.level(currentCard.niveau || 'A1')}</span>
                  {currentCard.wortart && (
                    <>
                      <De className="italic font-semibold text-indigo-600 dark:text-indigo-400">{currentCard.wortart}</De>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {t.categories[currentCard.category || 'note']}
                  </span>
                  <span>{t.review.reflectionNoQuiz}</span>
                </>
              )}
            </div>

            <span
              className="flex items-center gap-1.5 shrink-0 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 transition-colors"
              title={isFlipped ? t.review.showFront : t.review.flip}
            >
              <RotateCw className="w-4 h-4" />
              <span className="hidden sm:inline">{isFlipped ? t.review.showFront : t.review.flip}</span>
            </span>
          </div>

          {/* FRONT */}
          {!isFlipped ? (
            <div className="py-6 sm:py-8 text-center space-y-6">
              {currentCard.type === 'vocab' ? (
                <>
                  <div className="space-y-3">
                    {isNoun && (
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold block">
                        {t.review.guessArticle}
                      </span>
                    )}
                    <De as="h2" className="block text-[clamp(1.875rem,9vw,3rem)] leading-tight font-extrabold text-slate-900 dark:text-white tracking-tight break-words hyphens-auto">
                      {frontWord}
                    </De>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeak(frontWord || '');
                      }}
                      disabled={isSpeaking}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                      title={t.review.pronounceTitle}
                    >
                      <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-indigo-600' : ''}`} />
                      <span>{t.review.pronounce}</span>
                    </button>
                  </div>

                  {/* Article quiz */}
                  {quizArticle ? (
                    <div
                      className="max-w-md mx-auto pt-4 border-t border-slate-100 dark:border-slate-800/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 mb-3">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {t.review.articleQuiz} (<De>der · die · das</De>)
                        </span>
                        <span className="hidden pointer-fine:inline text-[11px] text-slate-600 dark:text-slate-400">
                          {t.review.shortcuts(nounsOnly ? 'D / E / S · 1 / 2 / 3' : 'D / E / S')}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {([
                          { art: 'der', color: 'border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40', keyHint: nounsOnly ? '1 / D' : 'D' },
                          { art: 'die', color: 'border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40', keyHint: nounsOnly ? '2 / E' : 'E' },
                          { art: 'das', color: 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40', keyHint: nounsOnly ? '3 / S' : 'S' }
                        ] as const).map(({ art, color, keyHint }) => {
                          const isMatch = quizArticle === art;
                          const isGuessed = selectedArticleGuess === art;
                          const base = 'py-3 px-2 text-sm font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1';

                          let btnClass = `${base} bg-white dark:bg-slate-900 ${color}`;
                          if (isGuessed) {
                            btnClass = isMatch
                              ? `${base} border-emerald-500 bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300`
                              : `${base} border-red-500 bg-red-500 text-white shadow-md`;
                          } else if (selectedArticleGuess && isMatch) {
                            // Highlight the correct one after a wrong guess
                            btnClass = `${base} border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400`;
                          }

                          return (
                            <button
                              key={art}
                              type="button"
                              onClick={() => handleArticleSelect(art)}
                              disabled={!!selectedArticleGuess}
                              className={btnClass}
                            >
                              <De className="text-base">{art}</De>
                              <span className="text-[10px] font-normal opacity-75 pointer-fine:hidden">{t.articles[art]}</span>
                              <span className="text-[10px] font-mono-num font-normal opacity-75 hidden pointer-fine:inline">{keyHint}</span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedArticleGuess && (
                        <div className="mt-3.5 text-xs font-medium">
                          {selectedArticleGuess === quizArticle ? (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <span className="flex items-center gap-1.5 font-bold">
                                <Check className="w-4 h-4 shrink-0" />
                                <span>{t.review.articleRight(selectedArticleGuess)}</span>
                              </span>
                              <button
                                onClick={() => handleVocabAnswer(true)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold"
                              >
                                {t.review.recordRight}
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-2 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
                              <span className="flex items-center gap-1.5">
                                <X className="w-4 h-4 shrink-0" />
                                <span>{t.review.articleWrong(quizArticle)}</span>
                              </span>
                              <button
                                onClick={() => handleVocabAnswer(false)}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold"
                              >
                                {t.review.recordWrong}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : hasPerfektQuiz ? null : (
                    <div className="text-xs text-slate-600 dark:text-slate-400">{t.review.flipHint}</div>
                  )}
                </>
              ) : (
                /* Front of a reflection card */
                <div className="py-6 space-y-5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <Quote className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t.review.reflectionTitleLabel}</span>
                    <Auto as="h2" className="block text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-relaxed break-words">
                      {currentCard.title}
                    </Auto>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">{t.review.reflectionFrontHint}</p>
                </div>
              )}
            </div>
          ) : (
            /* BACK */
            <div className="py-4 space-y-6 text-start">
              {currentCard.type === 'vocab' && text ? (
                <>
                  <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-400 block">{t.review.meaningLabel}</span>
                    <Auto as="h3" className="block text-2xl sm:text-3xl font-extrabold text-indigo-700 dark:text-indigo-400 leading-snug">
                      {text.meaning}
                    </Auto>
                    <De as="div" className="text-lg pt-1 flex flex-wrap items-baseline gap-x-2 break-words hyphens-auto">
                      {quizArticle && (
                        <span className={`font-extrabold ${ARTICLE_COLOR[quizArticle]}`}>
                          {currentCard.artikel && currentCard.artikel !== '–' ? currentCard.artikel : quizArticle}
                        </span>
                      )}
                      <span className="font-bold text-slate-900 dark:text-white">
                        {quizArticle ? stripArticleFromWord(currentCard.wort) : currentCard.wort}
                      </span>
                    </De>
                    {conjugation && (
                      <div className="pt-2">
                        <ConjugationButton verb={currentCard.wort || ''} conjugation={conjugation} disabled={conjugationLocked} />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {plural.length > 0 && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-400 block mb-1">{t.review.plural}</span>
                        <PluralInfo parts={plural} />
                      </div>
                    )}

                    {text.formen && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-400 block mb-1">{t.review.formen}</span>
                        <Auto as="div" className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-start">{hide(text.formen)}</Auto>
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
                      className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t.review.exampleTitle}</span>
                        <button
                          type="button"
                          onClick={() => handleSpeak(text.exampleDe)}
                          disabled={isSpeaking}
                          className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 transition-colors"
                          title={t.review.playExample}
                          aria-label={t.review.playExample}
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
                </>
              ) : (
                /* Back of a reflection card */
                <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-400">{t.review.reflectionFull}</span>
                    <button
                      onClick={() => setEditingContent(editingContent !== null ? null : (currentCard.content || ''))}
                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{editingContent !== null ? t.common.cancel : t.review.editNote}</span>
                    </button>
                  </div>

                  {editingContent !== null ? (
                    <div className="space-y-3">
                      <textarea
                        dir="auto"
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={5}
                        className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                      />
                      <button
                        onClick={handleSaveReflectionEdit}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                      >
                        {t.review.saveChanges}
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <Auto as="p" className="block text-base text-slate-900 dark:text-white leading-loose whitespace-pre-wrap text-start">
                        {currentCard.content || t.review.noContent}
                      </Auto>
                    </div>
                  )}

                  <div className="text-xs text-slate-600 dark:text-slate-400">{t.review.reflectionFooter}</div>
                </div>
              )}
            </div>
          )}

          {/* Keyboard shortcuts (only on devices with a keyboard/mouse) */}
          <div className="hidden pointer-fine:flex pt-4 border-t border-slate-100 dark:border-slate-800 items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <span>{t.review.kbdFlip} <kbd className={kbd}>Space</kbd></span>
            <span>
              {t.review.kbdAnswer} <kbd className={kbd}>1</kbd> {t.review.kbdAnd} <kbd className={kbd}>2</kbd>
            </span>
          </div>
        </div>

        {/* Perfekt quiz (verbs), kept outside the card so it stays visible when the card is flipped */}
        {hasPerfektQuiz && (
          <div className="mt-4">
            <PerfektQuiz key={currentCard.id} accepted={perfektAccepted} onGraded={handlePerfektGraded} />
            {perfektResult && conjugation && (
              <div className="mt-2 flex justify-end">
                <ConjugationButton verb={currentCard.wort || ''} conjugation={conjugation} />
              </div>
            )}
          </div>
        )}

        {/* Answer buttons (sticky at the bottom on phones) */}
        <div className={`mt-4 ${MOBILE_STICKY_ACTIONS}`}>
          {currentCard.type === 'vocab' ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                ref={forgotRef}
                type="button"
                onClick={() => handleVocabAnswer(false)}
                className="flex items-center justify-center gap-2 py-3.5 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded-2xl font-bold text-sm shadow-xs active:scale-98 transition-all"
              >
                <X className="w-5 h-5 text-red-600 shrink-0" />
                <span className="flex flex-col items-start leading-tight">
                  <span>{t.review.forgot}</span>
                  <span className="text-[11px] font-normal opacity-80">{t.review.forgotHint}</span>
                </span>
                <kbd className="hidden pointer-fine:inline text-xs opacity-75 font-mono-num font-normal">1</kbd>
              </button>

              <button
                ref={knewRef}
                type="button"
                onClick={() => handleVocabAnswer(true)}
                disabled={articleGuessWrong || perfektLocked}
                title={articleGuessWrong ? t.review.wrongArticleTitle : perfektLocked ? t.perfekt.locked : undefined}
                className="flex items-center justify-center gap-2 py-3.5 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm shadow-sm active:scale-98 transition-all"
              >
                <Check className="w-5 h-5 shrink-0" />
                <span className="flex flex-col items-start leading-tight">
                  <span>{t.review.knew}</span>
                  <span className="text-[11px] font-normal opacity-85">{t.review.knewHint}</span>
                </span>
                <kbd className="hidden pointer-fine:inline text-xs opacity-80 font-mono-num font-normal">2</kbd>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleReflectionAcknowledge}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-base shadow-sm active:scale-98 transition-all"
            >
              <Check className="w-5 h-5 shrink-0" />
              <span>{t.review.readDone}</span>
              <span className="text-xs font-normal opacity-85">({t.review.readDoneHint})</span>
              <kbd className="hidden pointer-fine:inline text-xs opacity-80 font-mono-num font-normal">2</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
