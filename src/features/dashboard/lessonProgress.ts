/**
 * Progress per DaF kompakt lesson for the metro map on the dashboard (pure, unit-tested).
 * A lesson's words count as added once their card is in the Leitner box (any box, archive included).
 */

export interface LessonWord { id: string; lektion?: string; niveau?: string }

export interface LessonStation {
  lektion: string;          // "01" … "30"
  niveau: string;           // "A1" | "A2" | "B1"
  total: number;
  added: number;
  status: 'done' | 'partial' | 'none';
  percent: number;          // 0–100, rounded down (100 only when every word is added)
}

export function lessonProgress(catalog: LessonWord[], cardIds: Iterable<string>): { stations: LessonStation[]; current: string | null } {
  const inBox = new Set(cardIds);
  const byLesson = new Map<string, { niveau: string; total: number; added: number }>();
  for (const w of catalog) {
    const l = (w.lektion || '').trim();
    if (!l) continue;
    const s = byLesson.get(l) ?? { niveau: w.niveau || '', total: 0, added: 0 };
    s.total++;
    if (inBox.has(w.id)) s.added++;
    if (!s.niveau && w.niveau) s.niveau = w.niveau;
    byLesson.set(l, s);
  }
  const stations = [...byLesson.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
    .map(([lektion, s]): LessonStation => ({
      lektion,
      niveau: s.niveau,
      total: s.total,
      added: s.added,
      status: s.added >= s.total ? 'done' : s.added > 0 ? 'partial' : 'none',
      percent: s.added >= s.total ? 100 : Math.floor((s.added / s.total) * 100)
    }));
  // "You are here": the first lesson that isn't complete (new words come from there, in book order)
  const current = stations.find(s => s.status !== 'done')?.lektion ?? null;
  return { stations, current };
}
