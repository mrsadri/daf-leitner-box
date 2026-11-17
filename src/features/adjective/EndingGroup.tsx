/**
 * One blank in the drill: a prefix ("d", "kalt", "Kaffee") followed by a row of ending choices.
 * Arrow keys move inside the group (like SegmentedControl); Enter/Space select. Once answered, the
 * correct ending is marked and a wrong choice is marked too.
 */
import React, { useRef } from 'react';
import { Check, X } from 'lucide-react';
import { cx } from '../../shared/ui/cx';
import { De } from '../../shared/ui/Text';

const display = (e: string) => (e === '' ? '–' : `-${e}`);

export function EndingGroup({ label, prefix, options, value, correct, disabled, onSelect }: {
  label: string;
  prefix: string;
  options: string[];
  value: string | null;
  correct: string;
  disabled: boolean;
  onSelect: (ending: string) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number, d: number) => {
    const n = (i + d + options.length) % options.length;
    refs.current[n]?.focus();
  };

  return (
    <div className="inline-flex flex-col items-start gap-1.5" data-testid="ending-group">
      <De className="text-lg sm:text-xl font-semibold text-slate-800 dark:text-slate-100">{prefix}</De>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1">
        {options.map((opt, i) => {
          const selected = value === opt;
          const isCorrect = disabled && opt === correct;
          const isWrongPick = disabled && selected && opt !== correct;
          return (
            <button
              key={opt || '–'}
              ref={el => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              tabIndex={selected || (!value && i === 0) ? 0 : -1}
              onClick={() => !disabled && onSelect(opt)}
              onKeyDown={e => {
                const rtl = getComputedStyle(e.currentTarget).direction === 'rtl';
                if (e.key === 'ArrowRight') { e.preventDefault(); move(i, rtl ? -1 : 1); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); move(i, rtl ? 1 : -1); }
              }}
              className={cx(
                'min-h-9 min-w-9 px-2.5 rounded-control border text-sm font-mono-num font-semibold transition-colors inline-flex items-center gap-1',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-default',
                isCorrect && 'bg-emerald-50 border-emerald-400 text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300',
                isWrongPick && 'bg-red-50 border-red-400 text-red-700 dark:bg-red-950/50 dark:border-red-700 dark:text-red-300',
                !disabled && selected && 'bg-indigo-600 border-indigo-600 text-white',
                !disabled && !selected && 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
              )}
            >
              {isCorrect && <Check className="w-3.5 h-3.5" aria-hidden />}
              {isWrongPick && <X className="w-3.5 h-3.5" aria-hidden />}
              <De as="span">{display(opt)}</De>
            </button>
          );
        })}
      </div>
    </div>
  );
}
