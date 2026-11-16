/** Small status label. Tones follow the colour roles of the design system. */
import React from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  primary: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800',
  danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
};

export const Badge: React.FC<{ tone?: BadgeTone; icon?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ tone = 'neutral', icon, className, children }) => (
  <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-caption font-semibold', TONES[tone], className)}>
    {icon}{children}
  </span>
);
