import { LeitnerCard, AppSettings, MASTERED_BOX, ReviewEvent } from '../types/leitner';
import { parseCSV, transformCsvToCards } from './csvParser';
import { toLocalDateString } from './dates';

export { toLocalDateString };

const CATALOG_URL = '/data/wortschatz-daf-kompakt.csv';
const MASTERED_DATE = '9999-12-31';
const SEED_WORD_COUNT = 15;

// Pre-login (single-user) storage keys. Only read once, to migrate old progress into the account.
export const LEGACY_CARDS_KEY = 'daf_leitner_cards_v1';
export const LEGACY_SETTINGS_KEY = 'daf_leitner_settings_v1';
const LEGACY_CATALOG_KEY = 'daf_catalog_words_v1';

const cacheKey = (userId: string) => `daf_cards_cache_${userId}`;
const settingsKey = (userId: string) => `daf_settings_cache_${userId}`;

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  speechRate: 0.9,
  autoSpeak: true,
  hapticFeedback: true,
  nounsOnlyMode: false
};

/**
 * Strips leading German articles (der, die, das) from a word string
 * so the front of the flashcard doesn't spoil the article quiz!
 */
export function stripArticleFromWord(wort: string = ''): string {
  if (!wort) return '';
  return wort
    .replace(/^der\s+\/\s+die\s+/i, '')
    .replace(/^der\s+\/\s+das\s+/i, '')
    .replace(/^die\s+\/\s+der\s+/i, '')
    .replace(/^das\s+\/\s+der\s+/i, '')
    .replace(/^der\s+/i, '')
    .replace(/^die\s+/i, '')
    .replace(/^das\s+/i, '')
    .replace(/\s*\/\s*die\s+/i, ' / ')
    .replace(/\s*\/\s*der\s+/i, ' / ')
    .replace(/\s*\/\s*das\s+/i, ' / ')
    .trim();
}

/**
 * Checks if a card is a Noun (Nomen) with German grammatical gender/article
 */
export function isNounCard(card: LeitnerCard): boolean {
  if (card.type !== 'vocab') return false;
  if (card.wortart === 'Nomen') return true;
  return getQuizArticle(card) !== null;
}

/**
 * The single article the article quiz expects for this card, or null when the card has none
 * (e.g. "Spanien · Spanisch · der Spanier" has artikel "–" and must not get a quiz it can't pass).
 * "die (Pl.)" counts as "die".
 */
export function getQuizArticle(card: LeitnerCard): 'der' | 'die' | 'das' | null {
  if (card.type !== 'vocab') return null;
  const fromField = (card.artikel || '').toLowerCase().trim().match(/^(der|die|das)\b/);
  if (fromField) return fromField[1] as 'der' | 'die' | 'das';
  const fromWord = (card.wort || '').toLowerCase().trim().match(/^(der|die|das)\s/);
  return fromWord ? (fromWord[1] as 'der' | 'die' | 'das') : null;
}

/**
 * Calculate next review date formatted as YYYY-MM-DD
 * Formula: today + 2^(box) days (Box 0: 1, Box 1: 2, Box 2: 4, Box 3: 8, Box 4: 16, Box 5: 32 days)
 */
export function calculateNextReviewDate(box: number, fromDate: Date = new Date()): string {
  const daysToAdd = Math.pow(2, Math.max(0, Math.min(5, box)));
  const nextDate = new Date(fromDate);
  nextDate.setDate(nextDate.getDate() + daysToAdd);
  return toLocalDateString(nextDate);
}

export function getTodayString(): string {
  return toLocalDateString(new Date());
}

export function isCardDue(card: LeitnerCard, todayStr: string = getTodayString()): boolean {
  if (card.box >= MASTERED_BOX) return false; // Mastered cards (after Box 5) don't have review due
  return card.nextReviewDate <= todayStr;
}

function normalizeImportedCard(raw: unknown): LeitnerCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Partial<LeitnerCard>;
  if (typeof c.id !== 'string' || !c.id || c.id.length > 200) return null;
  if (c.type !== 'vocab' && c.type !== 'reflection') return null;
  if (!Number.isInteger(c.box) || (c.box as number) < 0 || (c.box as number) > MASTERED_BOX) return null;
  if (typeof c.nextReviewDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(c.nextReviewDate)) return null;
  const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);
  return {
    ...(c as LeitnerCard),
    lastReviewedAt: typeof c.lastReviewedAt === 'string' ? c.lastReviewedAt : null,
    createdAt: typeof c.createdAt === 'string' ? c.createdAt : new Date().toISOString(),
    reviewCount: count(c.reviewCount),
    correctCount: count(c.correctCount),
    wrongCount: count(c.wrongCount)
  };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('localStorage write failed', e);
  }
}

/**
 * Fields of a book card that come from the CSV (as opposed to the user's progress).
 * Cards keep a copy from when they were added; on load these are refreshed from the current CSV,
 * so fixes, translations and split multi-verb cards reach existing cards. Progress is never touched.
 */
const CATALOG_CONTENT_FIELDS = [
  'wort', 'persisch', 'artikel', 'beispiel', 'formen', 'plural', 'wortart', 'oesterreich',
  'lektion', 'niveau', 'nr', 'feld', 'englisch', 'beispielEn', 'formenEn', 'oesterreichEn', 'perfekt',
  'infinitiv', 'praesens', 'praeteritum', 'reflexiv'
] as const;

/** Persistence hooks wired up by the cloud sync layer. */
export interface EngineHooks {
  onCardsUpserted: (cards: LeitnerCard[]) => void;
  onCardsDeleted: (ids: string[]) => void;
  onSettingsChanged: (settings: AppSettings) => void;
  onReview: (event: ReviewEvent) => void;
}

/**
 * Leitner Engine: in-memory state for the signed-in user.
 * Every mutation writes a local cache (offline fallback) and notifies the sync hooks.
 */
class LeitnerEngine {
  private cards: LeitnerCard[] = [];
  private catalog: LeitnerCard[] = [];
  private catalogById = new Map<string, LeitnerCard>();
  private catalogPromise: Promise<LeitnerCard[]> | null = null;
  private settings: AppSettings = DEFAULT_SETTINGS;
  private userId: string | null = null;
  private hooks: EngineHooks | null = null;

  constructor() {
    // The catalog used to be cached in localStorage (~1 MB); it is now always read from the CSV.
    try {
      localStorage.removeItem(LEGACY_CATALOG_KEY);
    } catch {
      // ignore
    }
  }

  public setHooks(hooks: EngineHooks | null) {
    this.hooks = hooks;
  }

  /** Replace the whole state with the given user's data (does not trigger sync). */
  public hydrate(userId: string, cards: LeitnerCard[], settings: Partial<AppSettings> | null) {
    this.userId = userId;
    // Only in memory and the local cache: nothing is sent to the server until a card is answered
    this.cards = cards.map(c => this.withCatalogContent(c));
    this.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    this.writeCache();
  }

  public reset() {
    this.userId = null;
    this.cards = [];
    this.settings = DEFAULT_SETTINGS;
    this.hooks = null;
  }

  public readCache(userId: string): { cards: LeitnerCard[]; settings: Partial<AppSettings> | null } | null {
    const raw = safeGet(cacheKey(userId));
    if (!raw) return null;
    try {
      const cards = JSON.parse(raw);
      const settingsRaw = safeGet(settingsKey(userId));
      return { cards: Array.isArray(cards) ? cards : [], settings: settingsRaw ? JSON.parse(settingsRaw) : null };
    } catch {
      return null;
    }
  }

  private writeCache() {
    if (!this.userId) return;
    safeSet(cacheKey(this.userId), JSON.stringify(this.cards));
    safeSet(settingsKey(this.userId), JSON.stringify(this.settings));
  }

  private persist(upserted: LeitnerCard[], deletedIds: string[] = []) {
    this.writeCache();
    if (deletedIds.length) this.hooks?.onCardsDeleted(deletedIds);
    if (upserted.length) this.hooks?.onCardsUpserted(upserted);
  }

  public saveSettings(newSettings: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.writeCache();
    this.hooks?.onSettingsChanged(this.settings);
    return this.settings;
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  /**
   * Load the DaF kompakt catalog from the bundled CSV (once per page load), sorted by lesson and word number.
   */
  public loadCatalog(): Promise<LeitnerCard[]> {
    if (!this.catalogPromise) {
      this.catalogPromise = fetch(CATALOG_URL)
        .then(res => {
          if (!res.ok) throw new Error(`Catalog request failed: ${res.status}`);
          return res.text();
        })
        .then(text => {
          const words = transformCsvToCards(parseCSV(text));
          words.sort((a, b) =>
            (a.lektion || '').localeCompare(b.lektion || '') ||
            (parseInt(a.nr || '0', 10) - parseInt(b.nr || '0', 10))
          );
          this.catalog = words;
          this.catalogById = new Map(words.map(w => [w.id, w]));
          return words;
        })
        .catch(err => {
          console.error('Failed to load default CSV asset', err);
          this.catalogPromise = null;
          return [];
        });
    }
    return this.catalogPromise;
  }

  /**
   * For a brand-new account, put the first words of Lesson 01 into Box 0 so the dashboard isn't empty.
   * Only runs once per account (the caller stores the `onboarded` flag), so resetting progress doesn't re-seed.
   */
  public seedFirstWords(): number {
    if (this.cards.length > 0 || this.catalog.length === 0) return 0;
    return this.addBatchWords(this.catalog.slice(0, SEED_WORD_COUNT));
  }

  public getCards(): LeitnerCard[] {
    return this.cards;
  }

  public getCatalog(): LeitnerCard[] {
    return this.catalog;
  }

  /** A copy of the card with its book content taken from the current CSV (progress fields unchanged). */
  public withCatalogContent(card: LeitnerCard): LeitnerCard {
    if (card.type !== 'vocab') return card;
    const word = this.catalogById.get(card.id);
    if (!word) return card;
    const content: Partial<LeitnerCard> = {};
    CATALOG_CONTENT_FIELDS.forEach(field => {
      (content as Record<string, unknown>)[field] = word[field];
    });
    return { ...card, ...content };
  }

  /** The current CSV entry for a book word (cards keep a copy of the fields from when they were added). */
  public getCatalogWord(id: string): LeitnerCard | undefined {
    return this.catalogById.get(id);
  }

  public getDueCards(todayStr: string = getTodayString()): LeitnerCard[] {
    return this.cards.filter(c => isCardDue(c, todayStr));
  }

  public getCardsInBox(boxIndex: number): LeitnerCard[] {
    return this.cards.filter(c => c.box === boxIndex);
  }

  public getMasteredCards(): LeitnerCard[] {
    return this.cards.filter(c => c.box >= MASTERED_BOX);
  }

  private applyReview(cardId: string, isCorrect: boolean, newBoxFor: (box: number) => number) {
    const cardIndex = this.cards.findIndex(c => c.id === cardId);
    if (cardIndex === -1) throw new Error('Card not found');

    const card = this.cards[cardIndex];
    const previousBox = card.box;
    const now = new Date();
    const newBox = newBoxFor(previousBox);

    const updatedCard: LeitnerCard = {
      ...card,
      box: newBox,
      lastReviewedAt: now.toISOString(),
      nextReviewDate: newBox >= MASTERED_BOX ? MASTERED_DATE : calculateNextReviewDate(newBox, now),
      reviewCount: (card.reviewCount || 0) + 1,
      correctCount: isCorrect ? (card.correctCount || 0) + 1 : (card.correctCount || 0),
      wrongCount: !isCorrect ? (card.wrongCount || 0) + 1 : (card.wrongCount || 0)
    };

    this.cards[cardIndex] = updatedCard;
    this.persist([updatedCard]);
    this.hooks?.onReview({
      cardId,
      cardType: card.type,
      correct: isCorrect,
      fromBox: previousBox,
      toBox: newBox,
      reviewDay: toLocalDateString(now)
    });

    return { updatedCard, previousBox, newBox };
  }

  /**
   * Record a response for a VOCABULARY card
   * - Correct: advances 1 box (Box 5 → 6 = Mastered). Next review = today + 2^newBox days.
   * - Wrong: demotes only 1 box (min 0). Next review = today + 2^newBox days.
   */
  public recordVocabAnswer(cardId: string, isCorrect: boolean) {
    return this.applyReview(cardId, isCorrect, box =>
      isCorrect ? Math.min(MASTERED_BOX, box + 1) : Math.max(0, box - 1)
    );
  }

  /**
   * Acknowledge a REFLECTION / DECISION card: no quiz, advances 1 box.
   */
  public acknowledgeReflection(cardId: string) {
    return this.applyReview(cardId, true, box => Math.min(MASTERED_BOX, box + 1));
  }

  private vocabKeys(): Set<string> {
    const keys = new Set<string>();
    this.cards.forEach(c => {
      if (c.type === 'vocab') {
        if (c.wort) keys.add(c.wort.toLowerCase().trim());
        keys.add(c.id);
      }
    });
    return keys;
  }

  /**
   * All catalog words that aren't in the user's boxes yet, in lesson order.
   */
  public getUnlearnedWords(): LeitnerCard[] {
    const keys = this.vocabKeys();
    return this.catalog.filter(word => {
      const w = (word.wort || '').toLowerCase().trim();
      return !keys.has(w) && !keys.has(word.id);
    });
  }

  /**
   * Add a new card into Box 0 (No daily limit). Due today unless `nextReviewDate` is given.
   */
  public addCard(cardData: Partial<LeitnerCard>): LeitnerCard {
    const id = cardData.id || `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const newCard: LeitnerCard = {
      type: cardData.type || 'vocab',
      ...cardData,
      id,
      box: 0,
      lastReviewedAt: null,
      nextReviewDate: cardData.nextReviewDate || getTodayString(),
      createdAt: new Date().toISOString(),
      reviewCount: 0,
      correctCount: 0,
      wrongCount: 0
    };

    // Avoid duplicates (same id, or same German spelling for vocab)
    const wortKey = (newCard.wort || '').toLowerCase().trim();
    const existing = this.cards.find(c =>
      c.id === id ||
      (newCard.type === 'vocab' && c.type === 'vocab' && !!wortKey && (c.wort || '').toLowerCase().trim() === wortKey)
    );
    if (existing) return existing;

    this.cards.unshift(newCard);
    this.persist([newCard]);
    return newCard;
  }

  /**
   * Batch add catalog words to Box 0 (due today)
   */
  public addBatchWords(words: LeitnerCard[]): number {
    const todayStr = getTodayString();
    const keys = this.vocabKeys();
    const added: LeitnerCard[] = [];

    words.forEach(word => {
      const w = (word.wort || '').toLowerCase().trim();
      if (keys.has(word.id) || (w && keys.has(w))) return;
      const card: LeitnerCard = {
        ...word,
        box: 0,
        nextReviewDate: todayStr,
        lastReviewedAt: null,
        createdAt: new Date().toISOString(),
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0
      };
      this.cards.push(card);
      added.push(card);
      keys.add(word.id);
      if (w) keys.add(w);
    });

    if (added.length > 0) this.persist(added);
    return added.length;
  }

  public deleteCard(cardId: string): boolean {
    const initialLen = this.cards.length;
    this.cards = this.cards.filter(c => c.id !== cardId);
    if (this.cards.length !== initialLen) {
      this.persist([], [cardId]);
      return true;
    }
    return false;
  }

  public updateCard(cardId: string, updates: Partial<LeitnerCard>): LeitnerCard | null {
    const idx = this.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return null;

    this.cards[idx] = { ...this.cards[idx], ...updates, id: cardId };
    this.persist([this.cards[idx]]);
    return this.cards[idx];
  }

  public resetCardToBox0(cardId: string) {
    const idx = this.cards.findIndex(c => c.id === cardId);
    if (idx === -1) return;

    this.cards[idx] = { ...this.cards[idx], box: 0, nextReviewDate: getTodayString() };
    this.persist([this.cards[idx]]);
  }

  public exportData(): string {
    return JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      cards: this.cards,
      settings: this.settings
    }, null, 2);
  }

  /**
   * Replace all cards (and settings) with a JSON backup. Invalid cards are dropped;
   * the import fails if the file has cards but none of them are valid.
   */
  public importData(jsonString: string): { ok: boolean; imported: number; skipped: number } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !Array.isArray(data.cards)) return { ok: false, imported: 0, skipped: 0 };

      const seen = new Set<string>();
      const valid: LeitnerCard[] = [];
      for (const raw of data.cards) {
        const card = normalizeImportedCard(raw);
        if (card && !seen.has(card.id)) {
          seen.add(card.id);
          valid.push(card);
        }
      }
      if (data.cards.length > 0 && valid.length === 0) {
        return { ok: false, imported: 0, skipped: data.cards.length };
      }

      const removedIds = this.cards.filter(c => !seen.has(c.id)).map(c => c.id);
      this.cards = valid.map(c => this.withCatalogContent(c));
      this.persist(valid, removedIds);

      if (data.settings && typeof data.settings === 'object') {
        this.saveSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      }
      return { ok: true, imported: valid.length, skipped: data.cards.length - valid.length };
    } catch (e) {
      console.error('Import failed', e);
      return { ok: false, imported: 0, skipped: 0 };
    }
  }

  public clearAllCards() {
    const ids = this.cards.map(c => c.id);
    this.cards = [];
    this.persist([], ids);
  }
}

export const leitnerEngine = new LeitnerEngine();
