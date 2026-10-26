import React, { useState } from 'react';
import { LeitnerCard, CardType, ReflectionCategory } from '../types/leitner';
import { soundService } from '../services/soundService';
import { X, BookOpen, Sparkles, Plus } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

interface NewCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCard: (card: Partial<LeitnerCard>) => void;
}

const CATEGORIES: ReflectionCategory[] = ['decision', 'motivation', 'goal', 'habit', 'note'];
const WORTARTEN = ['Nomen', 'Verb', 'Adjektiv', 'Adverb', 'Präposition', 'Ausdruck'] as const;

const input = 'w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none';
const label = 'text-xs font-medium text-slate-700 dark:text-slate-300';

export const NewCardModal: React.FC<NewCardModalProps> = ({
  isOpen,
  onClose,
  onAddCard
}) => {
  const { t, lang } = useI18n();
  const [cardType, setCardType] = useState<CardType>('vocab');

  // Vocab fields. The required meaning is in the interface language, the other one is optional.
  const [wort, setWort] = useState('');
  const [meaningPrimary, setMeaningPrimary] = useState('');
  const [meaningSecondary, setMeaningSecondary] = useState('');
  const [artikel, setArtikel] = useState('–');
  const [plural, setPlural] = useState('');
  const [formen, setFormen] = useState('');
  const [beispiel, setBeispiel] = useState('');
  const [wortart, setWortart] = useState('Nomen');
  const [perfekt, setPerfekt] = useState('');

  // Reflection fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ReflectionCategory>('decision');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cardType === 'vocab') {
      if (!wort.trim() || !meaningPrimary.trim()) return;
      const persisch = (lang === 'fa' ? meaningPrimary : meaningSecondary).trim();
      const englisch = (lang === 'fa' ? meaningSecondary : meaningPrimary).trim();
      soundService.playSuccess();
      onAddCard({
        type: 'vocab',
        wort: wort.trim(),
        persisch,
        ...(englisch ? { englisch } : {}),
        ...(wortart === 'Verb' && perfekt.trim() ? { perfekt: perfekt.trim() } : {}),
        artikel,
        plural: plural.trim(),
        formen: formen.trim(),
        beispiel: beispiel.trim(),
        wortart,
        // Kept in Persian so older app versions still display custom cards correctly
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

  const tabClass = (active: boolean) =>
    `flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
      active
        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-card-title"
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <h3 id="new-card-title" className="font-bold text-base text-slate-900 dark:text-white">{t.newCard.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t.common.close}
            className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type tabs */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
            <button type="button" onClick={() => setCardType('vocab')} className={tabClass(cardType === 'vocab')}>
              <BookOpen className="w-4 h-4" />
              <span>{t.newCard.typeVocab}</span>
            </button>
            <button type="button" onClick={() => setCardType('reflection')} className={tabClass(cardType === 'reflection')}>
              <Sparkles className="w-4 h-4" />
              <span>{t.newCard.typeReflection}</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {cardType === 'vocab' ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="nc-artikel" className={label}>{t.newCard.article}</label>
                  <select id="nc-artikel" value={artikel} onChange={(e) => setArtikel(e.target.value)} className={`${input} px-2 font-semibold`}>
                    <option value="–">{t.newCard.noArticle}</option>
                    {(['der', 'die', 'das'] as const).map(a => (
                      <option key={a} value={a}>{a} ({t.articles[a]})</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 space-y-1">
                  <label htmlFor="nc-wort" className={label}>{t.newCard.word}</label>
                  <input
                    id="nc-wort"
                    type="text"
                    required
                    dir="ltr"
                    lang="de"
                    placeholder="z.B. der Termin, lernen…"
                    value={wort}
                    onChange={(e) => setWort(e.target.value)}
                    className={`${input} font-de`}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="nc-meaning" className={label}>{t.newCard.meaningPrimary}</label>
                <input
                  id="nc-meaning"
                  type="text"
                  required
                  dir="auto"
                  placeholder={t.newCard.meaningPrimaryPlaceholder}
                  value={meaningPrimary}
                  onChange={(e) => setMeaningPrimary(e.target.value)}
                  className={input}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="nc-meaning2" className={label}>{t.newCard.meaningSecondary}</label>
                <input
                  id="nc-meaning2"
                  type="text"
                  dir={lang === 'fa' ? 'ltr' : 'rtl'}
                  lang={lang === 'fa' ? 'en' : 'fa'}
                  placeholder={t.newCard.meaningSecondaryPlaceholder}
                  value={meaningSecondary}
                  onChange={(e) => setMeaningSecondary(e.target.value)}
                  className={input}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="nc-plural" className={label}>{t.newCard.plural}</label>
                  <input
                    id="nc-plural"
                    type="text"
                    dir="ltr"
                    lang="de"
                    placeholder="die Termine"
                    value={plural}
                    onChange={(e) => setPlural(e.target.value)}
                    className={`${input} font-de`}
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="nc-wortart" className={label}>{t.newCard.wortart}</label>
                  <select id="nc-wortart" value={wortart} onChange={(e) => setWortart(e.target.value)} className={input}>
                    {WORTARTEN.map(w => (
                      <option key={w} value={w}>{w} ({t.newCard.wortarten[w]})</option>
                    ))}
                  </select>
                </div>
              </div>

              {wortart === 'Verb' && (
                <div className="space-y-1">
                  <label htmlFor="nc-perfekt" className={label}>{t.newCard.perfekt}</label>
                  <input
                    id="nc-perfekt"
                    type="text"
                    dir="ltr"
                    lang="de"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="hat gelernt"
                    value={perfekt}
                    onChange={(e) => setPerfekt(e.target.value)}
                    className={`${input} font-de`}
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.newCard.perfektHint}</p>
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="nc-formen" className={label}>{t.newCard.formen}</label>
                <input
                  id="nc-formen"
                  type="text"
                  dir="ltr"
                  lang="de"
                  placeholder="lernt · lernte · hat gelernt"
                  value={formen}
                  onChange={(e) => setFormen(e.target.value)}
                  className={`${input} font-de`}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="nc-beispiel" className={label}>{t.newCard.example}</label>
                <textarea
                  id="nc-beispiel"
                  rows={2}
                  dir="auto"
                  placeholder={t.newCard.examplePlaceholder}
                  value={beispiel}
                  onChange={(e) => setBeispiel(e.target.value)}
                  className={`${input} leading-relaxed`}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label htmlFor="nc-title" className={label}>{t.newCard.reflTitle}</label>
                <input
                  id="nc-title"
                  type="text"
                  required
                  dir="auto"
                  placeholder={t.newCard.reflTitlePlaceholder}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`${input} font-semibold`}
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="nc-category" className={label}>{t.newCard.reflCategory}</label>
                <select id="nc-category" value={category} onChange={(e) => setCategory(e.target.value as ReflectionCategory)} className={input}>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{t.categories[c]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="nc-content" className={label}>{t.newCard.reflContent}</label>
                <textarea
                  id="nc-content"
                  rows={4}
                  dir="auto"
                  placeholder={t.newCard.reflContentPlaceholder}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={`${input} leading-relaxed`}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            >
              {t.common.cancel}
            </button>
            <button type="submit" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs">
              {t.newCard.submit}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
