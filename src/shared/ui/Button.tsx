/**
 * The app's buttons. Use these instead of styling <button> by hand.
 *   variant: primary (one per view), secondary, ghost (low emphasis), danger (destructive)
 *   size:    md (default, 44px touch target) or sm (inline actions)
 * IconButton is the icon-only form and requires a label for screen readers.
 */
import React from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100',
  ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-xs',
};
const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs gap-1.5',
  md: 'min-h-11 px-4 text-sm gap-2',
};
export const buttonClass = (variant: ButtonVariant = 'primary', size: ButtonSize = 'md', block = false) => cx(
  'inline-flex items-center justify-center rounded-control font-semibold transition-colors select-none',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  VARIANTS[variant], SIZES[size], block && 'w-full',
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width */
  block?: boolean;
  /** Shows a spinner and disables the button */
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, icon, className, children, disabled, type = 'button', ...rest }, ref
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined}
      className={cx(buttonClass(variant, size, block), className)} {...rest}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  /** Required: what the button does, for screen readers and the tooltip */
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, type = 'button', ...rest }, ref
) {
  return (
    <button ref={ref} type={type} aria-label={label} title={label}
      className={cx(buttonClass(variant, size), size === 'md' ? 'w-11 px-0' : 'w-9 px-0', className)} {...rest}>
      {children}
    </button>
  );
});
