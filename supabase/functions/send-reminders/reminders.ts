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
  last_class_reminder_on: string | null;
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
  last_class_at: string | null;
}

const HOUR = 3600_000;
const DEFAULT_TZ = 'Asia/Tehran';
// Saturday to Wednesday (JS: Sunday = 0)
const CLASS_DAYS = new Set([6, 0, 1, 2, 3]);
const CLASS_FROM = 9 * 60 + 30;
const CLASS_UNTIL = 10 * 60;           // exclusive: the 09:30 / 09:45 runs (or a late one) catch it
const INACTIVE_AFTER = 24 * HOUR;
const MAX_INACTIVITY_REMINDERS = 3;
const QUIET_BEFORE = 10;               // inactivity reminders only 10:00–21:00 local time
const QUIET_FROM = 21;
const AFTER_CLASS_GAP = 2 * HOUR;

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

export function isClassReminderDue(sub: Pick<Subscription, 'timezone' | 'last_class_reminder_on'>, now: Date): boolean {
  const t = localTime(now, sub.timezone);
  return CLASS_DAYS.has(t.weekday) && t.minutes >= CLASS_FROM && t.minutes < CLASS_UNTIL && sub.last_class_reminder_on !== t.date;
}

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
  const hour = Math.floor(localTime(now, timezone).minutes / 60);
  if (hour < QUIET_BEFORE || hour >= QUIET_FROM) return { send: false, count };
  if (state?.last_class_at && t - new Date(state.last_class_at).getTime() < AFTER_CLASS_GAP) return { send: false, count };
  return { send: true, count: count + 1 };
}

export const asLang = (lang: string | null | undefined): Lang => (lang === 'en' ? 'en' : 'fa');

export const CLASS_MESSAGE: Record<Lang, { title: string; body: string }> = {
  fa: {
    title: 'وقت استراحت بین کلاس ☕',
    body: 'امیدوارم کلاس تا این‌جا خوب بوده باشه! الان فرصت خوبیه که توی این نیم ساعت بین کلاس بیای و کلمات جدید یاد بگیری.'
  },
  en: {
    title: 'Class break ☕',
    body: 'I hope class has gone well so far! This half-hour break is a great moment to come in and learn some new words.'
  }
};

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

export function classPayload(lang: Lang) {
  return { ...CLASS_MESSAGE[lang], url: '/?go=learn', tag: 'daf-class', lang };
}

/** `index` picks the quote; the lists are aligned, so every device gets the same line in its own language. */
export function inactivityPayload(lang: Lang, index: number) {
  const quotes = QUOTES[lang];
  return { title: INACTIVITY_TITLE[lang], body: quotes[index % quotes.length], url: '/?go=review', tag: 'daf-inactive', lang };
}
