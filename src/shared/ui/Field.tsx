/**
 * Form fields with their label. The label is always visible (placeholders are not labels). `hint` adds a line under
 * the field, `error` replaces it in red and marks the field invalid for screen readers.
 */
import React, { useId } from 'react';
import { cx } from './cx';

export const fieldClass = cx(
  'w-full px-3.5 py-2.5 text-sm rounded-control bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700',
  'text-slate-900 dark:text-white placeholder:text-slate-400',
  'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none',
  'aria-[invalid=true]:border-red-500',
);

interface Wrap { label: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; className?: string }

function useField({ hint, error }: Pick<Wrap, 'hint' | 'error'>) {
  const id = useId();
  const noteId = hint || error ? `${id}-note` : undefined;
  return { id, noteId, aria: { 'aria-describedby': noteId, 'aria-invalid': error ? true : undefined } };
}

const Note: React.FC<{ id?: string; hint?: React.ReactNode; error?: React.ReactNode }> = ({ id, hint, error }) =>
  hint || error ? <p id={id} className={cx('text-caption', error ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-slate-400')}>{error || hint}</p> : null;

const Label: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) =>
  <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{children}</label>;

export const TextField: React.FC<Wrap & React.InputHTMLAttributes<HTMLInputElement>> = ({ label, hint, error, className, ...rest }) => {
  const f = useField({ hint, error });
  return (
    <div className={cx('space-y-1.5', className)}>
      <Label htmlFor={f.id}>{label}</Label>
      <input id={f.id} dir="auto" className={fieldClass} {...f.aria} {...rest} />
      <Note id={f.noteId} hint={hint} error={error} />
    </div>
  );
};

export const TextArea: React.FC<Wrap & React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ label, hint, error, className, rows = 3, ...rest }) => {
  const f = useField({ hint, error });
  return (
    <div className={cx('space-y-1.5', className)}>
      <Label htmlFor={f.id}>{label}</Label>
      <textarea id={f.id} dir="auto" rows={rows} className={cx(fieldClass, 'leading-relaxed')} {...f.aria} {...rest} />
      <Note id={f.noteId} hint={hint} error={error} />
    </div>
  );
};

export const Select: React.FC<Wrap & React.SelectHTMLAttributes<HTMLSelectElement>> = ({ label, hint, error, className, children, ...rest }) => {
  const f = useField({ hint, error });
  return (
    <div className={cx('space-y-1.5', className)}>
      <Label htmlFor={f.id}>{label}</Label>
      <select id={f.id} className={fieldClass} {...f.aria} {...rest}>{children}</select>
      <Note id={f.noteId} hint={hint} error={error} />
    </div>
  );
};
