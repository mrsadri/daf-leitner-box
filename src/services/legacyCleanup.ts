/**
 * Removes browser storage left by features that no longer exist, so old data doesn't sit on devices forever.
 * Runs once per page load before the app starts; cheap (one pass over localStorage keys) and never throws.
 *
 *   daf_dictation_*   story dictation (removed 2026-11, replaced by Stories): progress cache, queue, drafts, voice map
 */
const PREFIXES = ['daf_dictation_'];

export function removeLegacyStorage(storage: Pick<Storage, 'length' | 'key' | 'removeItem'> = localStorage): number {
  let removed = 0;
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const k = storage.key(i);
      if (k && PREFIXES.some(p => k.startsWith(p))) {
        storage.removeItem(k);
        removed++;
      }
    }
  } catch { /* storage blocked (private mode): nothing to clean */ }
  return removed;
}
