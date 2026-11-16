/** Joins class names, skipping empty ones: cx('a', cond && 'b'). */
export const cx = (...parts: Array<string | false | null | undefined>): string => parts.filter(Boolean).join(' ');
