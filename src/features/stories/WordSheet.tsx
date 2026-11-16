/**
 * The sheet a tapped story word opens. The only place where Stories touch the Leitner box, and only by a button:
 *   - a word from the list: meaning, article, pronunciation; "add to my box", or if owned "back to the previous box"
 *     (core/moveBack.ts: box − 1, due at that box's first review, never in the past, not a review)
 *   - a word not in the list: "add as a new card" (opens the new-card dialog with the word filled in)
 * Every change can be undone right away.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import type { LeitnerCard } from '../../core/types';
import { MASTERED_BOX } from '../../core/types';
import { leitnerEngine, getQuizArticle } from '../../core/leitnerEngine';
import { speechService } from '../../shared/lib/speechService';
import { useI18n } from '../../i18n/I18nProvider';
import { Dialog, Button, Badge } from '../../shared/ui';

import type { WordTarget } from './wordTap';

interface Props {
  target: Exclude<WordTarget, { kind: 'none' }>;
  onClose: () => void;
  onCardsChanged: () => void;
  /** "Add as a new card" for a word that is not in the list */
  onAddNew: (word: string) => void;
}

interface Toast { text: string; undo: () => void }

const ARTICLE_TONE = { der: 'text-gender-m', die: 'text-gender-f', das: 'text-gender-n' } as const;

export const WordSheet: React.FC<Props> = ({ target, onClose, onCardsChanged, onAddNew }) => {
  const { t, lang } = useI18n();
  const w = t.stories.word;
  const [, force] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const busyUntil = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const cardId = target.kind === 'card' ? target.cardId : null;
  // Always the live state from the engine, never a copy from when the sheet opened
  const owned: LeitnerCard | undefined = cardId ? leitnerEngine.getCards().find(c => c.id === cardId) : undefined;
  const catalogWord = cardId ? leitnerEngine.getCatalogWord(cardId) : undefined;
  const meaning = catalogWord ? (lang === 'en' ? catalogWord.englisch || catalogWord.persisch : catalogWord.persisch) : '';
  const lemma = catalogWord?.wort ?? target.word;
  const article = catalogWord ? getQuizArticle(catalogWord) : null;

  const show = (text: string, undo: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  };
  const changed = () => { onCardsChanged(); force(x => x + 1); };
  const guard = () => {
    if (Date.now() < busyUntil.current) return false;   // a short guard against an accidental double tap
    busyUntil.current = Date.now() + 800;
    return true;
  };

  const add = () => {
    if (!catalogWord || !guard()) return;
    if (leitnerEngine.addBatchWords([catalogWord]) > 0) {
      show(w.added, () => {
        const card = leitnerEngine.getCards().find(c => c.id === catalogWord.id);
        if (card && card.reviewCount === 0) leitnerEngine.deleteCard(card.id);   // only the card this action created
        setToast(null); changed();
      });
    }
    changed();
  };

  const moveBack = () => {
    if (!owned || !guard()) return;
    const res = leitnerEngine.moveBackOne(owned.id);
    if (!res) return;
    show(res.moved ? w.moveBackDone(res.card.box) : w.atFirst, () => {
      leitnerEngine.updateCard(owned.id, res.before);       // restore box, due date and last review
      setToast(null); changed();
    });
    changed();
  };

  const state = owned ? (owned.box >= MASTERED_BOX ? w.mastered : w.inBox(owned.box)) : w.notInBox;

  return (
    <Dialog
      onClose={onClose}
      size="sm"
      testId="word-sheet"
      title={w.title}
      footer={target.kind === 'card' ? (
        owned
          ? <Button block variant="secondary" onClick={moveBack}>{owned.box === 0 ? w.reviewToday : w.moveBack}</Button>
          : <Button block onClick={add} disabled={!catalogWord}>{w.add}</Button>
      ) : (
        <Button block onClick={() => onAddNew(target.word)}>{w.addNew}</Button>
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p dir="ltr" lang="de" className="text-start text-2xl font-bold text-slate-900 dark:text-white font-de">
          {article && <span className={`me-2 ${ARTICLE_TONE[article]}`}>{article}</span>}
          {target.kind === 'card' ? lemma.replace(/^(der|die|das)\s+/i, '') : target.word}
        </p>
        <Button variant="ghost" size="sm" icon={<Volume2 className="w-4 h-4" />} onClick={() => void speechService.speak(target.kind === 'card' ? lemma : target.word)}>
          {w.pronounce}
        </Button>
      </div>
      {target.kind === 'card' && lemma.replace(/^(der|die|das)\s+/i, '').toLowerCase() !== target.word.toLowerCase() && (
        <p dir="auto" className="text-sm text-slate-600 dark:text-slate-300">{w.formOf(target.word, lemma)}</p>
      )}
      {meaning && <p dir="auto" className="text-base text-slate-800 dark:text-slate-100">{meaning}</p>}
      {target.kind === 'card'
        ? <Badge tone={owned ? 'primary' : 'neutral'}>{state}</Badge>
        : <p className="text-sm text-slate-600 dark:text-slate-300">{w.notInList}</p>}
      <p className="text-caption text-slate-500 dark:text-slate-400">{w.note}</p>
      {toast && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-control bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 px-3 py-2 text-sm">
          <span>{toast.text}</span>
          <button type="button" onClick={toast.undo} className="font-bold underline min-h-9">{w.undo}</button>
        </div>
      )}
    </Dialog>
  );
};
