/** Loads the Stories index and books from /data/stories (same origin), once per page load. */
import type { NarrativeStory, StoriesIndex } from './types';

let indexPromise: Promise<StoriesIndex> | null = null;
const books = new Map<number, Promise<NarrativeStory>>();

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function loadIndex(): Promise<StoriesIndex> {
  indexPromise ??= getJson<StoriesIndex>('/data/stories/index.json').catch(e => { indexPromise = null; throw e; });
  return indexPromise;
}

export function loadBook(n: number): Promise<NarrativeStory> {
  let p = books.get(n);
  if (!p) {
    p = getJson<NarrativeStory>(`/data/stories/book-${String(n).padStart(2, '0')}.json`).catch(e => { books.delete(n); throw e; });
    books.set(n, p);
  }
  return p;
}

/** Picture URLs: the 800px file on phones, 1600px on wide screens. */
export const imageUrl = (key: string, small = false) => `/story-media/${key}${small ? '@800' : ''}.webp`;
