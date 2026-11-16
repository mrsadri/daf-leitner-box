/**
 * One page of a story: German paragraphs in which every word can be tapped. Lesson words are bold; nouns carry a
 * gender underline (masculine blue, feminine red, neuter green, plural ink; colours in index.css). Always LTR.
 */
import React from 'react';
import type { Page, WordSegment } from './types';
import { splitWords } from './wordTap';

const GENDER_CLASS = { m: 'gender-m', f: 'gender-f', n: 'gender-n', pl: 'gender-pl' } as const;

const wordClass = 'rounded-sm px-[1px] -mx-[1px] cursor-pointer hover:bg-amber-200/60 dark:hover:bg-amber-500/25 focus-visible:outline-2 focus-visible:outline-amber-500';

export const StoryText: React.FC<{ page: Page; onWord: (w: WordSegment | string) => void; className?: string }> = ({ page, onWord, className = '' }) => (
  <div dir="ltr" lang="de" className={`font-story text-ink text-xl sm:text-[1.375rem] leading-[1.9] space-y-4 text-start ${className}`}>
    {page.map((para, i) => (
      <p key={i}>
        {para.map((seg, j) => {
          if (typeof seg === 'string') {
            return splitWords(seg).map((part, k) => part.word
              ? <span key={`${j}-${k}`} role="button" tabIndex={0} className={wordClass}
                  onClick={() => onWord(part.text)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWord(part.text); } }}>{part.text}</span>
              : <React.Fragment key={`${j}-${k}`}>{part.text}</React.Fragment>);
          }
          const cls = [wordClass, seg.b ? 'font-bold' : '', seg.g ? GENDER_CLASS[seg.g] : ''].join(' ');
          return (
            <span key={j} role="button" tabIndex={0} className={cls} data-gender={seg.g}
              onClick={() => onWord(seg)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWord(seg); } }}>{seg.t}</span>
          );
        })}
      </p>
    ))}
  </div>
);
