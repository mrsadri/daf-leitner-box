import React, { useState } from 'react';
import { LeitnerCard, CardType, ReflectionCategory } from '../types/leitner';
import { soundService } from '../services/soundService';
import { X, BookOpen, Sparkles } from 'lucide-react';

interface NewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Partial<LeitnerCard>) => void;
}

export const NewCardModal: React.FC<NewCardModalProps> = ({
  isOpen,
  onClose,
  onAddCard
}) => {
  const [cardType, setCardType] = useState<CardType>('vocab');

  // Vocab fields
  const [wort, setWort] = useState('');
  const [persisch, setPersisch] = useState('');
  const [artikel, setArtikel] = useState('–');
  const [plural, setPlural] = useState('');
  const [formen, setFormen] = useState('');
  const [beispiel, setBeispiel] = useState('');
  const [wortart, setWortart] = useState('Nomen');

  // Reflection fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ReflectionCategory>('decision');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cardType === 'vocab') {
      if (!wort.trim() || !persisch.trim()) return;
      soundService.playSuccess();
      onAddCard({
        type: 'vocab',
        wort: wort.trim(),
        persisch: persisch.trim(),
        artikel,
        plural: plural.trim(),
        formen: formen.trim(),
        beispiel: beispiel.trim(),
        wortart,
        lektion: 'سفارشی',
        niveau: 'سفارشی'
      });
    } else {
      if (!title.trim()) return;
      soundService.playSuccess();
      onAddCard({
        type: 'reflection',
        title: title.trim(),
        content: content.trim(),
        category
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              +
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              ثبت کارت جدید در خانه اول لایتنر
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Selector Tabs */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setCardType('vocab')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                cardType === 'vocab'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>واژه زبان آلمانی</span>
            </button>

            <button
              type="button"
              onClick={() => setCardType('reflection')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                cardType === 'reflection'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>تصمیم یا انگیزه</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {cardType === 'vocab' ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    آرتیکل
                  </label>
                  <select
                    value={artikel}
                    onChange={(e) => setArtikel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-de font-semibold"
                  >
                    <option value="–">– (بدون آرتیکل)</option>
                    <option value="der">der (مذکر)</option>
                    <option value="die">die (مؤنث)</option>
                    <option value="das">das (خنثی)</option>
                  </select>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    واژه آلمانی (Wort) *
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    placeholder="z.B. der Termin, lernen..."
                    value={wort}
                    onChange={(e) => setWort(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-de text-left"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  ترجمه دقیق فارسی *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قرار ملاقات، یاد گرفتن..."
                  value={persisch}
                  onChange={(e) => setPersisch(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    حالت جمع (Plural)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="die Termine"
                    value={plural}
                    onChange={(e) => setPlural(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-de text-left"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    نوع واژه (Wortart)
                  </label>
                  <select
                    value={wortart}
                    onChange={(e) => setWortart(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-de"
                  >
                    <option value="Nomen">Nomen (اسم)</option>
                    <option value="Verb">Verb (فعل)</option>
                    <option value="Adjektiv">Adjektiv (صفت)</option>
                    <option value="Adverb">Adverb (قید)</option>
                    <option value="Präposition">Präposition (حرف اضافه)</option>
                    <option value="Ausdruck">Ausdruck (اصطلاح)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  اشکال گرامری یا صرفی (Formen)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="lernt · lernte · hat gelernt"
                  value={formen}
                  onChange={(e) => setFormen(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-de text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  جمله مثال (Beispiel)
                </label>
                <textarea
                  rows={2}
                  dir="ltr"
                  placeholder="Ich habe um 10 Uhr einen Termin. · ساعت ۱۰ قرار دارم."
                  value={beispiel}
                  onChange={(e) => setBeispiel(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-de text-left leading-relaxed"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  عنوان کارت (روی کارت) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شروع رژیم سالم، شروع پروژه جدید، جمله انگیزشی روز..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  دسته‌بندی
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ReflectionCategory)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="decision">تصمیم برای شروع کار</option>
                  <option value="motivation">جمله انگیزشی</option>
                  <option value="goal">هدف و برنامه</option>
                  <option value="habit">عادت روزانه</option>
                  <option value="note">یادداشت بازبینی</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  متن کامل کارت (پشت کارت)
                </label>
                <textarea
                  rows={4}
                  placeholder="شرح گام‌ها، دلایل شروع، متن کامل انگیزه یا تعهد شخصی..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl leading-relaxed"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs"
            >
              افزودن به خانه اول لایتنر
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
