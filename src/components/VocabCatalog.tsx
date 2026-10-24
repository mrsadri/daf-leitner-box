import React, { useState, useMemo } from 'react';
import { LeitnerCard } from '../types/leitner';
import { speechService } from '../services/speechService';
import { soundService } from '../services/soundService';
import { Search, Filter, Volume2, Plus, Check, BookOpen, Layers, CheckSquare } from 'lucide-react';

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

  // Unique wortarts
  const wortarten = useMemo(() => {
    const set = new Set<string>();
    catalogWords.forEach(w => {
      if (w.wortart) set.add(w.wortart);
    });
    return Array.from(set).sort();
  }, [catalogWords]);

  // Filtered list
  const filteredWords = useMemo(() => {
    return catalogWords.filter(word => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        word.wort?.toLowerCase().includes(q) || 
        word.persisch?.toLowerCase().includes(q) ||
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

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header & Policy */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              مخزن واژگان DaF kompakt (A1 تا B1)
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              دیتابیس کامل شامل بیش از ۳۴۰۰ لغت کتاب (۳۰ درس) همراه با آرتیکل، معانی دقیق فارسی، اشکال گرامری، کاربرد در اتریش و جملات نمونه.
              طبق قاعده اختصاصی شما، هیچ محدودیت روزانه‌ای برای افزودن واژگان به خانه اول وجود ندارد.
            </p>
          </div>

          {selectedLektion !== 'all' && (
            <button
              onClick={handleAddEntireLesson}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن کل درس {selectedLektion} به خانه اول</span>
            </button>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          
          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="جستجوی واژه آلمانی یا معنی فارسی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Lektion Filter */}
          <div>
            <select
              value={selectedLektion}
              onChange={(e) => setSelectedLektion(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">تمام درس‌ها (Lektionen)</option>
              {lektionen.map(l => (
                <option key={l} value={l}>درس {l}</option>
              ))}
            </select>
          </div>

          {/* Niveau Filter */}
          <div>
            <select
              value={selectedNiveau}
              onChange={(e) => setSelectedNiveau(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">تمام سطوح (A1 تا B1)</option>
              <option value="A1">سطح A1</option>
              <option value="A2">سطح A2</option>
              <option value="B1">سطح B1</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="not_in_box">هنوز در لایتنر نیست</option>
              <option value="in_box">در لایتنر موجود است</option>
            </select>
          </div>

        </div>

        {/* Batch selection toolbar if items selected */}
        {selectedIds.size > 0 && (
          <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between gap-4">
            <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
              {selectedIds.size} واژه برای ورود انتخاب شده است.
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                لغو انتخاب
              </button>
              <button
                onClick={handleAddSelectedToLeitner}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                افزودن به خانه اول ({selectedIds.size})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
        <span>نمایش {filteredWords.length} واژه از مجموع {catalogWords.length} واژه</span>
        <button
          onClick={handleSelectAllFiltered}
          className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium"
        >
          {selectedIds.size > 0 ? 'لغو انتخاب همه' : 'انتخاب تمام لغات ناموجود این صفحه'}
        </button>
      </div>

      {/* Words List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredWords.slice(0, 100).map((word) => {
          const active = activeCardMap.get(word.id) || (word.wort ? activeCardMap.get(word.wort.toLowerCase().trim()) : null);
          const isSelected = selectedIds.has(word.id);

          return (
            <div
              key={word.id}
              className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl flex flex-col justify-between gap-3 shadow-2xs transition-all ${
                isSelected 
                  ? 'border-indigo-500 ring-1 ring-indigo-500' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                {/* Meta header */}
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 mb-2">
                  <div className="flex items-center gap-2">
                    {!active && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(word.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    )}
                    <span>درس {word.lektion}</span>
                    <span aria-hidden="true">·</span>
                    <span>سطح {word.niveau}</span>
                    {word.wortart && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{word.wortart}</span>
                      </>
                    )}
                  </div>

                  {active ? (
                    <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                      {active.box >= 6 ? 'تثبیت‌شده' : `در خانه ${active.box}`}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-600 dark:text-slate-400">آماده ورود</span>
                  )}
                </div>

                {/* Main Word Line */}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2 dir-ltr text-left">
                    {word.artikel && word.artikel !== '–' && (
                      <span className={`text-xs font-de font-bold ${
                        word.artikel === 'der' ? 'text-blue-600 dark:text-blue-400' :
                        word.artikel === 'die' ? 'text-red-600 dark:text-red-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {word.artikel}
                      </span>
                    )}
                    <span className="text-base font-bold text-slate-900 dark:text-white font-de">
                      {word.wort}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => speechService.speak(word.wort || '')}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors shrink-0"
                    title="تلفظ"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Persian Translation */}
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">
                  {word.persisch}
                </p>

                {/* Grammatical hints & Example */}
                {(word.plural || word.formen || word.oesterreich) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-[11px] space-y-1 text-slate-500 dark:text-slate-400">
                    {word.plural && (
                      <div className="dir-ltr text-left">
                        <span className="text-slate-400">Plural: </span>
                        <span className="font-de font-medium text-slate-700 dark:text-slate-300">{word.plural}</span>
                      </div>
                    )}
                    {word.formen && (
                      <div className="dir-ltr text-left">
                        <span className="text-slate-400">Formen: </span>
                        <span className="font-de font-medium text-slate-700 dark:text-slate-300">{word.formen}</span>
                      </div>
                    )}
                    {word.oesterreich && (
                      <div>
                        <span className="text-amber-600 dark:text-amber-400">🇦🇹 {word.oesterreich}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex justify-end">
                {active ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium py-1 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                    <Check className="w-3.5 h-3.5" />
                    <span>در چرخه لایتنر فعال است</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playSuccess();
                      onAddWordToLeitner(word);
                    }}
                    className="flex items-center gap-1.5 py-1 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>افزودن به خانه اول</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filteredWords.length > 100 && (
        <div className="text-center py-4 text-xs text-slate-600 dark:text-slate-400">
          برای دسترسی سریع‌تر به سایر واژگان از فیلتر درس (Lektion) یا کادر جستجو استفاده فرمایید.
        </div>
      )}

    </div>
  );
};
