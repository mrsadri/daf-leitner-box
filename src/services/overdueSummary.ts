/** Grouping of the server's overdue moves for the explanation popup (pure, unit-tested). */

export interface OverdueMove {
  cardId: string;
  fromBox: number;
  toBox: number;
  demotedOn: string;
}

export interface OverdueSummary {
  total: number;
  /** "box 3 → box 2: 4 cards", highest box first */
  groups: { fromBox: number; toBox: number; count: number }[];
  /** Card ids, most recent move first, each once */
  cardIds: string[];
}

export function summarizeOverdueMoves(moves: OverdueMove[]): OverdueSummary {
  const byPair = new Map<string, { fromBox: number; toBox: number; count: number }>();
  const latest = new Map<string, OverdueMove>();
  for (const m of moves) {
    const prev = latest.get(m.cardId);
    // A card moved on several nights: from its first box to its last one
    if (!prev) latest.set(m.cardId, { ...m });
    else latest.set(m.cardId, {
      ...m,
      fromBox: Math.max(prev.fromBox, m.fromBox),
      toBox: Math.min(prev.toBox, m.toBox),
      demotedOn: m.demotedOn > prev.demotedOn ? m.demotedOn : prev.demotedOn
    });
  }
  for (const m of latest.values()) {
    const key = `${m.fromBox}-${m.toBox}`;
    const g = byPair.get(key) ?? { fromBox: m.fromBox, toBox: m.toBox, count: 0 };
    g.count++;
    byPair.set(key, g);
  }
  const groups = [...byPair.values()].sort((a, b) => b.fromBox - a.fromBox || b.toBox - a.toBox);
  const cardIds = [...latest.values()].sort((a, b) => b.demotedOn.localeCompare(a.demotedOn)).map(m => m.cardId);
  return { total: latest.size, groups, cardIds };
}
