import React, { useState } from 'react';
import { LeitnerCard, BOX_CONFIGS } from '../types/leitner';
import { isCardDue, getTodayString, isNounCard, getQuizArticle } from '../services/leitnerEngine';
import { vocabText } from '../services/vocabText';
import { Play, CheckCircle2, HelpCircle, BookOpen, Target, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { De, Auto } from './ui/Text';
import { InstallBanner } from './AppInstall';

interface LeitnerDashboardProps {
  cards: LeitnerCard[];
  onStartReview: (boxFilter?: number, nounsOnly?: boolean) => void;
  onStartNewWordsLearning: () => void;
  onNavigateToCatalog: () => void;
  onNavigateToReflections: () => void;
  onOpenNewCardModal: () => void;
  onOpenSettings?: () => void;
}

const ARTICLE_CHIP: Record<'der' | 'die' | 'das', string> = {
  der: 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800',
  die: 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
  das: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
};

export const LeitnerDashboard: React.FC<LeitnerDashboardProps> = ({
  cards,
  onStartReview,
  onStartNewWordsLearning,
  onOpenSettings
}) => {
  const { t, lang, num, date } = useI18n();
  const [selectedBoxModal, setSelectedBoxModal] = useState<number | null>(null);
  const todayStr = getTodayString();

  const dueTodayCards = cards.filter(c => isCardDue(c, todayStr));
  const dueNounsCards = dueTodayCards.filter(c => isNounCard(c));
  const masteredCards = cards.filter(c => c.box >= 6);
  const vocabCards = cards.filter(c => c.type === 'vocab' && c.box < 6);
  const reflectionCards = cards.filter(c => c.type === 'reflection' && c.box < 6);

  const allNounsCards = cards.filter(c => isNounCard(c));
  const articleCounts = {
    der: allNounsCards.filter(c => getQuizArticle(c) === 'der').length,
    die: allNounsCards.filter(c => getQuizArticle(c) === 'die').length,
    das: allNounsCards.filter(c => getQuizArticle(c) === 'das').length
  };
  const masteredNouns = allNounsCards.filter(c => c.box >= 6).length;

  const getBoxCards = (boxIndex: number) => cards.filter(c => c.box === boxIndex);
  const getBoxDueCount = (boxIndex: number) => cards.filter(c => c.box === boxIndex && isCardDue(c, todayStr)).length;
  const modalCards = selectedBoxModal === null ? [] : cards.filter(c => c.box === selectedBoxModal);

  return (
    <div className="space-y-8 pb-12">
      {onOpenSettings && <InstallBanner onShowHow={onOpenSettings} />}

      {/* Hero / status */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 lg:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 min-w-0">
            <div className="dot-list flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              <i aria-hidden="true" className="w-2 h-2 rounded-full bg-indigo-500" />
              <span>{t.dashboard.badgeAlgorithm}</span>
              <span className="text-slate-600 dark:text-slate-400">{t.dashboard.badgeDrop}</span>
              <span className="text-blue-600 dark:text-blue-400">{t.dashboard.badgeNouns}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {t.dashboard.title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              {t.dashboard.subtitle}
            </p>
          </div>

          {/* Calls to action */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-stretch sm:items-center gap-3 shrink-0">
            {dueTodayCards.length > 0 ? (
              <button
                onClick={() => onStartReview()}
                className="flex items-center justify-center gap-3 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white rounded-xl font-semibold shadow-sm transition-all"
              >
                <Play className="w-5 h-5 fill-current rtl:-scale-x-100" />
                <span>{t.dashboard.startReview}</span>
                <span className="px-2 py-0.5 bg-indigo-800 text-indigo-100 rounded-md font-mono-num text-xs font-bold">
                  {num(dueTodayCards.length)}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-3 px-5 py-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm font-medium">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{t.dashboard.allDone}</span>
              </div>
            )}

            {dueNounsCards.length > 0 && (
              <button
                onClick={() => onStartReview(undefined, true)}
                className="flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                title={t.dashboard.nounReviewHint}
              >
                <Target className="w-4 h-4" />
                <span>{t.dashboard.nounReview}</span>
                <span className="px-2 py-0.5 bg-blue-800 text-blue-100 rounded-md font-mono-num font-bold">
                  {t.common.nouns(dueNounsCards.length)}
                </span>
              </button>
            )}

            <button
              onClick={onStartNewWordsLearning}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors shadow-2xs"
              title={t.dashboard.learnNewHint}
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.dashboard.learnNew}</span>
            </button>
          </div>
        </div>

        {/* Article mastery */}
        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-slate-900 dark:text-white block">
                {t.dashboard.articlesTitle}
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400">
                {t.dashboard.articlesSummary(allNounsCards.length, masteredNouns)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {(['der', 'die', 'das'] as const).map(art => (
              <span key={art} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${ARTICLE_CHIP[art]}`}>
                <De className="font-bold">{art}</De>
                <span className="font-mono-num">{num(articleCounts[art])}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">{t.dashboard.dueToday}</span>
            <span className="text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400">
              {num(dueTodayCards.length)}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
              {t.dashboard.dueSplit(dueNounsCards.length, dueTodayCards.length - dueNounsCards.length)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">{t.dashboard.inRotation}</span>
            <span className="text-2xl font-bold font-mono-num text-slate-900 dark:text-white">
              {num(cards.filter(c => c.box < 6).length)}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 block">
              {t.dashboard.rotationSplit(vocabCards.length, reflectionCards.length)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">{t.dashboard.mastered}</span>
            <span className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400">
              {num(masteredCards.length)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 dark:text-slate-400 block">{t.dashboard.masteryRate}</span>
            <span className="text-2xl font-bold font-mono-num text-indigo-600 dark:text-indigo-400">
              {t.common.percent(cards.length > 0 ? Math.round((masteredCards.length / cards.length) * 100) : 0)}
            </span>
          </div>
        </div>
      </div>

      {/* The Leitner boxes */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t.dashboard.boxesTitle}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.dashboard.boxesSubtitle}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-3.5">
          {BOX_CONFIGS.map((box) => {
            const boxCards = getBoxCards(box.index);
            const dueCount = getBoxDueCount(box.index);
            const vocabCount = boxCards.filter(c => c.type === 'vocab').length;
            const refCount = boxCards.filter(c => c.type === 'reflection').length;

            return (
              <div
                key={box.index}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{t.boxes.name(box.index)}</span>
                    <span dir="ltr" className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {t.boxes.formula(box.index, box.intervalDays)}
                    </span>
                  </div>

                  <div className="mb-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-extrabold font-mono-num text-slate-900 dark:text-white">{num(boxCards.length)}</span>
                      <span className="text-xs text-slate-600 dark:text-slate-400">{t.dashboard.cardUnit}</span>
                    </div>
                    <span className="text-[11px] text-slate-600 dark:text-slate-400 block mt-0.5">
                      {t.dashboard.interval(box.intervalDays)}
                    </span>
                  </div>

                  <div className="mb-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                    {dueCount > 0 ? (
                      <div className="flex items-center justify-between gap-1 text-amber-600 dark:text-amber-400 font-medium">
                        <span className="text-[11px]">{t.dashboard.boxDue}</span>
                        <span className="font-bold font-mono-num px-1 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-[11px]">{num(dueCount)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px]">{t.dashboard.boxNoDue}</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 text-[10px] text-slate-600 dark:text-slate-400">
                    <span>{t.dashboard.boxVocab(vocabCount)}</span>
                    <span>{t.dashboard.boxRefl(refCount)}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {dueCount > 0 && (
                      <button
                        onClick={() => onStartReview(box.index)}
                        className="w-full py-1.5 px-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-semibold text-center transition-colors"
                      >
                        {t.dashboard.reviewN(dueCount)}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedBoxModal(box.index)}
                      className="w-full py-1.5 px-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
                      title={t.dashboard.viewHint}
                    >
                      {t.dashboard.viewN(boxCards.length)}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mastered archive */}
      <div className="bg-gradient-to-l rtl:bg-gradient-to-r from-transparent via-emerald-500/5 to-emerald-500/10 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{t.dashboard.archiveTitle}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">{t.dashboard.archiveBody}</p>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
          <div className="text-start sm:text-end">
            <span className="text-2xl font-bold font-mono-num text-emerald-700 dark:text-emerald-300 block">{num(masteredCards.length)}</span>
            <span className="text-xs text-emerald-800 dark:text-emerald-400">{t.dashboard.archiveUnit}</span>
          </div>
          <button
            onClick={() => setSelectedBoxModal(6)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            {t.dashboard.archiveView}
          </button>
        </div>
      </div>

      {/* Rules */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3 text-slate-900 dark:text-white font-bold text-sm">
          <HelpCircle className="w-4 h-4 text-indigo-500" />
          <span>{t.dashboard.rulesTitle}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-slate-600 dark:text-slate-400">
          {t.dashboard.rules.map(rule => (
            <div key={rule.title} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">{rule.title}</span>
              <p className="leading-relaxed">{rule.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cards in a box */}
      {selectedBoxModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setSelectedBoxModal(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {selectedBoxModal === 6 ? t.boxes.mastered : t.dashboard.modalTitleBox(t.boxes.name(selectedBoxModal))}
                </h3>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {selectedBoxModal === 6
                    ? t.dashboard.modalSubtitleArchive
                    : t.dashboard.modalSubtitleBox(BOX_CONFIGS[selectedBoxModal]?.intervalDays ?? 0)}
                </span>
              </div>
              <button
                onClick={() => setSelectedBoxModal(null)}
                aria-label={t.common.close}
                className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              {modalCards.length === 0 ? (
                <div className="py-12 text-center text-slate-600 dark:text-slate-400 text-sm">{t.dashboard.modalEmpty}</div>
              ) : (
                modalCards.map((card) => (
                  <div
                    key={card.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {card.type === 'vocab' ? (
                          <De className="font-bold text-slate-900 dark:text-white break-words">{card.wort}</De>
                        ) : (
                          <>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                              {t.categories[card.category || 'note']}
                            </span>
                            <Auto className="font-bold text-slate-900 dark:text-white">{card.title}</Auto>
                          </>
                        )}
                      </div>
                      <Auto as="p" className="text-xs text-slate-600 dark:text-slate-400 text-start">
                        {card.type === 'vocab' ? vocabText(card, lang).meaning : card.content}
                      </Auto>
                    </div>

                    <div className="shrink-0 text-xs text-slate-600 dark:text-slate-400 sm:text-end">
                      {card.box < 6 && <div>{t.dashboard.due(date(`${card.nextReviewDate}T12:00:00`))}</div>}
                      {isCardDue(card, todayStr) && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold block text-[11px]">{t.dashboard.dueNow}</span>
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
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
