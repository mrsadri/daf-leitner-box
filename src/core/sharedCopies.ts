/**
 * Copies of other users' public insight cards had ids 'shared_<uuid>'. Public sharing was removed in 2026-11 and the
 * copies are deleted on the server; a device that still has one in its cache or sync queue drops it instead of
 * showing it or sending it back (the server also ignores such writes).
 */
export function isRemovedSharedCopy(card: { id: string }): boolean {
  return typeof card.id === 'string' && card.id.startsWith('shared_');
}
