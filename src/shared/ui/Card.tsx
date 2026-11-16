/** A white (dark: slate) panel with the card radius. `as` changes the element (section, article, li, ...). */
import React from 'react';
import { cx } from './cx';

type CardProps<T extends React.ElementType> = { as?: T; padded?: boolean } & React.ComponentPropsWithoutRef<T>;

export function Card<T extends React.ElementType = 'div'>({ as, padded = true, className, ...rest }: CardProps<T>) {
  const Tag = (as || 'div') as React.ElementType;
  return (
    <Tag className={cx('bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-xs',
      padded && 'p-5 sm:p-6', className)} {...rest} />
  );
}
