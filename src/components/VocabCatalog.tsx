import React, { useState, useMemo, useEffect } from 'react';
import { LeitnerCard } from '../types/leitner';
import { speechService } from '../services/speechService';
import { soundService } from '../services/soundService';
import { getQuizArticle, stripArticleFromWord } from '../services/leitnerEngine';
import { vocabText, pluralParts, conjugationOf } from '../services/vocabText';
import { ConjugationButton } from './ConjugationDialog';
import { PluralInfo } from './PluralInfo';
import { Search, Volume2, Plus, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { De, Auto } from './ui/Text';

const PAGE_LIMIT = 100;

interface VocabCatalogProps {
  catalogWords: LeitnerCard[];
  activeCards: LeitnerCard[];
  onAddWordToLeitner: (word: LeitnerCard) => void;
  onBatchAddWords: (words: LeitnerCard[]) => void;
}

export const VocabCatalog: React.FC<VocabCatalogProps> = ({
  catalogWords,
  activeCards,
  onAddWordToLeitner,
  onBatchAddWords
}) => {
  const { t, lang } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLektion, setSelectedLektion] = useState<string>('all');
  const [selectedNiveau, setSelectedNiveau] = useState<string>('all');
  const [selectedWortart, setSelectedWortart] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'not_in_box' | 'in_box'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Map of active cards for O(1) lookup
  const activeCardMap = useMemo(() => {
    const map = new Map<string, LeitnerCard>();
    activeCards.forEach(c => {
      if (c.type === 'vocab') {
        if (c.wort) map.set(c.wort.toLowerCase().trim(), c);
        map.set(c.id, c);
      }
    });
    return map;
  }, [activeCards]);

  // Unique lessons list
  const lektionen = useMemo(() => {
    const set = new Set<string>();
    catalogWords.forEach(w => {
      if (w.lektion) set.add(w.lektion);
    });
    return Array.from(set).sort();
  }, [catalogWords]);

  // Word types with their counts, most frequent first ("Nomen", "Verb", …)
  const wortarten = useMemo(() => {
    const counts = new Map<string, number>();
    catalogWords.forEach(w => {
      if (w.wortart) counts.set(w.wortart, (counts.get(w.wortart) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [catalogWords]);

  // Filtered list
  const filteredWords = useMemo(() => {
    return catalogWords.filter(word => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        word.wort?.toLowerCase().includes(q) || 
        word.persisch?.toLowerCase().includes(q) ||
        word.englisch?.toLowerCase().includes(q) ||
        word.beispiel?.toLowerCase().includes(q);

      const matchesLektion = selectedLektion === 'all' || word.lektion === selectedLektion;
      const matchesNiveau = selectedNiveau === 'all' || word.niveau === selectedNiveau;
      const matchesWortart = selectedWortart === 'all' || word.wortart === selectedWortart;

      const isInBox = activeCardMap.has(word.id) || (word.wort && activeCardMap.has(word.wort.toLowerCase().trim()));
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'in_box' && isInBox) || 
        (statusFilter === 'not_in_box' && !isInBox);

      return matchesSearch && matchesLektion && matchesNiveau && matchesWortart && matchesStatus;
    });
  }, [catalogWords, searchQuery, selectedLektion, selectedNiveau, selectedWortart, statusFilter, activeCardMap]);

  // A selection made under other filters may include words that are no longer visible
  useEffect(() => {
    setSelectedIds(new Set());
  }, [searchQuery, selectedLektion, selectedNiveau, selectedWortart, statusFilter]);

  const handleSelectAllFiltered = () => {
    const notInBoxFiltered = filteredWords.filter(
      w => !activeCardMap.has(w.id) && !(w.wort && activeCardMap.has(w.wort.toLowerCase().trim()))
    );
    if (selectedIds.size === notInBoxFiltered.length && notInBoxFiltered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(notInBoxFiltered.map(w => w.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddSelectedToLeitner = () => {
    const toAdd = catalogWords.filter(w => selectedIds.has(w.id));
    if (toAdd.length > 0) {
      soundService.playSuccess();
      onBatchAddWords(toAdd);
      setSelectedIds(new Set());
    }
  };

  const handleAddEntireLesson = () => {
    if (selectedLektion === 'all') return;
    const lessonWords = catalogWords.filter(
      w => w.lektion === selectedLektion && !activeCardMap.has(w.id) && !(w.wort && activeCardMap.has(w.wort.toLowerCase().trim()))
    );
    if (lessonWords.length > 0) {
      soundService.playSuccess();
      onBatchAddWords(lessonWords);
    }
  };


  const field = 'w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none';

  return (
    <div className="space-y-6 pb-12">

      {/* Header & filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t.catalog.title}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">{t.catalog.subtitle}</p>
          </div>

          {selectedLektion !== 'all' && (
            <button
              onClick={handleAddEntireLesson}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>{t.catalog.addLesson(selectedLektion)}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="search"
              dir="auto"
              placeholder={t.catalog.searchPlaceholder}
              aria-label={t.common.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${field} ps-9`}
            />
          </div>

          <select value={selectedLektion} onChange={(e) => setSelectedLektion(e.target.value)} className={field}>
            <option value="all">{t.catalog.allLessons}</option>
            {lektionen.map(l => (
              <option key={l} value={l}>{t.common.lesson(l)}</option>
            ))}
          </select>

          <select value={selectedNiveau} onChange={(e) => setSelectedNiveau(e.target.value)} className={field}>
            <option value="all">{t.catalog.allLevels}</option>
            {['A1', 'A2', 'B1'].map(lv => (
              <option key={lv} value={lv}>{t.common.level(lv)}</option>
            ))}
          </select>

          <select value={selectedWortart} onChange={(e) => setSelectedWortart(e.target.value)} className={field} aria-label={t.wortart.all}>
            <option value="all">{t.wortart.all}</option>
            {wortarten.map(([w, count]) => (
              <option key={w} value={w}>{t.wortart.option(w, t.wortart.names[w], count)}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className={field}>
            <option value="all">{t.catalog.allStatuses}</option>
            <option value="not_in_box">{t.catalog.notInBox}</option>
            <option value="in_box">{t.catalog.inBox}</option>
          </select>
        </div>

        {selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">{t.catalog.selectedCount(selectedIds.size)}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {t.catalog.clearSelection}
              </button>
              <button
                onClick={handleAddSelectedToLeitner}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                {t.catalog.addSelected(selectedIds.size)}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 px-1">
        <span>{t.catalog.showing(filteredWords.length, catalogWords.length)}</span>
        <button onClick={handleSelectAllFiltered} className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium">
          {selectedIds.size > 0 ? t.catalog.clearAll : t.catalog.selectAll}
        </button>
      </div>

      {filteredWords.length === 0 && (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">{t.catalog.empty}</div>
      )}

      {/* Words */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredWords.slice(0, PAGE_LIMIT).map((word) => {
          const active = activeCardMap.get(word.id) || (word.wort ? activeCardMap.get(word.wort.toLowerCase().trim()) : null);
          const isSelected = selectedIds.has(word.id);
          const article = getQuizArticle(word);
          const text = vocabText(word, lang);
          const plural = article ? pluralParts(word) : [];
          const conjugation = conjugationOf(word);

          return (
            <div
              key={word.id}
              className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl flex flex-col justify-between gap-3 shadow-2xs transition-all ${
                isSelected
                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="min-w-0">
                {/* Meta */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  <label className="dot-list flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                    {!active && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(word.id)}
                        aria-label={t.catalog.select}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    )}
                    <span className="whitespace-nowrap">{t.common.lesson(word.lektion || '')}</span>
                    <span className="whitespace-nowrap">{t.common.level(word.niveau || '')}</span>
                    {word.wortart && (
                      <>
                        <De>{word.wortart}</De>
                      </>
                    )}
                  </label>

                  <span className={`shrink-0 text-[11px] ${active ? 'font-medium text-emerald-700 dark:text-emerald-400' : ''}`}>
                    {active ? (active.box >= 6 ? t.catalog.mastered : t.catalog.inBoxN(t.boxes.name(active.box))) : t.catalog.ready}
                  </span>
                </div>

                {/* Word */}
                <div className="flex items-start justify-between gap-3">
                  <De as="div" className="flex flex-wrap items-baseline gap-x-2 min-w-0 break-words hyphens-auto">
                    {article && (
                      <span className={`text-xs font-bold ${
                        article === 'der' ? 'text-blue-600 dark:text-blue-400' :
                        article === 'die' ? 'text-red-600 dark:text-red-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {article}
                      </span>
                    )}
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                      {article ? stripArticleFromWord(word.wort) : word.wort}
                    </span>
                  </De>

                  <button
                    type="button"
                    onClick={() => speechService.speak(word.wort || '')}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                    title={t.catalog.pronounce}
                    aria-label={t.catalog.pronounce}
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                <Auto as="p" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mt-1 text-start">{text.meaning}</Auto>

                {(plural.length > 0 || text.formen || text.oesterreich) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] space-y-1 text-slate-500 dark:text-slate-400">
                    {plural.length > 0 && (
                      <div className="flex items-baseline gap-1.5">
                        <De className="text-slate-400 shrink-0">Plural:</De>
                        <PluralInfo parts={plural} compact />
                      </div>
                    )}
                    {text.formen && (
                      <Auto as="div" className="text-start">
                        <span className="text-slate-400 font-de" dir="ltr">Formen:</span>{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">{text.formen}</span>
                      </Auto>
                    )}
                    {text.oesterreich && (
                      <Auto as="div" className="text-start text-amber-600 dark:text-amber-400">🇦🇹 {text.oesterreich}</Auto>
                    )}
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
                <ConjugationButton verb={word.wort || ''} conjugation={conjugation} />
                <span className="flex-1" />
                {active ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.catalog.active}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playSuccess();
                      onAddWordToLeitner(word);
                    }}
                    className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.catalog.add}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredWords.length > PAGE_LIMIT && (
        <div className="text-center py-4 text-xs text-slate-600 dark:text-slate-400">{t.catalog.moreHint(PAGE_LIMIT)}</div>
      )}

    </div>
  );
};
