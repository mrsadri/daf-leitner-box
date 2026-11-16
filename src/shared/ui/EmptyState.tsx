/** What a list shows when it has nothing yet: an icon, a short title, one sentence, and usually one action. */
import React from 'react';
import { cx } from './cx';

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode; className?: string }> = ({ icon, title, body, action, className }) => (
  <div className={cx('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card p-8 sm:p-12 text-center space-y-4', className)}>
    {icon && <div className="w-12 h-12 mx-auto rounded-card bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">{icon}</div>}
    <h3 className="font-bold text-base text-slate-900 dark:text-white">{title}</h3>
    {body && <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{body}</p>}
    {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);
