import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LeitnerCard, BOX_CONFIGS, MASTERED_BOX, REFLECTION_CATEGORY_NAMES } from '../types/leitner';
import { leitnerEngine, isNounCard, stripArticleFromWord, getQuizArticle } from '../services/leitnerEngine';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import { Volume2, RotateCw, Check, X, Sparkles, ArrowRight, Trophy, BookOpen, Quote, Edit3 } from 'lucide-react';

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
    // A wrong article guess means the card wasn't really known
    if (isCorrect && articleGuessWrong) return;

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

  // If queue is empty
  if (!currentCard && answeredCount === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {nounsOnly ? 'هیچ اسمی (Nomen) برای مرور در این نوبت وجود ندارد!' : 'هیچ کارتی برای مرور امروز وجود ندارد!'}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
          {nounsOnly
            ? 'تمام اسامی امروز مرور شده‌اند، یا کارتی از نوع اسم برای سررسید امروز موجود نیست. سایر کارت‌های غیر اسمی در خانه فعلی خود دست‌نخورده باقی مانده‌اند.'
            : 'همه مرورهای امروز شما با موفقیت انجام شده‌اند یا کارتی برای امروز زمان‌بندی نشده است.'}
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          {nounsOnly && (
            <button
              onClick={() => handleToggleNounsOnly(false)}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              نمایش همه کارت‌ها (غیر اسامی)
            </button>
          )}
          <button
            onClick={onFinishSession}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors"
          >
            بازگشت به داشبورد
          </button>
        </div>
      </div>
    );
  }

  // Completion screen
  if (isComplete || !currentCard) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-6">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center shadow-lg animate-bounce">
          <Trophy className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            جلسه مرور با موفقیت به پایان رسید!
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            شما تمام {answeredCount} کارت این نوبت را بررسی کردید و به یادگیری تثبیت‌شده نزدیک‌تر شدید.
          </p>
        </div>

        {/* Stats card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">پاسخ درست</span>
            <span className="text-2xl font-bold font-mono-num text-emerald-600">{sessionStats.correct}</span>
          </div>
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">نیازمند تکرار</span>
            <span className="text-2xl font-bold font-mono-num text-red-500">{sessionStats.wrong}</span>
          </div>
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">بینش و تصمیم</span>
            <span className="text-2xl font-bold font-mono-num text-indigo-600">{sessionStats.reflectionsRead}</span>
          </div>
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">فارغ‌التحصیل جدید</span>
            <span className="text-2xl font-bold font-mono-num text-amber-500">{sessionStats.mastered}</span>
          </div>
        </div>

        {/* Post-Review Intake Prompt (Requested by User) */}
        <div className="p-5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-right space-y-3">
          <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-sm">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>آیا می‌خواهید با یادگیری کلمات جدید ادامه دهید؟</span>
          </div>
          <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
            کلمات جدید کتاب DaF kompakt به ترتیب از درس‌های اولیه آورده می‌شوند. ابتدا معنی و آرتیکل آن‌ها را بررسی و تمرین می‌کنید، و با تأیید شما در خانه شماره صفر (مرور فردا) قرار می‌گیرند.
          </p>
          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            {onStartNewWordsLearning && (
              <button
                onClick={onStartNewWordsLearning}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <BookOpen className="w-4 h-4" />
                <span>بله، شروع یادگیری کلمات جدید کتاب به ترتیب</span>
              </button>
            )}
            <button
              onClick={onFinishSession}
              className="py-3 px-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              خیر، بازگشت به داشبورد
            </button>
          </div>
        </div>
      </div>
    );
  }

  const boxConfig = BOX_CONFIGS[currentCard.box] || {
    name: 'خانه ویژه',
    intervalDays: Math.pow(2, currentCard.box),
    formula: `۲^${currentCard.box}`
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* Top Session Progress Bar */}
      <div className="flex items-center justify-between gap-4 text-xs">
        <button
          onClick={onFinishSession}
          className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>خروج از جلسه</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
            کارت {answeredCount + 1} از {sessionTotal}
          </span>
          <div className="w-32 sm:w-48 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 transition-all duration-300 rounded-full"
              style={{ width: `${((answeredCount + 1) / sessionTotal) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <span>خانه کنونی: {boxConfig.name}</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono-num font-bold">
            فاصله {boxConfig.intervalDays} روز
          </span>
        </div>
      </div>

      {/* Nouns & Article Learning Switch Bar (Requested by User) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="relative inline-flex items-center">
            <input
              type="checkbox"
              id="nomenSwitch"
              checked={nounsOnly}
              onChange={(e) => handleToggleNounsOnly(e.target.checked)}
              className="sr-only peer"
            />
            <div 
              onClick={() => handleToggleNounsOnly(!nounsOnly)}
              className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="nomenSwitch" className="font-bold text-xs text-slate-900 dark:text-white cursor-pointer block">
              سوییچ حالت اختصاصی اسامی (Nomen) و یادگیری آرتیکل‌ها
            </label>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              با فعال‌سازی این سوییچ، فقط اسامی (der / die / das) مرور می‌شوند و سایر کارت‌ها اسکیپ شده و در خانه فعلی‌شان بدون تغییر باقی می‌مانند.
            </span>
          </div>
        </div>

        {nounsOnly && (
          <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 font-mono-num font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 shrink-0">
            <span>{remaining.length} اسم در نوبت مرور</span>
          </div>
        )}
      </div>

      {/* Main Flashcard Container */}
      <div className="relative min-h-[420px] sm:min-h-[460px] flex flex-col">
        
        {/* Card Frame */}
        <div 
          onClick={handleFlip}
          className="cursor-pointer flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 flex flex-col justify-between shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all relative overflow-hidden group select-none"
        >
          {/* Top Card Header */}
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              {currentCard.type === 'vocab' ? (
                <>
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span>واژه DaF kompakt</span>
                  <span aria-hidden="true">·</span>
                  <span>درس {currentCard.lektion || '۰۱'}</span>
                  <span aria-hidden="true">·</span>
                  <span>سطح {currentCard.niveau || 'A1'}</span>
                  {currentCard.wortart && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="italic font-semibold text-indigo-600 dark:text-indigo-400">{currentCard.wortart}</span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {REFLECTION_CATEGORY_NAMES[currentCard.category || 'note']}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>بدون آزمون (صرفاً بازبینی)</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 transition-colors">
              <RotateCw className="w-4 h-4" />
              <span>{isFlipped ? 'نمایش رو' : 'چرخش کارت'}</span>
            </div>
          </div>

          {/* FRONT SIDE */}
          {!isFlipped ? (
            <div className="py-8 text-center space-y-6">
              {currentCard.type === 'vocab' ? (
                <>
                  {/* German Word (Article stripped on front so user can guess it!) */}
                  {(() => {
                    const isNoun = isNounCard(currentCard);
                    const frontWord = isNoun ? stripArticleFromWord(currentCard.wort) : currentCard.wort;

                    return (
                      <div className="space-y-3">
                        {isNoun && (
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold block">
                            واژه آلمانی (آرتیکل پنهان شده تا حدس بزنید):
                          </span>
                        )}
                        <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight font-de dir-ltr">
                          {frontWord}
                        </h2>

                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSpeak(frontWord || '');
                            }}
                            disabled={isSpeaking}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                            title="تلفظ صوتی آلمانی"
                          >
                            <Volume2 className={`w-4 h-4 ${isSpeaking ? 'animate-pulse text-indigo-600' : ''}`} />
                            <span>تلفظ آلمانی</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Interactive Article Guess Buttons (For Nouns & Article Learning) */}
                  {quizArticle ? (
                    <div 
                      className="max-w-md mx-auto pt-4 border-t border-slate-100 dark:border-slate-800/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          🎯 آزمون آرتیکل اسم (der · die · das)
                        </span>
                        <span className="text-[11px] text-slate-600 dark:text-slate-400">
                          کلیدهای میانبر: D / E / S{nounsOnly ? ' یا 1 / 2 / 3' : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        {([
                          { art: 'der', label: 'der (مذکر)', color: 'border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40', keyHint: nounsOnly ? '1 / D' : 'D' },
                          { art: 'die', label: 'die (مؤنث)', color: 'border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40', keyHint: nounsOnly ? '2 / E' : 'E' },
                          { art: 'das', label: 'das (خنثی)', color: 'border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40', keyHint: nounsOnly ? '3 / S' : 'S' }
                        ] as const).map(({ art, label, color, keyHint }) => {
                          const isMatch = quizArticle === art;
                          const isGuessed = selectedArticleGuess === art;

                          let btnClass = `py-3 px-3 text-sm font-de font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 bg-white dark:bg-slate-900 ${color}`;
                          
                          if (isGuessed) {
                            if (isMatch) {
                              btnClass = 'py-3 px-3 text-sm font-de font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 border-emerald-500 bg-emerald-500 text-white shadow-md ring-2 ring-emerald-300';
                            } else {
                              btnClass = 'py-3 px-3 text-sm font-de font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 border-red-500 bg-red-500 text-white shadow-md';
                            }
                          } else if (selectedArticleGuess && isMatch) {
                            // Highlight the correct one if user made a wrong guess
                            btnClass = 'py-3 px-3 text-sm font-de font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-400';
                          }

                          return (
                            <button
                              key={art}
                              type="button"
                              onClick={() => handleArticleSelect(art)}
                              disabled={!!selectedArticleGuess}
                              className={btnClass}
                            >
                              <span className="text-base">{art}</span>
                              <span className="text-[10px] font-mono-num font-normal opacity-75">{keyHint}</span>
                            </button>
                          );
                        })}
                      </div>

                      {selectedArticleGuess && (
                        <div className="mt-3.5 p-3 rounded-xl text-xs font-medium">
                          {selectedArticleGuess === quizArticle ? (
                            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                              <span className="flex items-center gap-1.5 font-bold">
                                <Check className="w-4 h-4" />
                                <span>عالی! آرتیکل {selectedArticleGuess} کاملاً درست است.</span>
                              </span>
                              <button
                                onClick={() => handleVocabAnswer(true)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold"
                              >
                                ثبت پاسخ درست (+۱ پله)
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 p-2.5 rounded-lg border border-red-200 dark:border-red-800">
                              <span>
                                ✗ اشتباه بود! آرتیکل صحیح این واژه <strong className="font-de underline">{quizArticle}</strong> است.
                              </span>
                              <button
                                onClick={() => handleVocabAnswer(false)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold"
                              >
                                ثبت پاسخ غلط (-۱ پله)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      برای مشاهده معنی فارسی و کاربرد در جمله، کارت را بچرخانید.
                    </div>
                  )}
                </>
              ) : (
                /* FRONT OF REFLECTION CARD */
                <div className="py-6 space-y-5">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                    <Quote className="w-6 h-6" />
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">عنوان تصمیم یا موضوع:</span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white leading-relaxed">
                      {currentCard.title}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    این کارت بر اساس بازه ۲ⁿ روز لایتنر به شما یادآوری شده است. برای خواندن متن کامل تصمیم روی کارت کلیک کنید.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* BACK SIDE OF CARD */
            <div className="py-4 space-y-6 text-right">
              {currentCard.type === 'vocab' ? (
                <>
                  {/* Persian Translation & Full Details */}
                  <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-400 block">معنی فارسی:</span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-indigo-700 dark:text-indigo-400">
                      {currentCard.persisch}
                    </h3>
                    {quizArticle && (
                      <div className="text-lg font-de pt-1 flex items-baseline gap-2 dir-ltr text-left">
                        <span className={`font-extrabold ${ARTICLE_COLOR[quizArticle]}`}>
                          {currentCard.artikel && currentCard.artikel !== '–' ? currentCard.artikel : quizArticle}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {stripArticleFromWord(currentCard.wort)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Grammar Details (Plural & Formen) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {currentCard.plural && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400 block mb-1">حالت جمع (Plural):</span>
                        <span className="font-bold font-de text-slate-900 dark:text-white dir-ltr block text-left">
                          {currentCard.plural}
                        </span>
                      </div>
                    )}

                    {currentCard.formen && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                        <span className="text-slate-600 dark:text-slate-400 block mb-1">اشکال گرامری و صرفی (Formen):</span>
                        <span className="font-medium font-de text-slate-800 dark:text-slate-200 dir-ltr block text-left leading-relaxed">
                          {currentCard.formen}
                        </span>
                      </div>
                    )}

                    {currentCard.oesterreich && (
                      <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 sm:col-span-2">
                        <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1">
                          🇦🇹 گویش و کاربرد در اتریش (Österreich):
                        </span>
                        <span className="text-amber-900 dark:text-amber-200">
                          {currentCard.oesterreich}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Example Sentence */}
                  {currentCard.beispiel && (
                    <div 
                      className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                          مثال کاربردی در DaF kompakt:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak(currentCard.beispiel || '')}
                          disabled={isSpeaking}
                          className="p-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 transition-colors"
                          title="پخش صوت مثال"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-de text-slate-900 dark:text-white leading-relaxed dir-ltr text-left">
                        {currentCard.beispiel}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                /* BACK OF REFLECTION CARD */
                <div 
                  className="space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-600 dark:text-slate-400">متن کامل و یادداشت تصمیم:</span>
                    <button
                      onClick={() => setEditingContent(editingContent !== null ? null : (currentCard.content || ''))}
                      className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{editingContent !== null ? 'انصراف' : 'ویرایش یادداشت'}</span>
                    </button>
                  </div>

                  {editingContent !== null ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={5}
                        className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
                      />
                      <button
                        onClick={handleSaveReflectionEdit}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold"
                      >
                        ذخیره تغییرات
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl">
                      <p className="text-base text-slate-900 dark:text-white leading-loose whitespace-pre-wrap">
                        {currentCard.content || 'متنی برای این کارت ثبت نشده است.'}
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    این کارت بر اساس قانون لایتنر پس از هر بار مطالعه به خانه بعدی با فواصل زمانی تصاعدی منتقل خواهد شد.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Flip Reminder */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span>کلید میانبر چرخاندن: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono-num font-bold">Space</kbd></span>
            <span>کلیدهای پاسخ: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono-num font-bold">1</kbd> و <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono-num font-bold">2</kbd></span>
          </div>
        </div>

        {/* Action Decision Buttons */}
        <div className="mt-4">
          {currentCard.type === 'vocab' ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleVocabAnswer(false)}
                className="flex items-center justify-center gap-2 py-3.5 px-4 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50 rounded-2xl font-bold text-sm shadow-xs active:scale-98 transition-all"
              >
                <X className="w-5 h-5 text-red-600" />
                <span>فراموش کردم (افت ۱ پله)</span>
                <span className="text-xs opacity-75 font-mono-num font-normal">[1]</span>
              </button>

              <button
                type="button"
                onClick={() => handleVocabAnswer(true)}
                disabled={articleGuessWrong}
                title={articleGuessWrong ? 'آرتیکل را اشتباه حدس زدید؛ این کارت باید یک پله عقب برود' : undefined}
                className="flex items-center justify-center gap-2 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm shadow-sm active:scale-98 transition-all"
              >
                <Check className="w-5 h-5" />
                <span>بلد بودم (+۱ پله لایتنر)</span>
                <span className="text-xs opacity-80 font-mono-num font-normal">[2]</span>
              </button>
            </div>
          ) : (
            /* REFLECTION / DECISION CARD ACTION */
            <div className="w-full">
              <button
                type="button"
                onClick={handleReflectionAcknowledge}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-base shadow-sm active:scale-98 transition-all"
              >
                <Check className="w-5 h-5" />
                <span>خواندم و مرور شد (+۱ پله به خانه بعدی)</span>
                <span className="text-xs opacity-80 font-mono-num font-normal">[2]</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
