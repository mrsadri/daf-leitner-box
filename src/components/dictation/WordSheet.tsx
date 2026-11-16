import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { LeitnerCard } from '../../types/leitner';
import { MASTERED_BOX } from '../../types/leitner';
import { leitnerEngine } from '../../services/leitnerEngine';
import type { WordTarget } from '../../services/dictation/wordLink';
import { useI18n } from '../../i18n/I18nProvider';

interface Props {
  target: Exclude<WordTarget, { kind: 'none' }>;
  /** The word as it appears in the story sentence (the correct form), shown on purpose after the learner tapped. */
  expectedWord: string;
  sentenceText: string;
  lessons: [number, number];
  onClose: () => void;
  onCardsChanged: () => void;
}

interface Toast { text: string; undo: () => void }

/**
 * The only place where a story can touch the Leitner box, and only by a button the learner presses
 * (docs/dictation/07-leitner-integration.md). Typing, Next and Skip never reach this code.
 */
export const WordSheet: React.FC<Props> = ({ target, expectedWord, sentenceText, lessons, onClose, onCardsChanged }) => {
  const { t, lang } = useI18n();
  const [, force] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const cardId = target.kind === 'card' ? target.cardId : null;
  // always read the live state from the engine, never a copy from when the sheet opened
  const owned: LeitnerCard | undefined = cardId ? leitnerEngine.getCards().find(c => c.id === cardId) : undefined;
  const catalogWord = cardId ? leitnerEngine.getCatalogWord(cardId) : undefined;
  const meaning = catalogWord ? (lang === 'en' ? catalogWord.englisch : catalogWord.persisch) : '';

  const show = (text: string, undo: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  };
  const changed = () => { onCardsChanged(); force(x => x + 1); };

  const add = () => {
    if (target.kind !== 'card' || !catalogWord) return;
    const added = leitnerEngine.addBatchWords([catalogWord]);
    if (added > 0) {
      show(t.dictation.word.added, () => {
        const card = leitnerEngine.getCards().find(c => c.id === target.cardId);
        if (card && card.reviewCount === 0) leitnerEngine.deleteCard(card.id);   // only a card this action just created
        setToast(null); changed();
      });
    }
    changed();
  };

  const addNew = () => {
    if (target.kind !== 'new') return;
    const card = leitnerEngine.addCard({
      type: 'vocab', wort: target.word, beispiel: sentenceText, lektion: String(lessons[0]).padStart(2, '0'),
      feld: 'Geschichte', artikel: '–', niveau: 'A1', wortart: '', plural: '', formen: '', persisch: '', englisch: ''
    });
    show(t.dictation.word.added, () => {
      if (card.reviewCount === 0) leitnerEngine.deleteCard(card.id);
      setToast(null); changed();
    });
    changed();
  };

  const moveBack = () => {
    if (!owned || Date.now() < lockedUntil) return;
    setLockedUntil(Date.now() + 1000);                      // a 1 s guard against an accidental double tap
    const res = leitnerEngine.moveBackOne(owned.id);
    if (!res) return;
    show(res.moved ? t.dictation.word.moveBackDone(res.card.box) : t.dictation.word.atFirst, () => {
      leitnerEngine.updateCard(owned.id, res.before);       // restore box, due date and last review
      setToast(null); changed();
    });
    changed();
  };

  const state = owned
    ? owned.box >= MASTERED_BOX ? t.dictation.word.mastered : t.dictation.word.inBox(owned.box)
    : t.dictation.word.notInBox;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="word-sheet-title" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl p-5 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 id="word-sheet-title" className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t.dictation.word.title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label={t.dictation.word.close} className="p-1.5 -m-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t.dictation.word.correct}</p>
        <p dir="ltr" lang="de" className="text-start text-2xl font-bold text-slate-900 dark:text-white">{expectedWord}</p>
        {target.kind === 'card' && target.link.lemma.toLowerCase() !== expectedWord.toLowerCase() && (
          <p dir="ltr" lang="de" className="text-start text-sm text-slate-600 dark:text-slate-300 mt-1">{t.dictation.word.formOf(expectedWord, target.link.lemma)}</p>
        )}
        {meaning && <p className="text-sm text-slate-700 dark:text-slate-200 mt-2">{meaning}</p>}
        {target.kind === 'card' && <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mt-3">{state}{owned && owned.box === 0 ? ` · ${t.dictation.word.reviewToday}` : ''}</p>}
        {target.kind === 'new' && <p className="text-sm text-slate-600 dark:text-slate-300 mt-3">{t.dictation.word.noCard}</p>}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {target.kind === 'card' && !owned && (
            <button type="button" onClick={add} className="flex-1 min-h-11 px-4 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500">{t.dictation.word.add}</button>
          )}
          {target.kind === 'card' && owned && (
            <button type="button" onClick={moveBack} disabled={Date.now() < lockedUntil} className="flex-1 min-h-11 px-4 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-amber-400">
              {owned.box === 0 ? t.dictation.word.reviewToday : t.dictation.word.moveBack}
            </button>
          )}
          {target.kind === 'new' && (
            <button type="button" onClick={addNew} className="flex-1 min-h-11 px-4 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500">{t.dictation.word.addNew}</button>
          )}
        </div>
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">{t.dictation.word.note}</p>

        {toast && (
          <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-2 text-sm">
            <span>{toast.text}</span>
            <button type="button" onClick={toast.undo} className="font-bold underline">{t.dictation.word.undo}</button>
          </div>
        )}
      </div>
    </div>
  );
};
