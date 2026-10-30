/**
 * Pure decision logic and messages for the send-reminders Edge Function (no imports, no Deno APIs).
 * Unit-tested with Node in tests/reminders.test.ts.
 *
 * index.ts contains a generated copy of this file (the Supabase dashboard deploys one file);
 * after editing, run:  python3 scripts/build-edge-function.py
 */

export type Lang = 'fa' | 'en';

export interface Subscription {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  lang: string;
  created_at: string;
  updated_at: string;
}

export interface UserActivity {
  last_seen_at: string | null;
  suspended: boolean;
}

export interface PushState {
  inactivity_count: number;
  last_inactivity_at: string | null;
  /** Leaderboard rank last notified about (or the best rank since); null = not tracked yet */
  overtake_rank: number | null;
  last_overtake_at: string | null;
}

/** The user's place on the all-time leaderboard; null when hidden from it (or suspended) */
export interface Standing {
  rank: number;
  score: number;
}

const HOUR = 3600_000;
const DEFAULT_TZ = 'Asia/Tehran';
const INACTIVE_AFTER = 24 * HOUR;
const MAX_INACTIVITY_REMINDERS = 3;
const QUIET_BEFORE = 10;               // notifications only 10:00–21:00 local time
const QUIET_FROM = 21;
const GAP_BETWEEN_KINDS = 2 * HOUR;    // an overtake and an inactivity reminder are at least this far apart

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Weekday (Sunday = 0), minutes since midnight and ISO date in the given time zone. */
export function localTime(now: Date, tz: string): { weekday: number; minutes: number; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: safeTimeZone(tz), weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(now).map(p => [p.type, p.value])
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return {
    weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    date: `${parts.year}-${parts.month}-${parts.day}`
  };
}

const inQuietHours = (now: Date, tz: string) => {
  const hour = Math.floor(localTime(now, tz).minutes / 60);
  return hour < QUIET_BEFORE || hour >= QUIET_FROM;
};

const within = (iso: string | null | undefined, now: Date, ms: number) =>
  !!iso && now.getTime() - new Date(iso).getTime() < ms;

/**
 * Whether this user should get an inactivity reminder now, and the counter value after sending.
 * `firstSubscribedAt` stands in for activity when the user was never seen (should not happen in practice).
 */
export function inactivityDecision(
  user: UserActivity,
  state: PushState | null,
  timezone: string,
  firstSubscribedAt: string,
  now: Date
): { send: boolean; count: number } {
  if (user.suspended) return { send: false, count: state?.inactivity_count ?? 0 };
  const lastActive = new Date(user.last_seen_at ?? firstSubscribedAt).getTime();
  const lastReminder = state?.last_inactivity_at ? new Date(state.last_inactivity_at).getTime() : null;
  // Came back since the last reminder: a new absence starts from zero
  const count = lastReminder !== null && lastActive > lastReminder ? 0 : state?.inactivity_count ?? 0;
  const t = now.getTime();

  if (t - lastActive <= INACTIVE_AFTER) return { send: false, count };
  if (count >= MAX_INACTIVITY_REMINDERS) return { send: false, count };
  if (lastReminder !== null && lastReminder >= lastActive && t - lastReminder < INACTIVE_AFTER) return { send: false, count };
  if (inQuietHours(now, timezone)) return { send: false, count };
  if (within(state?.last_overtake_at, now, GAP_BETWEEN_KINDS)) return { send: false, count };
  return { send: true, count: count + 1 };
}

/**
 * "Someone passed you on the leaderboard". The baseline is the rank last notified about: it follows
 * improvements silently; when the rank gets worse, notify (at most once per local day, 10:00–21:00,
 * not right after an inactivity reminder). While a notification has to wait, the baseline stays, so it
 * goes out later only if the user is still behind. Users hidden from the leaderboard lose their baseline,
 * so showing up again doesn't count as being passed. Users with no score yet or who turned this
 * notification off just follow along.
 */
export function overtakeDecision(
  standing: Standing | null,
  enabled: boolean,
  state: PushState | null,
  timezone: string,
  now: Date
): { send: boolean; passedBy: number; rank: number; baseline: number | null } {
  const base = state?.overtake_rank ?? null;
  if (!standing) return { send: false, passedBy: 0, rank: 0, baseline: null };
  const { rank, score } = standing;
  const follow = { send: false, passedBy: 0, rank, baseline: rank };
  if (base === null || rank <= base) return follow;
  if (!enabled || score <= 0) return follow;

  const wait = { send: false, passedBy: 0, rank, baseline: base };
  if (inQuietHours(now, timezone)) return wait;
  const last = state?.last_overtake_at;
  if (last && localTime(new Date(last), timezone).date === localTime(now, timezone).date) return wait;
  if (within(state?.last_inactivity_at, now, GAP_BETWEEN_KINDS)) return wait;
  return { send: true, passedBy: rank - base, rank, baseline: rank };
}

export const asLang = (lang: string | null | undefined): Lang => (lang === 'en' ? 'en' : 'fa');

const faDigits = (x: number) => String(x).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

export function overtakePayload(lang: Lang, passedBy: number, rank: number) {
  const title = lang === 'fa'
    ? (passedBy > 1 ? `${faDigits(passedBy)} نفر ازت جلو زدن! 🏁` : 'یک نفر ازت جلو زد! 🏁')
    : (passedBy > 1 ? `${passedBy} people passed you! 🏁` : 'Someone passed you! 🏁');
  const body = lang === 'fa'
    ? `الان رتبه‌ی ${faDigits(rank)} جدول رقابت هستی. با چند مرور کوتاه می‌تونی جایگاهت رو پس بگیری.`
    : `You're now #${rank} on the leaderboard. A few quick reviews can win your place back.`;
  return { title, body, url: '/?go=leaderboard', tag: 'daf-overtake', lang };
}

export function testPayload(lang: Lang) {
  return lang === 'fa'
    ? { title: 'آزمایش اعلان ✅', body: 'اعلان‌های لایتنر روی این دستگاه کار می‌کنند.', url: '/', tag: 'daf-test', lang }
    : { title: 'Test notification ✅', body: 'Leitner notifications work on this device.', url: '/', tag: 'daf-test', lang };
}

export const INACTIVITY_TITLE: Record<Lang, string> = {
  fa: 'مسیرت رو ادامه بده 🌱',
  en: 'Keep going 🌱'
};

/** Same order in both languages: index i is the same line. */
export const QUOTES: Record<Lang, string[]> = {
  fa: [
    'هر کلمه‌ای که امروز مرور کنی، فردا خودش به ذهنت میاد.',
    'لازم نیست زیاد باشه؛ فقط پنج دقیقه مرور کافیه تا زنجیره نشکنه.',
    'یادگیری زبان دوی ماراتنه، نه دوی سرعت. همین امروز یک قدم بردار.',
    'کارت‌هات منتظرت هستن؛ چند دقیقه وقت بذار و به مسیرت برگرد.',
    'فراموش کردن بخشی از یادگیریه؛ مرور یعنی دوباره به دست آوردنش.',
    'هر بار که یک کارت رو درست جواب می‌دی، آلمانی‌ات یک قدم محکم‌تر می‌شه.',
    'آدم‌های موفق انگیزه‌ی بیشتری ندارن؛ عادت بهتری دارن. امروز مرور کن.',
    'یک روز وقفه اشکالی نداره؛ مهم اینه که امروز برگردی.',
    'کلمه‌های امروز، جمله‌های فردای تو هستن.',
    'هر مرور کوتاه، حافظه‌ی بلندمدتت رو قوی‌تر می‌کنه.',
    'یادت هست چرا شروع کردی؟ همون دلیل هنوز ارزشش رو داره.',
    'آهسته رفتن اشکالی نداره؛ متوقف شدن اشکال داره.',
    'جعبه‌ی لایتنرت منتظرته؛ بیا ببینیم امروز چند کارت جلو می‌ره.',
    'هر کارتی که به خانه‌ی بعد می‌ره، یعنی تو پیشرفت کردی.',
    'زبان جدید یعنی دنیای جدید. یک کلمه‌ی دیگه به دنیات اضافه کن.',
    'پنج دقیقه‌ی امروز، از یک ساعت هفته‌ی بعد ارزشمندتره.',
    'نظم از استعداد مهم‌تره. همین حالا چند کارت مرور کن.',
    'Übung macht den Meister؛ تمرین، استاد می‌سازه.',
    'لازم نیست کامل باشی؛ فقط لازمه ادامه بدی.',
    'یک فنجان چای و چند کارت لایتنر؛ ترکیب خوبیه، نه؟',
    'مغزت برای مرور آماده‌ست؛ فقط کافیه اپ رو باز کنی.',
    'هر روز کمی بهتر از دیروز؛ همین برای پیشرفت کافیه.',
    'کلمه‌هایی که امروز مرور نکنی، فردا سخت‌تر برمی‌گردن.',
    'تو تا این‌جا اومدی؛ حیفه که الان متوقف بشی.',
    'یک قدم کوچک امروز، فاصله‌ی بزرگی رو در آینده می‌سازه.',
    'Schritt für Schritt؛ قدم به قدم، با هم ادامه بدیم.',
    'امروز روز خوبیه برای اینکه چند کارت رو به تسلط کامل نزدیک‌تر کنی.',
    'یادگیری وقتی می‌مونه که تکرار بشه. بیا دوباره مرور کنیم.',
    'حتی دو دقیقه هم حساب می‌شه. شروع کن، بقیه‌اش راحت‌تره.',
    'آلمانی‌ات منتظر توئه، نه برعکس. بیا ادامه بدیم!'
  ],
  en: [
    'Every word you review today will come back to you more easily tomorrow.',
    "It doesn't have to be much: five minutes of review keeps the chain unbroken.",
    'Learning a language is a marathon, not a sprint. Take one step today.',
    'Your cards are waiting for you. Spend a few minutes and get back on track.',
    'Forgetting is part of learning; reviewing is how you win it back.',
    'Every card you answer correctly makes your German a little stronger.',
    "Successful learners don't have more motivation, they have better habits. Review today.",
    "Missing a day is fine. What matters is coming back today.",
    "Today's words are tomorrow's sentences.",
    'Every short review strengthens your long-term memory.',
    'Remember why you started? That reason is still worth it.',
    "Going slowly is fine; stopping isn't.",
    "Your Leitner box is waiting. Let's see how many cards move forward today.",
    'Every card that moves to the next box is proof of your progress.',
    'A new language opens a new world. Add one more word to yours.',
    "Five minutes today beat an hour next week.",
    'Consistency beats talent. Review a few cards right now.',
    'Übung macht den Meister: practice makes perfect.',
    "You don't have to be perfect, you just have to keep going.",
    'A cup of tea and a few Leitner cards: a good combination, right?',
    'Your brain is ready to review; all it takes is opening the app.',
    "A little better than yesterday, every day. That's all progress needs.",
    "Words you don't review today are harder to bring back tomorrow.",
    "You've come this far; it would be a shame to stop now.",
    'A small step today builds a long way tomorrow.',
    "Schritt für Schritt: step by step, let's keep going.",
    'Today is a good day to bring a few cards closer to mastery.',
    "Learning sticks when it's repeated. Let's review again.",
    'Even two minutes count. Start, and the rest gets easier.',
    "Your German is waiting for you. Let's keep going!"
  ]
};

/** `index` picks the quote; the lists are aligned, so every device gets the same line in its own language. */
export function inactivityPayload(lang: Lang, index: number) {
  const quotes = QUOTES[lang];
  return { title: INACTIVITY_TITLE[lang], body: quotes[index % quotes.length], url: '/?go=review', tag: 'daf-inactive', lang };
}
