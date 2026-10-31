import React from 'react';
import { MOBILE_ACTION_BAR, useMobileActionBar } from './mobileActionBar';

export type RoundTone = 'no' | 'yes' | 'back' | 'undo' | 'next';

export interface RoundAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone: RoundTone;
  size?: 'lg' | 'sm';
  disabled?: boolean;
  /** Looks unavailable but can still be tapped, e.g. to explain why it is locked */
  muted?: boolean;
  /** Longer explanation (tooltip / screen readers) */
  hint?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
}

const TONE: Record<RoundTone, string> = {
  no: 'bg-white dark:bg-slate-900 border-2 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40',
  yes: 'bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-500 text-white shadow-md shadow-emerald-500/30',
  next: 'bg-emerald-500 hover:bg-emerald-600 border-2 border-emerald-500 text-white shadow-md shadow-emerald-500/30',
  back: 'bg-white dark:bg-slate-900 border-2 border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40',
  undo: 'bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
};

/**
 * Dating-app style row of round buttons with a short label under each. The order is physical
 * (left to right, also in Persian): it matches the swipe directions (left = no, right = yes).
 * Fixed at the bottom on phones.
 */
export const RoundActionBar: React.FC<{ actions: RoundAction[]; className?: string }> = ({ actions, className = '' }) => {
  const barRef = useMobileActionBar<HTMLDivElement>();
  return (
    <div ref={barRef} dir="ltr" className={`mt-4 flex items-start justify-center gap-6 sm:gap-10 ${MOBILE_ACTION_BAR} max-sm:pt-2.5 ${className}`}>
      {actions.map(a => {
        const lg = (a.size ?? 'lg') === 'lg';
        return (
          <button
            key={a.id}
            ref={a.buttonRef}
            type="button"
            onClick={a.onClick}
            disabled={a.disabled}
            aria-disabled={a.muted || undefined}
            title={a.hint ?? a.label}
            aria-label={a.hint ? `${a.label} (${a.hint})` : a.label}
            data-action={a.id}
            className={`group flex flex-col items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none ${a.muted ? 'opacity-40' : ''} ${lg ? '' : 'pt-2'}`}
          >
            <span
              className={`flex items-center justify-center rounded-full transition-all group-active:scale-90 group-focus-visible:ring-2 group-focus-visible:ring-indigo-500 group-focus-visible:ring-offset-2 dark:group-focus-visible:ring-offset-slate-950 ${TONE[a.tone]} ${lg ? 'w-16 h-16 [&_svg]:w-7 [&_svg]:h-7' : 'w-12 h-12 [&_svg]:w-5 [&_svg]:h-5'}`}
            >
              {a.icon}
            </span>
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{a.label}</span>
          </button>
        );
      })}
    </div>
  );
};
