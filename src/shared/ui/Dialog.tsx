/**
 * The only modal frame in the app. Use it for every dialog and bottom sheet; never build an overlay by hand.
 *
 * What it does, so callers don't have to:
 *   - overlay, centred panel (or a bottom sheet on phones: placement="sheet"), safe-area padding
 *   - Esc and a click on the backdrop close it (unless `dismissable` is false, e.g. while saving)
 *   - focus moves into the dialog (to [data-autofocus] or the first control), Tab stays inside, and focus returns to
 *     the element that opened it when it closes
 *   - the page behind it doesn't scroll
 *   - keyboard shortcuts of the screen behind it (review: Space, D/E/S, …) are paused: those handlers call
 *     isDialogOpen() and do nothing while a dialog is open
 *   - role="dialog", aria-modal, labelled by the title
 */
import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from './cx';
import { IconButton } from './Button';
import { useI18n } from '../../i18n/I18nProvider';

const dialogStack: HTMLElement[] = [];
const inertBefore = new Map<HTMLElement, boolean>();
let originalOverflow = '';
function updateBackground() {
  const top = dialogStack.at(-1);
  if (!top) {
    inertBefore.forEach((value, element) => { element.inert = value; });
    inertBefore.clear();
    document.body.style.overflow = originalOverflow;
    return;
  }
  for (const element of document.body.children) {
    if (!(element instanceof HTMLElement)) continue;
    if (!inertBefore.has(element)) inertBefore.set(element, element.inert);
    element.inert = element !== top;
  }
}
/** True while any Dialog is open. Screen-level keyboard shortcuts must check this first. */
export const isDialogOpen = (): boolean => dialogStack.length > 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  onClose: () => void;
  /** Shown as the heading and used as the accessible name */
  title: React.ReactNode;
  /** Optional line under the title */
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons row at the bottom (stays visible while the body scrolls) */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** center: a centred panel everywhere; sheet: a bottom sheet on phones, centred from 640px */
  placement?: 'center' | 'sheet';
  /** False while something is in progress that must not be interrupted */
  dismissable?: boolean;
  /** Hide the × button (the footer offers a way out) */
  hideClose?: boolean;
  testId?: string;
  className?: string;
}

const SIZES = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-3xl' };

export const Dialog: React.FC<DialogProps> = ({
  onClose, title, description, children, footer, size = 'md', placement = 'sheet', dismissable = true, hideClose, testId, className,
}) => {
  const { t } = useI18n();
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef({ onClose, dismissable });
  useEffect(() => { latest.current = { onClose, dismissable }; });

  useEffect(() => {
    const container = panel.current?.parentElement;
    if (!container) return;
    if (!dialogStack.length) originalOverflow = document.body.style.overflow;
    dialogStack.push(container);
    updateBackground();
    const opener = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus();
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (!panel.current || dialogStack.at(-1) !== container) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (latest.current.dismissable) latest.current.onClose();
      } else if (e.key === 'Tab') {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.offsetParent !== null);
        if (items.length === 0) { e.preventDefault(); return; }
        const firstEl = items[0], lastEl = items[items.length - 1];
        const inside = panel.current.contains(document.activeElement);
        if (e.shiftKey && (document.activeElement === firstEl || !inside)) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && (document.activeElement === lastEl || !inside)) { e.preventDefault(); firstEl.focus(); }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      const index = dialogStack.indexOf(container);
      if (index !== -1) dialogStack.splice(index, 1);
      updateBackground();
      window.removeEventListener('keydown', onKey, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  const sheet = placement === 'sheet';
  return createPortal(
    <div className={cx('fixed inset-0 z-[60] flex justify-center', sheet ? 'items-end sm:items-center sm:p-4' : 'items-center p-4')} data-testid={testId}>
      {/* Backdrop: a real button, so closing by tapping outside is also reachable without a mouse (but not in the tab order) */}
      <button type="button" tabIndex={-1} aria-label={t.common.close} className="absolute inset-0 w-full h-full bg-black/50 backdrop-blur-xs cursor-default"
        onClick={() => { if (dismissable) onClose(); }} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cx(
          'relative w-full max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl focus:outline-none',
          sheet ? 'rounded-t-sheet sm:rounded-sheet pb-[env(safe-area-inset-bottom)]' : 'rounded-sheet max-w-[calc(100vw-2rem)]',
          SIZES[size], className,
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-3">
          <div className="min-w-0 space-y-1">
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {description && <p id={descId} className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>}
          </div>
          {!hideClose && (
            <IconButton label={t.common.close} size="sm" onClick={onClose} disabled={!dismissable} className="-me-2 -mt-1 shrink-0">
              <X className="w-5 h-5" />
            </IconButton>
          )}
        </div>
        {children && <div className="px-5 sm:px-6 pb-5 overflow-y-auto text-sm text-slate-700 dark:text-slate-300 space-y-4">{children}</div>}
        {footer && (
          <div className="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};
