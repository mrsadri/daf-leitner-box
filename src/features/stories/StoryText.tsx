/**
 * One page of a story: German paragraphs in which every word can be tapped. Lesson words are bold; nouns carry a
 * gender underline (masculine blue, feminine red, neuter green, plural ink; colours in index.css). Always LTR.
 */
import React, { useId, useState } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import type { Page, WordSegment } from './types';
import { splitWords } from './wordTap';

const GENDER_CLASS = { m: 'gender-m', f: 'gender-f', n: 'gender-n', pl: 'gender-pl' } as const;

const wordClass = 'rounded-sm px-[1px] -mx-[1px] cursor-pointer hover:bg-amber-200/60 dark:hover:bg-amber-500/25 focus-visible:outline-2 focus-visible:outline-amber-500';

export const StoryText: React.FC<{ page: Page; onWord: (w: WordSegment | string) => void; className?: string }> = ({ page, onWord, className = '' }) => {
  const { t, lang } = useI18n();
  const hint = useId();
  const [activeWord, setActiveWord] = useState(0);
  const paragraphs = page.map(paragraph => paragraph.flatMap(segment => typeof segment === 'string'
    ? splitWords(segment).map(part => ({ text: part.text, word: part.word, segment: undefined as WordSegment | undefined }))
    : [{ text: segment.t, word: true, segment }]));
  const wordCount = paragraphs.flat().filter(part => part.word).length;
  const selectedWord = Math.min(activeWord, wordCount - 1);
  return (
  <div data-word-navigation role="toolbar" aria-label={t.stories.wordNavigation} aria-keyshortcuts="ArrowLeft ArrowRight Home End" tabIndex={-1} aria-describedby={hint}
    onFocus={e => {
      const words = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=button]')];
      const index = words.indexOf(e.target as HTMLElement);
      if (index >= 0) setActiveWord(index);
    }}
    onKeyDown={e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      const words = [...e.currentTarget.querySelectorAll<HTMLElement>('[role=button]')];
      if (!words.length) return;
      const index = words.indexOf(document.activeElement as HTMLElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? words.length - 1
        : Math.max(0, Math.min(words.length - 1, index + (e.key === 'ArrowRight' ? 1 : -1)));
      e.preventDefault(); e.stopPropagation(); words[next].focus();
    }} dir="ltr" lang="de" className={`font-story text-ink text-xl sm:text-[1.375rem] leading-[1.9] space-y-4 text-start ${className}`}>
    <span id={hint} lang={lang} dir={lang === 'fa' ? 'rtl' : 'ltr'} className="sr-only">{t.stories.keyboardWords}</span>
    {paragraphs.map((paragraph, i) => (
      <p key={i}>
        {paragraph.map((part, j) => {
          if (!part.word) return <React.Fragment key={j}>{part.text}</React.Fragment>;
          const index = paragraphs.slice(0, i).flat().filter(word => word.word).length
            + paragraph.slice(0, j).filter(word => word.word).length;
          const seg = part.segment;
          const cls = [wordClass, seg?.b ? 'font-bold' : '', seg?.g ? GENDER_CLASS[seg.g] : ''].join(' ');
          return (
            <span key={j} role="button" tabIndex={index === selectedWord ? 0 : -1} className={cls} data-gender={seg?.g}
              onClick={() => onWord(seg ?? part.text)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWord(seg ?? part.text); } }}>{part.text}</span>
          );
        })}
      </p>
    ))}
  </div>
);
};
