/**
 * Pieces of a word card shared by the review, new-word learning and the word bank, so they look and behave the same:
 *   ARTICLE_COLOR   der blue, die red, das green (the same colours as the gender underlines in Stories)
 *   VocabDetails    Perfekt (optional), plural, forms and the Austria note, in a two-column grid
 *   ExampleBox      the example sentence with its translation and a play button
 * `hide` masks the participle in texts while the Perfekt quiz is still open (see perfekt.ts maskParticiples).
 */
import React from 'react';
import { Volume2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { De, Auto } from '../ui/Text';
import { PluralInfo } from './PluralInfo';
import type { PluralPart } from './plural';
import type { VocabText } from './vocabText';

export const ARTICLE_COLOR: Record<'der' | 'die' | 'das', string> = {
  der: 'text-blue-600 dark:text-blue-400',
  die: 'text-red-600 dark:text-red-400',
  das: 'text-emerald-600 dark:text-emerald-400',
};

const box = 'p-3 rounded-control sm:col-span-2';
const neutralBox = `${box} bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800`;
const label = 'text-slate-600 dark:text-slate-400 block mb-1';

export const VocabDetails: React.FC<{
  text: VocabText;
  plural: PluralPart[];
  hide: (s: string) => string;
  /** Accepted Perfekt forms, shown when the card is a verb and the quiz isn't asking for them */
  perfekt?: string[];
}> = ({ text, plural, hide, perfekt }) => {
  const { t } = useI18n();
  if (!perfekt?.length && plural.length === 0 && !text.formen && !text.oesterreich) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      {perfekt && perfekt.length > 0 && (
        <div className={`${box} bg-violet-50/70 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40`}>
          <De className="text-violet-700 dark:text-violet-300 font-semibold block mb-1">Perfekt</De>
          <De as="div" className="text-sm font-bold text-slate-900 dark:text-white leading-relaxed">{perfekt.join(' / ')}</De>
        </div>
      )}
      {plural.length > 0 && (
        <div className={neutralBox}>
          <span className={label}>{t.review.plural}</span>
          <PluralInfo parts={plural} />
        </div>
      )}
      {text.formen && (
        <div className={neutralBox}>
          <span className={label}>{t.review.formen}</span>
          <Auto as="div" className="font-medium text-slate-800 dark:text-slate-200 leading-relaxed text-start">{hide(text.formen)}</Auto>
        </div>
      )}
      {text.oesterreich && (
        <div className={`${box} bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40`}>
          <span className="font-semibold text-amber-800 dark:text-amber-300 block mb-1">🇦🇹 {t.review.austria}</span>
          <Auto as="div" className="text-amber-900 dark:text-amber-200 leading-relaxed text-start">{hide(text.oesterreich)}</Auto>
        </div>
      )}
    </div>
  );
};

export const ExampleBox: React.FC<{
  text: VocabText;
  hide: (s: string) => string;
  onSpeak: (s: string) => void;
  speaking?: boolean;
}> = ({ text, hide, onSpeak, speaking }) => {
  const { t } = useI18n();
  if (!text.exampleDe) return null;
  return (
    // A tap inside the box must not flip the card it sits on
    <div className="p-4 rounded-card bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 space-y-2"
      onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{t.review.exampleTitle}</span>
        <button
          type="button"
          onClick={() => onSpeak(text.exampleDe)}
          disabled={speaking}
          title={t.review.playExample}
          aria-label={t.review.playExample}
          className="p-1.5 rounded-control hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 transition-colors"
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>
      <De as="p" className="text-sm text-slate-900 dark:text-white leading-relaxed">{hide(text.exampleDe)}</De>
      {text.exampleTranslation && (
        <Auto as="p" className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed text-start">{text.exampleTranslation}</Auto>
      )}
    </div>
  );
};
