/**
 * One page of a story: German paragraphs in which every word can be tapped. Lesson words are bold; nouns carry a
 * gender underline (masculine blue, feminine red, neuter green, plural ink; colours in index.css). Always LTR.
 */
import React, { useId } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Page, WordSegment } from './types';
import { splitWords } from './wordTap';

const GENDER_CLASS = { m: 'gender-m', f: 'gender-f', n: 'gender-n', pl: 'gender-pl' } as const;

const wordClass = 'rounded-sm px-[1px] -mx-[1px] cursor-pointer hover:bg-amber-200/60 dark:hover:bg-amber-500/25 focus-visible:outline-2 focus-visible:outline-amber-500';

export const StoryText: React.FC<{ page: Page; onWord: (w: WordSegment | string) => void; className?: string }> = ({ page, onWord, className = '' }) => {
  const { t } = useI18n();
  const hint = useId();
  return (
  <div data-word-navigation role="toolbar" tabIndex={0} aria-describedby={hint}
    onKeyDown={e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const words = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=button]')];
      if (!words.length) return;
      const index = words.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? words.length - 1
        : Math.max(0, Math.min(words.length - 1, index + (e.key === 'ArrowRight' ? 1 : -1)));
      e.preventDefault(); e.stopPropagation(); words[next].focus();
    }} dir="ltr" lang="de" className={`font-story text-ink text-xl sm:text-[1.375rem] leading-[1.9] space-y-4 text-start ${className}`}>
    <span id={hint} className="sr-only">{t.stories.keyboardWords}</span>
    {page.map((para, i) => (
      <p key={i}>
        {para.map((seg, j) => {
          if (typeof seg === 'string') {
            return splitWords(seg).map((part, k) => part.word
              ? <span key={`${j}-${k}`} role="button" tabIndex={-1} className={wordClass}
                  onClick={() => onWord(part.text)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWord(part.text); } }}>{part.text}</span>
              : <React.Fragment key={`${j}-${k}`}>{part.text}</React.Fragment>);
          }
          const cls = [wordClass, seg.b ? 'font-bold' : '', seg.g ? GENDER_CLASS[seg.g] : ''].join(' ');
          return (
            <span key={j} role="button" tabIndex={-1} className={cls} data-gender={seg.g}
              onClick={() => onWord(seg)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWord(seg); } }}>{seg.t}</span>
          );
        })}
      </p>
    ))}
  </div>
);
};
