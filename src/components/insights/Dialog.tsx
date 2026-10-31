import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface DialogProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  confirmDisabled?: boolean;
  testId?: string;
}

/** Bottom sheet on phones, centred dialog on larger screens. Escape / backdrop close; focus stays inside. */
export const Dialog: React.FC<DialogProps> = ({ title, onClose, children, confirmLabel, onConfirm, tone = 'primary', busy, confirmDisabled, testId }) => {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!latest.current.busy) latest.current.onClose();
      } else if (e.key === 'Tab' && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea, input');
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-xs" onClick={() => !busy && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        data-testid={testId}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl pb-[env(safe-area-inset-bottom)]"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3">
          <h3 id="share-dialog-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label={t.common.close}
            className="w-8 h-8 shrink-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{children}</div>
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            {t.common.cancel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            data-testid="dialog-confirm"
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50 flex items-center gap-2 ${
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const CATEGORY_COLORS = {
  decision: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
  motivation: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  goal: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  habit: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  note: 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
} as const;

/** Small round avatar with the first letter as fallback; "?" for anonymous. */
export const MiniAvatar: React.FC<{ name: string | null; url?: string | null; size?: 'sm' | 'md' }> = ({ name, url, size = 'sm' }) => {
  const cls = size === 'md' ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[11px]';
  return url ? (
    <img src={url} alt="" referrerPolicy="no-referrer" className={`${cls} rounded-full object-cover shrink-0`} />
  ) : (
    <span aria-hidden="true" className={`${cls} rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold shrink-0`}>
      {name ? name.slice(0, 1) : '?'}
    </span>
  );
};
