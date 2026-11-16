/**
 * Which grammar points the drawer shows (docs/dictation/08-grammar-drawer.md). Pure functions, no React.
 *
 * The trigger is the sentence the learner most recently *entered* (submitted, pressed Next on, or skipped). Until the
 * first entry the drawer lists the points of the whole sequence.
 */
import type { GrammarCard, GrammarFile, Sequence, Sentence } from '../../types/dictation';

export interface DrawerContent {
  mode: 'sentence' | 'sequence';
  /** Points taught in this story's block ("New in this story"). */
  fresh: GrammarCard[];
  /** Points from an earlier block that occur again ("Also used here"). */
  again: GrammarCard[];
  /** For the sentence mode: the points whose first occurrence in the story is this sentence. */
  firstHere: ReadonlySet<string>;
}

export function pickDrawerContent(
  file: GrammarFile, storyBlock: number, sequence: Sequence, trigger: Sentence | null
): DrawerContent {
  const byId = new Map(file.cards.map(c => [c.id, c]));
  const ids = new Set<string>();
  const sentences = trigger ? [trigger] : sequence.sentences;
  for (const s of sentences) for (const id of s.grammar) ids.add(id);
  const cards: GrammarCard[] = [];
  for (const id of ids) { const c = byId.get(id); if (c) cards.push(c); }   // an id without a card is skipped silently
  cards.sort((a, b) => a.block - b.block || a.lesson - b.lesson || a.id.localeCompare(b.id));
  const firstHere = new Set<string>();
  if (trigger) for (const id of trigger.grammar) if (file.first[id] === trigger.id) firstHere.add(id);
  return {
    mode: trigger ? 'sentence' : 'sequence',
    fresh: cards.filter(c => c.block === storyBlock),
    again: cards.filter(c => c.block !== storyBlock),
    firstHere,
  };
}

/** Open state of the desktop column: the learner's stored choice wins, otherwise open from 1024 px. */
export function drawerOpenDefault(stored: boolean | undefined, viewportWidth: number): boolean {
  return stored ?? viewportWidth >= 1024;
}

/** The on-screen keyboard is considered up when the visual viewport lost a large part of the window height. */
export function keyboardIsUp(innerHeight: number, visualHeight: number): boolean {
  return innerHeight - visualHeight > 150;
}
