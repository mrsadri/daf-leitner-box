import React, { useState } from 'react';
import { LeitnerCard, ReflectionCategory, BOX_CONFIGS, MASTERED_BOX } from '../types/leitner';
import { soundService } from '../services/soundService';
import { Sparkles, Plus, Trash2, Edit3, Calendar, Layers, CheckCircle2, Quote, Compass } from 'lucide-react';

interface ReflectionManagerProps {
  cards: LeitnerCard[];
  onAddCard: (card: Partial<LeitnerCard>) => void;
  onDeleteCard: (id: string) => void;
  onUpdateCard: (id: string, updates: Partial<LeitnerCard>) => void;
  onStartReview: () => void;
}

const CATEGORY_LABELS: Record<ReflectionCategory, { label: string; color: string }> = {
  decision: { label: 'تصمیم برای شروع کار', color: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  motivation: { label: 'جمله انگیزشی', color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  goal: { label: 'هدف و دستاورد', color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  habit: { label: 'عادت پایدار', color: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  note: { label: 'یادداشت بازبینی', color: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' }
};

export const ReflectionManager: React.FC<ReflectionManagerProps> = ({
  cards,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onStartReview
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ReflectionCategory>('decision');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Compass className="w-4 h-4" />
              <span>سیستم مرور اهداف و تصمیم‌ها در لایتنر</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              تصمیمات، اهداف و جملات انگیزشی
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
              این کارت‌ها آزمون یا سوال تستی ندارند. در فواصل لایتنر (۱، ۲، ۴، ۸، ۱۶ و ۳۲ روز) جهت تجدید انگیزه و مرور تعهدات به شما نشان داده می‌شوند و با زدن «خواندم و مرور شد»، خودکار به خانه بعد می‌روند.
            </p>
          </div>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{isAdding ? 'بستن فرم' : '+ ثبت تصمیم یا انگیزه جدید'}</span>
          </button>
        </div>

        {/* Add Card Form */}
        {isAdding && (
          <form onSubmit={handleSubmitNew} className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              فرم ثبت کارت بینش، تصمیم یا جمله الهام‌بخش
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  عنوان کارت (روی کارت نمایش داده می‌شود) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شروع دوره ورزشی روزانه / نقل قول درباره پیوستگی..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  دسته‌بندی کارت
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReflectionCategory)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="decision">تصمیم برای شروع کار</option>
                  <option value="motivation">جمله انگیزشی</option>
                  <option value="goal">هدف و برنامه</option>
                  <option value="habit">عادت روزانه</option>
                  <option value="note">یادداشت بازبینی</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                متن کامل کارت (پشت کارت نمایش داده می‌شود)
              </label>
              <textarea
                rows={3}
                placeholder="شرح کامل تصمیم، چرایی آن، مراحل اقدام یا متن کامل انگیزه..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none leading-relaxed"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
              >
                افزودن به خانه اول لایتنر
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Cards List grouped by Box */}
      {reflectionCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Quote className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-slate-900 dark:text-white">
            هنوز هیچ تصمیم یا جمله انگیزشی ثبت نشده است
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            شما می‌توانید تصمیم‌های مهم زندگی، برنامه‌های شروع پروژه‌ها یا جملاتی که به شما انرژی می‌دهند را ثبت کنید تا در بازه‌های لایتنر به یادتان آورده شوند.
          </p>
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
          >
            + ثبت اولین تصمیم یا انگیزه
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reflectionCards.map((card) => {
            const isEditing = editingId === card.id;
            const catInfo = CATEGORY_LABELS[card.category || 'decision'];
            const boxConfig = BOX_CONFIGS[card.box];

            return (
              <div
                key={card.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all space-y-4"
              >
                <div className="space-y-3">
                  {/* Card Meta */}
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${catInfo.color}`}>
                      {catInfo.label}
                    </span>

                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-[11px] font-mono-num">
                      <span>{card.box >= MASTERED_BOX || !boxConfig ? 'تثبیت‌شده' : boxConfig.name}</span>
                      {card.box < MASTERED_BOX && boxConfig && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>فاصله {boxConfig.intervalDays} روز</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Title & Content */}
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                      />
                      <textarea
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs text-slate-500"
                        >
                          انصراف
                        </button>
                        <button
                          onClick={() => saveEdit(card.id)}
                          className="px-3 py-1 bg-indigo-600 text-white rounded-md text-xs font-semibold"
                        >
                          ذخیره
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1.5">
                        {card.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap line-clamp-4">
                        {card.content}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer and Management */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-mono-num text-[11px]">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>سررسید بعدی: {card.nextReviewDate}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(card)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      title="ویرایش"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`آیا از حذف کارت «${card.title}» مطمئن هستید؟`)) {
                          onDeleteCard(card.id);
                        }
                      }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/50 rounded text-slate-400 hover:text-red-500"
                      title="حذف کارت"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
