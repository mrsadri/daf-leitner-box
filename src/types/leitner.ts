import type { Lang } from '../i18n/format';

export type CardType = 'vocab' | 'reflection';

export type ArtikelType = 'der' | 'die' | 'das' | '–';

export type ReflectionCategory = 'decision' | 'motivation' | 'habit' | 'goal' | 'note';

export interface LeitnerCard {
  id: string;
  type: CardType;
  box: number; // 0, 1, 2, 3, 4, 5, or 6 (Mastered)
  lastReviewedAt: string | null; // ISO string
  nextReviewDate: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  reviewCount: number;
  correctCount: number;
  wrongCount: number;

  // Vocab fields (from DaF kompakt or custom)
  wort?: string;
  persisch?: string;
  artikel?: string; // 'der' | 'die' | 'das' | '–'
  beispiel?: string;
  formen?: string;
  plural?: string;
  wortart?: string;
  oesterreich?: string;
  lektion?: string;
  niveau?: string;
  nr?: string;
  feld?: string;
  // English versions (from the CSV; for book words these are looked up from the catalog at display time)
  englisch?: string;
  beispielEn?: string;
  formenEn?: string;
  oesterreichEn?: string;
  // Accepted Perfekt answers for verbs, separated by " | " ("ist gerudert | hat gerudert")
  perfekt?: string;
  // Conjugation data for verbs (3rd person singular forms; see src/services/conjugation.ts)
  infinitiv?: string;
  praesens?: string;
  praeteritum?: string;
  reflexiv?: string;

  // Reflection / Decision fields
  title?: string;
  content?: string;
  category?: ReflectionCategory;
}

export interface BoxConfig {
  index: number;
  intervalDays: number; // 2^index -> 1, 2, 4, 8, 16, 32
  color: string;
  accentColor: string;
}
// Box names, formulas and descriptions are localized: see `boxes` in src/i18n/fa.ts

export const BOX_CONFIGS: BoxConfig[] = [
  {
    index: 0,
    intervalDays: 1, // 2^0
    color: 'from-amber-500/10 to-amber-600/5 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    accentColor: 'bg-amber-500 text-white'
  },
  {
    index: 1,
    intervalDays: 2, // 2^1
    color: 'from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
    accentColor: 'bg-blue-500 text-white'
  },
  {
    index: 2,
    intervalDays: 4, // 2^2
    color: 'from-indigo-500/10 to-indigo-600/5 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300',
    accentColor: 'bg-indigo-500 text-white'
  },
  {
    index: 3,
    intervalDays: 8, // 2^3
    color: 'from-violet-500/10 to-violet-600/5 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300',
    accentColor: 'bg-violet-500 text-white'
  },
  {
    index: 4,
    intervalDays: 16, // 2^4
    color: 'from-teal-500/10 to-teal-600/5 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300',
    accentColor: 'bg-teal-600 text-white'
  },
  {
    index: 5,
    intervalDays: 32, // 2^5
    color: 'from-emerald-500/10 to-emerald-600/5 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
    accentColor: 'bg-emerald-600 text-white'
  }
];

export interface AppSettings {
  soundEnabled: boolean;
  speechRate: number; // 0.75 - 1.25
  autoSpeak: boolean;
  hapticFeedback: boolean;
  nounsOnlyMode: boolean; // Focus solely on Nouns & mastering articles
  language?: Lang; // Interface language; unset means the default (Persian)
}


export const MASTERED_BOX = 6;

export interface ReviewEvent {
  cardId: string;
  cardType: CardType;
  correct: boolean;
  fromBox: number;
  toBox: number;
  reviewDay: string; // YYYY-MM-DD in the user's local timezone
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  showOnLeaderboard: boolean;
  onboarded: boolean;
  isAdmin: boolean;
  suspended: boolean;
}
