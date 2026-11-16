/**
 * Loading of story content (static JSON in /data/stories) and the audio indexes. Revalidates with `cache: 'no-cache'`
 * so a new deploy is picked up, and keeps the result in memory for the session.
 */
import type { GrammarFile, Story, StoryIndex } from '../../types/dictation';

export interface AudioIndexEntry { key: string; ms: number; bytes: number; textHash: string }
export interface AudioIndex { version: 1; mode: 'A' | 'B'; sentences: Record<string, AudioIndexEntry> }

const memory = new Map<string, unknown>();
const TIMEOUT_MS = 8000;

async function getJson<T>(url: string, optional = false): Promise<T | null> {
  if (memory.has(url)) return memory.get(url) as T;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (res.status === 404 && optional) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const data = (await res.json()) as T;
    memory.set(url, data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadIndex(): Promise<StoryIndex> {
  return (await getJson<StoryIndex>('/data/stories/index.json'))!;
}

export async function loadStory(file: string): Promise<Story> {
  return (await getJson<Story>(`/data/stories/${file}`))!;
}

/** The audio index of a mode; null when the story has none for that mode (the chain then skips the mode). */
export async function loadAudioIndex(storyId: string, mode: 'A' | 'B'): Promise<AudioIndex | null> {
  try {
    const data = await getJson<AudioIndex>(`/data/stories/${storyId}.audio.${mode}.json`, true);
    // Vite's dev server answers a missing file with index.html (status 200): treat anything without sentences as absent
    return data && typeof data === 'object' && data.sentences ? data : null;
  } catch {
    return null;
  }
}

/** The grammar cards of a story; null when absent or malformed (the drawer is then simply not shown). */
export async function loadGrammar(storyId: string): Promise<GrammarFile | null> {
  try {
    const data = await getJson<GrammarFile>(`/data/stories/${storyId}.grammar.json`, true);
    return data && typeof data === 'object' && Array.isArray(data.cards) && data.first ? data : null;
  } catch {
    return null;
  }
}

export const forgetContent = () => memory.clear();
