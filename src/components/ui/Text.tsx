import React from 'react';

/**
 * German text. Always left-to-right and tagged `lang="de"`, so in the Persian (RTL) interface
 * punctuation stays in place ("Wie?" not "?Wie", "der Name" not "Name der") and the browser
 * hyphenates long compounds with German rules.
 */
export const De: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'span' | 'div' | 'p' | 'h2' | 'h3' | 'strong' }> = ({
  as: Tag = 'span',
  className = '',
  children,
  ...rest
}) => (
  <Tag dir="ltr" lang="de" className={`font-de ${className}`} {...rest}>
    {children}
  </Tag>
);

/**
 * Text whose language we don't know (user-written reflections and custom cards, mixed notes such as
 * "die Tätigkeit: فعالیت"). The paragraph takes the direction of its first strong character.
 */
export const Auto: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'span' | 'div' | 'p' | 'h2' | 'h3' }> = ({
  as: Tag = 'span',
  children,
  ...rest
}) => (
  <Tag dir="auto" {...rest}>
    {children}
  </Tag>
);

/** Left-to-right technical text (emails, keys, codes). */
export const Ltr: React.FC<React.HTMLAttributes<HTMLElement> & { as?: 'span' | 'code' | 'div' }> = ({
  as: Tag = 'span',
  children,
  ...rest
}) => (
  <Tag dir="ltr" {...rest}>
    {children}
  </Tag>
);

const PERSIAN = /[؀-ۿ]/;
export const hasPersian = (s: string | undefined) => !!s && PERSIAN.test(s);

/**
 * Split a book example ("Wie ist Ihr Name? · اسمتون چیه؟") into its German sentences
 * and its translation, so each part can be rendered with its own direction.
 */
export function splitExample(beispiel: string | undefined): { german: string; translation: string } {
  const german: string[] = [];
  const translation: string[] = [];
  (beispiel || '').split(' · ').map(p => p.trim()).filter(Boolean).forEach(part => {
    (PERSIAN.test(part) ? translation : german).push(part);
  });
  return { german: german.join(' · '), translation: translation.join(' · ') };
}
