import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/demo';
import { leitnerEngine } from './leitnerEngine';
import type { OverdueMove } from './overdueSummary';

/**
 * Cards the server moved back because they were overdue (supabase/migrations/20261030_overdue_overtake.sql),
 * not yet explained to the user. Empty when offline or when the database part isn't installed yet.
 */
export async function fetchUnseenOverdueMoves(): Promise<OverdueMove[]> {
  if (isDemoMode) return demoMoves();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('overdue_demotions')
      .select('card_id, from_box, to_box, demoted_on')
      .is('seen_at', null)
      .order('id', { ascending: true })
      .limit(5000);
    if (error || !data) return [];
    return data.map((r: { card_id: string; from_box: number; to_box: number; demoted_on: string }) => ({
      cardId: r.card_id, fromBox: r.from_box, toBox: r.to_box, demotedOn: r.demoted_on
    }));
  } catch {
    return [];
  }
}

export async function markOverdueMovesSeen(): Promise<void> {
  if (isDemoMode) {
    try { localStorage.setItem(DEMO_SEEN_KEY, '1'); } catch { /* ignore */ }
    return;
  }
  if (!supabase) return;
  const { error } = await supabase.rpc('mark_overdue_demotions_seen');
  if (error) console.error('Could not mark overdue moves as seen', error);
}

// Demo mode (local development only): a few made-up moves so the popup can be seen and tested
const DEMO_SEEN_KEY = 'daf_demo_overdue_seen';
function demoMoves(): OverdueMove[] {
  try {
    if (localStorage.getItem(DEMO_SEEN_KEY) === '1') return [];
  } catch { /* ignore */ }
  const today = new Date().toISOString().slice(0, 10);
  return leitnerEngine.getCards()
    .filter(c => c.box < 5)
    .slice(0, 9)
    .map((c, i) => ({ cardId: c.id, fromBox: c.box + (i % 4 === 0 ? 2 : 1), toBox: c.box, demotedOn: today }))
    .filter(m => m.fromBox <= 5);
}
