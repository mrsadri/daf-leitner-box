import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}

/** Accessible toggle. The knob moves toward the inline end, so it works in both RTL and LTR. */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, id, label, disabled, className = '' }) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 disabled:opacity-50 ${
      checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
    } ${className}`}
  >
    <span
      aria-hidden="true"
      className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
        checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);
