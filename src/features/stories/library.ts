import type { BookSummary, StoryProgress } from './types';

// Editorial book names are presentation metadata. Story titles, source text and IDs stay untouched.
const TITLES: Record<number, string> = {
  1: 'Ankommen in Graz', 2: 'Ein neuer Alltag', 4: 'Ein neues Zuhause', 5: 'Wieder auf den Beinen',
};
export const bookTitle = (book: Pick<BookSummary, 'n' | 'title'>): string => TITLES[book.n] ?? book.title;

export function lastReading(books: BookSummary[], progress: Record<string, StoryProgress>) {
  return books.flatMap(book => book.stories.flatMap((story, i) => {
    const saved = progress[story.id];
    const unlocked = i === 0 || !!progress[book.stories[i - 1].id]?.completedAt;
    return saved && !saved.completedAt && unlocked ? [{ book, story, saved }] : [];
  })).sort((a, b) => b.saved.updatedAt.localeCompare(a.saved.updatedAt))[0];
}
