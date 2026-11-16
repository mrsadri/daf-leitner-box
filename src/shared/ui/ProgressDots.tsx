/** "Page 2 of 6" as dots. The current dot is wider; the whole row has one accessible label. */
import React from 'react';
import { cx } from './cx';

export const ProgressDots: React.FC<{ total: number; current: number; label: string; className?: string }> = ({ total, current, label, className }) => (
  <div role="img" aria-label={label} className={cx('flex items-center justify-center gap-1.5', className)}>
    {Array.from({ length: total }, (_, i) => (
      <span key={i} className={cx('h-2 rounded-full transition-all', i === current ? 'w-6 bg-indigo-600 dark:bg-indigo-400' : 'w-2',
        i < current ? 'bg-indigo-300 dark:bg-indigo-700' : i > current && 'bg-slate-300 dark:bg-slate-600')} />
    ))}
  </div>
);
