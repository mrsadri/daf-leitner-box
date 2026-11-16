/**
 * The Stories kill switch. Stories are on unless app_flags.stories_enabled is false in Supabase; the owner can turn
 * them off with one SQL statement, without a deploy (docs/supabase-cleanup-setup.md). A missing or unreadable flag
 * means on.
 */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';

export const STORIES_DEFAULT = true;

/** app_flags.value is jsonb: true/false or 'true'/'false'. Anything else counts as unreadable (null). */
export function parseFlagValue(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

export async function storiesEnabled(): Promise<boolean> {
  if (isDemoMode || !supabase) return STORIES_DEFAULT;
  try {
    const { data, error } = await supabase.from('app_flags').select('value').eq('key', 'stories_enabled').maybeSingle();
    if (error || !data) return STORIES_DEFAULT;
    return parseFlagValue(data.value) ?? STORIES_DEFAULT;
  } catch {
    return STORIES_DEFAULT;
  }
}
