import React, { useState } from 'react';
import { LeitnerCard, ReflectionCategory, BOX_CONFIGS, MASTERED_BOX } from '../types/leitner';
import { soundService } from '../services/soundService';
import { Plus, Trash2, Edit3, Calendar, Quote, Compass } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { Auto } from './ui/Text';

interface ReflectionManagerProps {
  cards: LeitnerCard[];
  onAddCard: (card: Partial<LeitnerCard>) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (id: string, updates: Partial<LeitnerCard>) => void;
  onStartReview: () => void;
}

const CATEGORY_COLORS: Record<ReflectionCategory, string> = {
  decision: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  motivation: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  goal: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  habit: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  note: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
};

const CATEGORIES = Object.keys(CATEGORY_COLORS) as ReflectionCategory[];

const field = 'w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none';

export const ReflectionManager: React.FC<ReflectionManagerProps> = ({
  cards,
  onAddCard,
  onDeleteCard,
  onUpdateCard
}) => {
  const { t, date } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ReflectionCategory>('decision');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const reflectionCards = cards.filter(c => c.type === 'reflection');

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    soundService.playSuccess();
    onAddCard({
      type: 'reflection',
      title: title.trim(),
      content: content.trim(),
      category,
      box: 0
    });

    setTitle('');
    setContent('');
    setIsAdding(false);
  };

  const startEdit = (card: LeitnerCard) => {
    setEditingId(card.id);
    setEditTitle(card.title || '');
    setEditContent(card.content || '');
  };

  const saveEdit = (id: string) => {
    onUpdateCard(id, {
      title: editTitle.trim(),
      content: editContent.trim()
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Compass className="w-4 h-4 shrink-0" />
              <span>{t.reflections.badge}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t.reflections.title}</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">{t.reflections.subtitle}</p>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-colors"
          >
            <Plus className={`w-4 h-4 transition-transform ${isAdding ? 'rotate-45' : ''}`} />
            <span>{isAdding ? t.reflections.closeForm : t.reflections.newCard}</span>
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmitNew} className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">{t.reflections.formTitle}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="refl-title" className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.reflections.titleLabel}</label>
                <input
                  id="refl-title"
                  type="text"
                  dir="auto"
                  required
                  placeholder={t.reflections.titlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={field}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="refl-category" className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.reflections.categoryLabel}</label>
                <select
                  id="refl-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReflectionCategory)}
                  className={field}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{t.categories[c]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="refl-content" className="text-xs font-medium text-slate-700 dark:text-slate-300">{t.reflections.contentLabel}</label>
              <textarea
                id="refl-content"
                dir="auto"
                rows={3}
                placeholder={t.reflections.contentPlaceholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`${field} leading-relaxed`}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                {t.common.cancel}
              </button>
              <button type="submit" className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs">
                {t.reflections.add}
              </button>
            </div>
          </form>
        )}
      </div>

      {reflectionCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Quote className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">{t.reflections.emptyTitle}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{t.reflections.emptyBody}</p>
          <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold">
            {t.reflections.emptyCta}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reflectionCards.map((card) => {
            const isEditing = editingId === card.id;
            const cat = card.category || 'decision';
            const boxConfig = BOX_CONFIGS[card.box];
            const isMastered = card.box >= MASTERED_BOX || !boxConfig;

            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
              >
                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${CATEGORY_COLORS[cat]}`}>
                      {t.categories[cat]}
                    </span>

                    <div className="dot-list flex items-center gap-2 text-slate-600 dark:text-slate-400 text-[11px]">
                      <span>{isMastered ? t.reflections.mastered : t.boxes.name(card.box)}</span>
                      {!isMastered && (
                        <>
                          <span>{t.reflections.interval(boxConfig.intervalDays)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        dir="auto"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                      />
                      <textarea
                        dir="auto"
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs text-slate-500">{t.common.cancel}</button>
                        <button onClick={() => saveEdit(card.id)} className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold">
                          {t.common.save}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Auto as="h3" className="block font-bold text-base text-slate-900 dark:text-white mb-1.5 break-words text-start">{card.title}</Auto>
                      <Auto as="p" className="block text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-4 text-start">
                        {card.content}
                      </Auto>
                    </div>
                  )}
                </div>

                {confirmingDeleteId === card.id ? (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-red-600 dark:text-red-400 font-medium">{t.reflections.confirmDelete(card.title || '')}</span>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmingDeleteId(null)} className="px-2.5 py-1 text-slate-500">{t.common.cancel}</button>
                      <button
                        onClick={() => {
                          setConfirmingDeleteId(null);
                          onDeleteCard(card.id);
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md font-semibold"
                      >
                        {t.reflections.confirmYes}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {!isMastered && <span>{t.reflections.nextDue(date(`${card.nextReviewDate}T12:00:00`))}</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(card)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title={t.common.edit}
                        aria-label={t.common.edit}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(card.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/50 rounded text-slate-400 hover:text-red-500"
                        title={t.reflections.deleteTitle}
                        aria-label={t.reflections.deleteTitle}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
