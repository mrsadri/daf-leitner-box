import React, { useState, useEffect, useCallback } from 'react';
import { LeitnerCard } from '../types/leitner';
import { leitnerEngine, stripArticleFromWord, getQuizArticle, calculateNextReviewDate } from '../services/leitnerEngine';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import { Volume2, RotateCw, ArrowRight, BookOpen, PlusCircle, CheckCircle2, Sparkles, SkipForward } from 'lucide-react';

interface NewWordsStudySessionProps {
  onFinish: () => void;
  onCardAdded: () => void;
}

export const NewWordsStudySession: React.FC<NewWordsStudySessionProps> = ({
  onFinish,
  onCardAdded
}) => {
  const [unlearnedWords, setUnlearnedWords] = useState<LeitnerCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [selectedArticleGuess, setSelectedArticleGuess] = useState<'der' | 'die' | 'das' | null>(null);
  const [addedCount, setAddedCount] = useState<number>(0);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [hadWordsAtStart, setHadWordsAtStart] = useState<boolean>(false);

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

  if (!currentWord || unlearnedWords.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {addedCount > 0 || hadWordsAtStart ? 'جلسه ورود کلمات جدید پایان یافت' : 'همه واژگان کتاب وارد لایتنر شده‌اند!'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {addedCount > 0 || hadWordsAtStart
              ? `شما ${addedCount} کلمه جدید را یاد گرفتید و به خانه شماره صفر لایتنر اضافه کردید.`
              : 'تمامی واژگان کتاب DaF kompakt در حال حاضر در یکی از خانه‌های لایتنر یا بخش تسلط کامل قرار دارند.'}
          </p>
        </div>
        <button
          onClick={onFinish}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
        >
          بازگشت به داشبورد لایتنر
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex items-center justify-between text-xs">
        <button
          onClick={onFinish}
          className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>پایان جلسه و ذخیره</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            واژه جدید {currentIndex + 1} از {unlearnedWords.length} (به ترتیب درس‌های DaF kompakt)
          </span>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono-num font-bold">
          <span>{addedCount} افزوده شده به خانه ۰</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-2xl flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200">
        <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="leading-relaxed">
          واژگان کتاب به ترتیب درس‌ها از جدول خارج شده و به شما ارائه می‌شوند. پس از بررسی معنی و آرتیکل، با زدن دکمه <strong>«افزودن به خانه شماره ۰»</strong> وارد چرخه مرور روز بعد می‌شوند.
        </p>
      </div>

      {/* Interactive Card */}
      <div className="relative min-h-[420px] flex flex-col">
        <div
          onClick={handleFlip}
          className="cursor-pointer flex-1 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 flex flex-col justify-between shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all select-none"
        >
          {/* Card Top Meta */}
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <span>کتاب DaF kompakt</span>
              <span aria-hidden="true">·</span>
              <span>درس {currentWord.lektion}</span>
              <span aria-hidden="true">·</span>
              <span>سطح {currentWord.niveau}</span>
              {currentWord.wortart && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="italic font-semibold text-indigo-600 dark:text-indigo-400">{currentWord.wortart}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-slate-500">
              <RotateCw className="w-4 h-4" />
              <span>{isFlipped ? 'نمایش رو' : 'مشاهده معنی و آرتیکل کامل'}</span>
            </div>
          </div>

          {/* FRONT */}
          {!isFlipped ? (
            <div className="py-8 text-center space-y-6">
              <div className="space-y-3">
                {isNoun && (
                  <span className="text-xs text-slate-400 block">واژه آلمانی (آرتیکل پنهان شده تا حدس بزنید):</span>
                )}
                {/* Word with article STRIPPED */}
                <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight font-de dir-ltr">
                  {frontWordDisplay}
                </h2>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(frontWordDisplay || '');
                    }}
                    disabled={isSpeaking}
                    className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>تلفظ صوتی</span>
                  </button>
                </div>
              </div>

              {/* If Noun: Article Challenge */}
              {isNoun && (
                <div
                  className="max-w-md mx-auto pt-4 border-t border-slate-100 dark:border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2.5">
                    حدس شما برای آرتیکل این اسم چیست؟
                  </span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {([
                      { art: 'der', color: 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40' },
                      { art: 'die', color: 'border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40' },
                      { art: 'das', color: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40' }
                    ] as const).map(({ art, color }) => {
                      const isMatch = quizArticle === art;
                      const isGuessed = selectedArticleGuess === art;

                      let btnStyle = `py-2.5 px-3 font-de font-bold text-sm rounded-xl border-2 transition-all ${color}`;
                      if (isGuessed) {
                        btnStyle = isMatch 
                          ? 'py-2.5 px-3 font-de font-bold text-sm rounded-xl border-2 bg-emerald-500 text-white border-emerald-500 shadow-md ring-2 ring-emerald-300'
                          : 'py-2.5 px-3 font-de font-bold text-sm rounded-xl border-2 bg-red-500 text-white border-red-500 shadow-md';
                      }

                      return (
                        <button
                          key={art}
                          type="button"
                          onClick={() => handleArticleSelect(art)}
                          className={btnStyle}
                        >
                          {art}
                        </button>
                      );
                    })}
                  </div>

                  {selectedArticleGuess && (
                    <div className="mt-3 text-xs">
                      {selectedArticleGuess === quizArticle ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          ✓ صحیح است! آرتیکل این اسم {selectedArticleGuess} است. برای دیدن معنی کارت را برگردانید.
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 font-semibold">
                          ✗ نادرست بود! برای دیدن آرتیکل و معنی صحیح، کارت را برگردانید.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-400">
                برای مشاهده معنی فارسی و جزئیات کتاب روی کارت کلیک کنید.
              </p>
            </div>
          ) : (
            /* BACK */
            <div className="py-4 space-y-6 text-right">
              {/* Full Word with Article REVEALED */}
              <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-400 block">واژه کامل با آرتیکل:</span>
                <div className="flex items-baseline justify-between">
                  <div className="dir-ltr text-left">
                    {quizArticle && (
                      <span className={`text-xl font-de font-bold ml-2 ${
                        quizArticle === 'der' ? 'text-blue-600 dark:text-blue-400' :
                        quizArticle === 'die' ? 'text-red-600 dark:text-red-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {quizArticle}
                      </span>
                    )}
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-de">
                      {stripArticleFromWord(currentWord.wort)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSpeak(quizArticle ? `${quizArticle} ${stripArticleFromWord(currentWord.wort)}` : (currentWord.wort || ''));
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="pt-2">
                  <span className="text-xs text-slate-400 block">معنی فارسی:</span>
                  <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                    {currentWord.persisch}
                  </p>
                </div>
              </div>

              {/* Grammar Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {currentWord.plural && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400 block mb-1">فرم جمع (Plural):</span>
                    <span className="font-bold font-de text-slate-900 dark:text-white dir-ltr block text-left">
                      {currentWord.plural}
                    </span>
                  </div>
                )}

                {currentWord.formen && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 sm:col-span-2">
                    <span className="text-slate-400 block mb-1">صرف و اشکال گرامری:</span>
                    <span className="font-de text-slate-800 dark:text-slate-200 dir-ltr block text-left">
                      {currentWord.formen}
                    </span>
                  </div>
                )}

                {currentWord.oesterreich && (
                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 sm:col-span-2">
                    <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1">
                      🇦🇹 گویش اتریشی (Österreich):
                    </span>
                    <span className="text-amber-900 dark:text-amber-200">
                      {currentWord.oesterreich}
                    </span>
                  </div>
                )}
              </div>

              {/* Example */}
              {currentWord.beispiel && (
                <div
                  className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                    مثال کاربردی کتاب DaF kompakt:
                  </span>
                  <p className="text-sm font-de text-slate-900 dark:text-white dir-ltr text-left leading-relaxed">
                    {currentWord.beispiel}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Bottom Flip Reminder */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>کلید میانبر چرخاندن: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono-num font-bold">Space</kbd></span>
            <span>کلید افزودن به خانه ۰: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono-num font-bold">Enter</kbd></span>
          </div>
        </div>

        {/* Primary Action Button: Add to Box 0 (or skip) */}
        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={goToNextWord}
            className="flex items-center justify-center gap-2 py-4 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl font-semibold text-sm transition-colors"
            title="این واژه فعلاً به لایتنر اضافه نشود"
          >
            <SkipForward className="w-4 h-4" />
            <span>رد کردن</span>
          </button>
          <button
            type="button"
            onClick={handleAddToBox0}
            className="flex-1 flex items-center justify-center gap-3 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-2xl font-bold text-base shadow-sm transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            <span>یاد گرفتم، افزودن به خانه شماره ۰ لایتنر (مرور فردا)</span>
          </button>
        </div>
      </div>

    </div>
  );
};
