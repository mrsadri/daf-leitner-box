import React, { useState } from 'react';
import { LeitnerCard, BOX_CONFIGS, REFLECTION_CATEGORY_NAMES } from '../types/leitner';
import { isCardDue, getTodayString, isNounCard, getQuizArticle } from '../services/leitnerEngine';
import { Play, Sparkles, CheckCircle2, AlertCircle, ArrowUpRight, HelpCircle, Layers, Calendar, ChevronLeft, BookOpen, Target } from 'lucide-react';

interface LeitnerDashboardProps {
  cards: LeitnerCard[];
  onStartReview: (boxFilter?: number, nounsOnly?: boolean) => void;
  onStartNewWordsLearning: () => void;
  onNavigateToCatalog: () => void;
  onNavigateToReflections: () => void;
  onOpenNewCardModal: () => void;
}

export const LeitnerDashboard: React.FC<LeitnerDashboardProps> = ({
  cards,
  onStartReview,
  onStartNewWordsLearning,
  onNavigateToCatalog,
  onNavigateToReflections,
  onOpenNewCardModal
}) => {
  const [selectedBoxModal, setSelectedBoxModal] = useState<number | null>(null);
  const todayStr = getTodayString();

  const dueTodayCards = cards.filter(c => isCardDue(c, todayStr));
  const dueNounsCards = cards.filter(c => isCardDue(c, todayStr) && isNounCard(c));
  const masteredCards = cards.filter(c => c.box >= 6);
  const vocabCards = cards.filter(c => c.type === 'vocab' && c.box < 6);
  const reflectionCards = cards.filter(c => c.type === 'reflection' && c.box < 6);

  const allNounsCards = cards.filter(c => isNounCard(c));
  const derCount = allNounsCards.filter(c => getQuizArticle(c) === 'der').length;
  const dieCount = allNounsCards.filter(c => getQuizArticle(c) === 'die').length;
  const dasCount = allNounsCards.filter(c => getQuizArticle(c) === 'das').length;
  const masteredNouns = allNounsCards.filter(c => c.box >= 6).length;

  const getBoxCards = (boxIndex: number) => cards.filter(c => c.box === boxIndex);
  const getBoxDueCount = (boxIndex: number) => cards.filter(c => c.box === boxIndex && isCardDue(c, todayStr)).length;

  return (
    <div className="space-y-8 pb-12">
      
      {/* Top Hero / Status Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>الگوریتم لایتنر با فواصل زمانی ۲ⁿ روز</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-slate-600 dark:text-slate-400">قانون افت ۱ پله‌ای</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-blue-600 dark:text-blue-400">سوییچ اختصاصی اسامی (Nomen)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              داشبورد جعبه‌های لایتنر
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              وضعیت کارت‌های فعال در خانه‌های شش‌گانه، سررسیدهای روزانه و تلفیق واژگان DaF kompakt با یادداشت‌ها و تصمیم‌های فردی.
            </p>
          </div>

          {/* Review Due CTA */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {dueTodayCards.length > 0 ? (
              <button
                onClick={() => onStartReview()}
                className="flex items-center justify-center gap-3 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl font-semibold shadow-sm transition-all"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>شروع مرور عمومی امروز</span>
                <span className="px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded-md font-mono-num text-xs font-bold">
                  {dueTodayCards.length}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>تمام مرورهای امروز انجام شده است!</span>
              </div>
            )}

            {/* Dedicated Noun Review Button */}
            {dueNounsCards.length > 0 && (
              <button
                onClick={() => onStartReview(undefined, true)}
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                title="فقط مرور اسامی جهت یادگیری آرتیکل‌ها (سایر کارت‌ها اسکیپ شده و در خانه خود باقی می‌مانند)"
              >
                <Target className="w-4 h-4" />
                <span>مرور اسامی و آرتیکل‌ها</span>
                <span className="px-2 py-0.5 bg-blue-800 text-blue-100 rounded-md font-mono-num font-bold">
                  {dueNounsCards.length} اسم
                </span>
              </button>
            )}

            <button
              onClick={onStartNewWordsLearning}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
              title="ورود کلمات جدید کتاب به ترتیب درس‌ها به خانه صفر"
            >
              <BookOpen className="w-4 h-4" />
              <span>+ یادگیری کلمات جدید کتاب</span>
            </button>
          </div>
        </div>

        {/* Article Mastery Widget (Requested by User) */}
        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-right">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                توزیع اسامی و تسلط بر آرتیکل‌ها (Nomen & Articles)
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                مجموع اسامی در لایتنر: <strong className="font-mono-num">{allNounsCards.length}</strong> اسم (تثبیت‌شده: <strong className="font-mono-num">{masteredNouns}</strong>)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-num">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
              <span className="font-bold">der:</span>
              <span>{derCount}</span>
            </span>

            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800">
              <span className="font-bold">die:</span>
              <span>{dieCount}</span>
            </span>

            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
              <span className="font-bold">das:</span>
              <span>{dasCount}</span>
            </span>
          </div>
        </div>

        {/* Global Key Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">آماده مرور امروز</span>
            <span className="text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400">
              {dueTodayCards.length}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
              {dueNounsCards.length} اسم · {dueTodayCards.length - dueNounsCards.length} سایر
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">کارت‌های در گردش</span>
            <span className="text-2xl font-bold font-mono-num text-slate-900 dark:text-white">
              {cards.filter(c => c.box < 6).length}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
              {vocabCards.length} واژه · {reflectionCards.length} تصمیم/انگیزه
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">تثبیت‌شده در حافظه (Mastered)</span>
            <span className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
              {masteredCards.length}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">نرخ تسلط کلی</span>
            <span className="text-2xl font-bold font-mono-num text-indigo-600 dark:text-indigo-400">
              {cards.length > 0 ? Math.round((masteredCards.length / cards.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>

      {/* The 6 Leitner Boxes View */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              خانه‌های شش‌گانه جعبه لایتنر (خانه ۰ تا ۵)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              فواصل زمانی ۲ⁿ روز: ۱، ۲، ۴، ۸، ۱۶ و ۳۲ روز. با هر پاسخ درست کارت یک پله به جلو و با هر خطا فقط یک پله به عقب بازمی‌گردد.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {BOX_CONFIGS.map((box) => {
            const boxCards = getBoxCards(box.index);
            const dueCount = getBoxDueCount(box.index);
            const vocabCount = boxCards.filter(c => c.type === 'vocab').length;
            const refCount = boxCards.filter(c => c.type === 'reflection').length;

            return (
              <div
                key={box.index}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all relative overflow-hidden group"
              >
                {/* Header of box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                      {box.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono-num font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {box.formula}
                    </span>
                  </div>

                  {/* Interval Highlight */}
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold font-mono-num text-slate-900 dark:text-white">
                        {boxCards.length}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">کارت</span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5">
                      فاصله: {box.intervalDays} روز
                    </span>
                  </div>

                  {/* Due Today Badge in Box */}
                  <div className="mb-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    {dueCount > 0 ? (
                      <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 font-medium">
                        <span className="text-[11px]">سررسید امروز:</span>
                        <span className="font-bold font-mono-num px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-[11px]">
                          {dueCount}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">
                        امروز سررسید ندارد
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer details & Action */}
                <div className="space-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400">
                    <span>{vocabCount} واژه</span>
                    <span>{refCount} انگیزه</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {dueCount > 0 && (
                      <button
                        onClick={() => onStartReview(box.index)}
                        className="w-full py-1 px-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold text-center transition-colors"
                      >
                        مرور ({dueCount})
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedBoxModal(box.index)}
                      className="w-full py-1 px-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
                      title="مشاهده لیست کارت‌های این خانه"
                    >
                      مشاهده ({boxCards.length})
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mastered Archive Shelf */}
      <div className="bg-gradient-to-l from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 text-right">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              بایگانی تسلط کامل (Mastered)
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
              کارت‌هایی که هر ۶ خانه (از خانه ۰ تا خانه ۵ با فاصله ۳۲ روز) را با موفقیت پشت سر گذاشته‌اند. این کارت‌ها از چرخه روزانه خارج شده و در حافظه دائم شما تثبیت گردیده‌اند.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-center sm:text-left">
            <span className="text-2xl font-bold font-mono-num text-emerald-700 dark:text-emerald-300 block">
              {masteredCards.length}
            </span>
            <span className="text-xs text-emerald-800 dark:text-emerald-400">کارت فارغ‌التحصیل</span>
          </div>
          <button
            onClick={() => setSelectedBoxModal(6)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            مشاهده بایگانی
          </button>
        </div>
      </div>

      {/* Information Box on User Custom Rules */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-3 text-slate-900 dark:text-white font-bold text-sm">
          <HelpCircle className="w-4 h-4 text-indigo-500" />
          <span>قوانین ریاضی و ساختاری لایتنر شما</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-slate-600 dark:text-slate-400">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">۱. فواصل زمانی تصاعدی</span>
            <p>فاصله مرور برابر با ۲ به توان ایندکس خانه (۱، ۲، ۴، ۸، ۱۶ و ۳۲ روز) است.</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">۲. بازگشت تک‌پله‌ای</span>
            <p>در پاسخ غلط، کارت فقط ۱ خانه به عقب برمی‌گردد، نه به ابتدای خانه اول.</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">۳. ورودی نامحدود کلمات</span>
            <p>برای شروع یادگیری و ورود به خانه اول، هیچ محدودیت یا سقف روزانه‌ای وجود ندارد.</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">۴. کارت‌های تصمیم و انگیزه</span>
            <p>بدون تست گرامر؛ صرفاً در بازه‌های لایتنر نمایش داده شده و با زدن «خواندم» پیش می‌روند.</p>
          </div>
        </div>
      </div>

      {/* Modal for Inspecting Cards in a Specific Box */}
      {selectedBoxModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {selectedBoxModal === 6 ? 'بایگانی تسلط کامل' : `کارت‌های موجود در ${BOX_CONFIGS[selectedBoxModal]?.name}`}
                </h3>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedBoxModal === 6 ? 'فارغ‌التحصیل از لایتنر' : `فاصله مرور: ${BOX_CONFIGS[selectedBoxModal]?.intervalDays} روز`}
                </span>
              </div>
              <button
                onClick={() => setSelectedBoxModal(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {cards.filter(c => c.box === selectedBoxModal).length === 0 ? (
                <div className="py-12 text-center text-slate-600 dark:text-slate-400 text-sm">
                  هیچ کارتی در این خانه وجود ندارد.
                </div>
              ) : (
                cards.filter(c => c.box === selectedBoxModal).map((card) => (
                  <div
                    key={card.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {card.type === 'vocab' ? (
                          <>
                            <span className="font-bold text-slate-900 dark:text-white font-de">
                              {card.wort}
                            </span>
                            {card.artikel && card.artikel !== '–' && (
                              <span className={`text-[11px] font-mono-num font-semibold ${
                                card.artikel === 'der' ? 'text-blue-600' : card.artikel === 'die' ? 'text-red-600' : 'text-emerald-600'
                              }`}>
                                ({card.artikel})
                              </span>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                              {REFLECTION_CATEGORY_NAMES[card.category || 'note']}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {card.title}
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {card.type === 'vocab' ? card.persisch : card.content}
                      </p>
                    </div>

                    <div className="text-left shrink-0 text-xs text-slate-600 dark:text-slate-400 font-mono-num">
                      <div>سررسید: {card.nextReviewDate}</div>
                      {isCardDue(card, todayStr) && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold block text-[11px]">
                          امروز آماده مرور
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedBoxModal(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
