/**
 * Shapes of the Stories content (public/data/stories/*.json, written by scripts/stories/build_stories.py) and of a
 * learner's progress. Keep in step with the build script.
 */

/** A word the app knows something about. Plain text between words is a string. */
export interface WordSegment {
  /** The word as written in the story */
  t: string;
  /** Candidate cards in the word list (ids like daf_02_24), best first */
  c?: string[];
  /** Bold in the source: a word of the lesson */
  b?: 1;
  /** Noun gender for the underline: masculine, feminine, neuter, plural */
  g?: 'm' | 'f' | 'n' | 'pl';
}
export type Segment = string | WordSegment;
export type Paragraph = Segment[];
export type Page = Paragraph[];

export interface QuizItem {
  q: string;
  options: string[];
  /** Index of the correct option */
  answer: number;
  /** The page (0-based) the answer comes from */
  page: number;
}

export interface StoryImage {
  /** images/S01-Q1.<hash>; files are /story-media/<key>.webp and <key>@800.webp */
  key: string;
  w: number;
  h: number;
  alt: { fa: string; en: string } | null;
}

export interface Scene {
  sentenceCount: number;
  id: string;          // S01-Q1
  n: number;           // 1..6 within the book
  title: string;
  situation: { fa: string; en: string };
  image: StoryImage | null;
  pages: Page[];
  quiz: QuizItem[];
}

export interface NarrativeStory {
  contentVersion: string;
  id: string;          // B01
  n: number;
  title: string;
  lessons: [number, number];
  /** Proper names: never offered as vocabulary */
  names: string[];
  stories: Scene[];
}

export interface NarrativeStorySummary {
  id: string;
  n: number;
  title: string;
  lessons: [number, number];
  contentVersion: string;
  stories: { id: string; n: number; title: string; image: string | null }[];
}

/** Three domain levels. The legacy book-NN.json wire names and SNN-QN IDs remain stable. */
export type Story = Scene; // Compatibility name for existing reader imports.
export type Book = NarrativeStory; // Existing book-NN.json transport name.
export type BookSummary = NarrativeStorySummary;
export interface NarrativeBook { id: string; title: string; storyIds: string[] }
export interface StoriesIndex { book: NarrativeBook; books: BookSummary[] }

/** One story's progress; stored in Supabase story_progress (one row per story) and in localStorage. */
export interface StoryProgress {
  storyId: string;
  /** Highest page reached (0-based) */
  page: number;
  totalPages: number;
  /** Quiz answered: the next story in the book opens */
  completedAt: string | null;
  /** Correct answers in the most recent synchronized quiz */
  score?: number;
  updatedAt: string;
}
