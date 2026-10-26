import React, { useState, useEffect, useCallback } from 'react';
import { LeitnerCard } from '../types/leitner';
import { leitnerEngine, stripArticleFromWord, getQuizArticle, calculateNextReviewDate } from '../services/leitnerEngine';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import { vocabText, perfektAnswers, pluralParts } from '../services/vocabText';
import { maskParticiples, PerfektResult } from '../services/perfekt';
import { PerfektQuiz } from './PerfektQuiz';
import { PluralInfo } from './PluralInfo';
import { Volume2, RotateCw, ArrowLeft, BookOpen, PlusCircle, CheckCircle2, Sparkles, SkipForward } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { De, Auto } from './ui/Text';

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
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [hadWordsAtStart, setHadWordsAtStart] = useState<boolean>(false);
  const [perfektResult, setPerfektResult] = useState<PerfektResult | null>(null);

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

  const handleSpeak = useCallback(async (text: string) => {
    if (!text || isSpeaking) return;
    setIsSpeaking(true);
    await speechService.speak(text, leitnerEngine.getSettings().speechRate);
    setIsSpeaking(false);
  }, [isSpeaking]);

  useEffect(() => {
    if (currentWord && leitnerEngine.getSettings().autoSpeak && !isFlipped) {
      // Speak the stripped word on front so speech doesn't spoil article either!
      handleSpeak(frontWordDisplay || '');
    }
    setIsFlipped(false);
    setSelectedArticleGuess(null);
    setPerfektResult(null);
  }, [currentIndex, currentWord?.id]);

  const handleFlip = () => {
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
    soundService.playSuccess();

    // The word was just studied, so its first review is tomorrow (Box 0 interval = 2^0 = 1 day)
    leitnerEngine.addCard({
      ...currentWord,
      nextReviewDate: calculateNextReviewDate(0)
    });

    setAddedCount(prev => prev + 1);
    onCardAdded();
    goToNextWord();
  };

  const goToNextWord = () => {
    if (currentIndex + 1 < unlearnedWords.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // No more unlearned words left
      setUnlearnedWords([]);
    }
  };

  // Keyboard shortcut (Space to flip, Enter to add)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentWord) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (e.code === 'Enter') {
        if (isFlipped) {
          e.preventDefault();
          handleAddToBox0();
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
  }, [currentWord, isFlipped, isNoun, currentIndex]);


  const kbd = 'px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-mono-num font-bold';

  if (!currentWord || unlearnedWords.length === 0) {
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
        <button
          onClick={onFinish}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
        >
          {t.newWords.backToDashboard}
        </button>
      </div>
    );
  }

  const text = vocabText(currentWord, lang);
  const plural = isNoun ? pluralParts(currentWord) : [];
  const perfektAccepted = perfektAnswers(currentWord);
  // Until the practice answer is in, don't give the Perfekt away on the back of the card
  const hide = (s: string) => (perfektAccepted.length && !perfektResult ? maskParticiples(s, perfektAccepted) : s);

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6 pb-12">

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

      {/* Info banner */}
      <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{t.newWords.banner}</p>
      </div>

      {/* Card */}
      <div className="relative min-h-[400px] flex flex-col">
        <div
          onClick={handleFlip}
          className="cursor-pointer flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-10 flex flex-col justify-between gap-4 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all select-none"
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

            <span className="flex items-center gap-1.5 shrink-0 text-slate-500" title={isFlipped ? t.review.showFront : t.newWords.flip}>
              <RotateCw className="w-4 h-4" />
              <span className="hidden sm:inline">{isFlipped ? t.review.showFront : t.newWords.flip}</span>
            </span>
          </div>

          {/* FRONT */}
          {!isFlipped ? (
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
            /* BACK */
            <div className="py-4 space-y-6 text-start">
              <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400 block">{t.newWords.fullWord}</span>
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
                      handleSpeak(quizArticle ? `${quizArticle} ${stripArticleFromWord(currentWord.wort)}` : (currentWord.wort || ''));
                    }}
                    title={t.review.pronounceTitle}
                    aria-label={t.review.pronounceTitle}
                    className="p-1.5 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="pt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 block">{t.review.meaningLabel}</span>
                  <Auto as="p" className="block text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 leading-snug text-start">
                    {text.meaning}
                  </Auto>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
            <span>{t.review.kbdFlip} <kbd className={kbd}>Space</kbd></span>
            <span>{t.newWords.kbdAdd} <kbd className={kbd}>Enter</kbd></span>
          </div>
        </div>

        {perfektAccepted.length > 0 && (
          <div className="mt-4">
            <PerfektQuiz
              key={currentWord.id}
              accepted={perfektAccepted}
              practice
              onGraded={r => {
                setPerfektResult(r);
                if (r.correct) soundService.playSuccess();
                else soundService.playWrong();
                if (leitnerEngine.getSettings().autoSpeak) speechService.speak(r.expected, leitnerEngine.getSettings().speechRate);
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex flex-col-reverse sm:flex-row gap-3">
          <button
            type="button"
            onClick={goToNextWord}
            className="flex items-center justify-center gap-2 py-3.5 sm:py-4 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-sm transition-colors"
            title={t.newWords.skipHint}
          >
            <SkipForward className="w-4 h-4 rtl:-scale-x-100" />
            <span>{t.newWords.skip}</span>
          </button>
          <button
            type="button"
            onClick={handleAddToBox0}
            className="flex-1 flex items-center justify-center gap-3 py-4 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-2xl font-bold text-base shadow-sm transition-all"
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            <span className="flex flex-col items-start leading-tight">
              <span>{t.newWords.add}</span>
              <span className="text-xs font-normal opacity-85">{t.newWords.addHint}</span>
            </span>
          </button>
        </div>
      </div>

    </div>
  );
};
