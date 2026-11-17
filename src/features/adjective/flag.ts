/**
 * The adjective drill kill switch. On unless app_flags.adjective_drill_enabled is false in Supabase; the
 * owner can turn it off with one SQL statement, without a deploy (docs/supabase-adjective-setup.md). A
 * missing or unreadable flag means on.
 */
import { supabase } from '../../shared/lib/supabase';
import { isDemoMode } from '../../shared/lib/demo';
import { parseFlagValue } from '../stories/flag';

export const ADJECTIVE_DRILL_DEFAULT = true;

export async function adjectiveDrillEnabled(): Promise<boolean> {
  if (isDemoMode || !supabase) return ADJECTIVE_DRILL_DEFAULT;
  try {
    const { data, error } = await supabase.from('app_flags').select('value').eq('key', 'adjective_drill_enabled').maybeSingle();
    if (error || !data) return ADJECTIVE_DRILL_DEFAULT;
    return parseFlagValue(data.value) ?? ADJECTIVE_DRILL_DEFAULT;
  } catch {
    return ADJECTIVE_DRILL_DEFAULT;
  }
}
