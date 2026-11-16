import React from 'react';

/**
 * A 3D icon from public/icons3d (thiings.co, free licence with visible attribution: see docs/icon-credits.md).
 * Decorative: hidden from screen readers; the meaning is always in the text next to it.
 */
export const Icon3D: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 48, className = '' }) => (
  <img
    src={`/icons3d/${name}.webp`}
    alt=""
    aria-hidden="true"
    width={size}
    height={size}
    loading="lazy"
    decoding="async"
    draggable={false}
    className={`select-none pointer-events-none object-contain shrink-0 ${className}`}
    style={{ width: size, height: size }}
  />
);

/** Section heading in the style of a blue information sign (inspired by public signage; no official sign). */
export const SignHeading: React.FC<{ icon?: string; children: React.ReactNode; as?: 'h2' | 'h3' }> = ({ icon, children, as: Tag = 'h2' }) => (
  <Tag className="inline-flex items-center gap-2 ps-1.5 pe-3 py-1.5 rounded-xl bg-indigo-700 text-white text-base sm:text-lg font-bold shadow-sm ring-2 ring-white dark:ring-slate-900 outline outline-1 outline-indigo-700/40">
    {icon && <Icon3D name={icon} size={30} className="drop-shadow" />}
    <span>{children}</span>
  </Tag>
);
