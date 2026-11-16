/** A row of mutually exclusive options (like tabs for a filter). Arrow keys move between them. */
import React, { useRef } from 'react';
import { cx } from './cx';

export interface Segment<T extends string> { value: T; label: React.ReactNode; count?: number }

export function SegmentedControl<T extends string>({ value, onChange, options, label, className }: {
  value: T; onChange: (v: T) => void; options: Segment<T>[]; label: string; className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number, d: number) => {
    const n = (i + d + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cx('inline-flex p-1 gap-1 bg-slate-100 dark:bg-slate-800 rounded-control', className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} ref={el => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={e => {
              const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
              if (e.key === 'ArrowRight') { e.preventDefault(); move(i, rtl ? -1 : 1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, rtl ? 1 : -1); }
            }}
            className={cx('min-h-9 px-3 rounded-[calc(var(--radius-control)-0.25rem)] text-xs font-semibold transition-colors inline-flex items-center gap-1.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              on ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white')}>
            {o.label}
            {o.count !== undefined && <span className="font-mono-num opacity-70">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
