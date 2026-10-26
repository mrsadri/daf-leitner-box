import type { User } from '@supabase/supabase-js';
import { LeitnerCard } from '../types/leitner';
import { toLocalDateString } from '../services/dates';

/**
 * Local demo mode for development: skips Google sign-in and Supabase entirely and runs on sample data
 * kept in localStorage. Enabled with `VITE_DEMO_MODE=1 npm run dev`. `import.meta.env.DEV` is false in
 * production builds, so this is always off (and tree-shaken) in the deployed app.
 */
export const isDemoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === '1';

export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@example.com',
  user_metadata: { full_name: 'Demo' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString()
} as unknown as User;

/** A spread of catalog words across all boxes, a third of them due today, plus a few reflection cards. */
export function buildDemoCards(catalog: LeitnerCard[]): LeitnerCard[] {
  const today = new Date();
  const day = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return toLocalDateString(d);
  };
  // Include the long and punctuated words that broke the layout
  const picks = catalog.filter(w => /Wohngemeinschaft|^Wie\?|Name$/.test(w.wort || ''));
  const rest = catalog.filter(w => !picks.includes(w)).filter((_, i) => i % 23 === 0).slice(0, 120);
  const vocab = [...picks, ...rest].map((w, i): LeitnerCard => {
    const box = i % 7;
    return {
      ...w,
      box,
      nextReviewDate: box === 6 ? '9999-12-31' : i % 3 === 0 ? day(0) : day(1 + (i % 9)),
      lastReviewedAt: i % 2 ? new Date(today.getTime() - 86400000).toISOString() : null,
      reviewCount: box * 2,
      correctCount: box * 2,
      wrongCount: i % 4 === 0 ? 1 : 0
    };
  });
  const reflection = (id: string, title: string, content: string, category: LeitnerCard['category']): LeitnerCard => ({
    id, type: 'reflection', box: 1, nextReviewDate: day(0), lastReviewedAt: null,
    createdAt: today.toISOString(), reviewCount: 0, correctCount: 0, wrongCount: 0, title, content, category
  });
  return [
    ...vocab,
    reflection('demo_r1', 'هر روز ۲۰ دقیقه آلمانی', 'قبل از باز کردن گوشی، اول مرور لایتنر را انجام می‌دهم.', 'habit'),
    reflection('demo_r2', 'Start before you feel ready', 'Small steps every day beat a perfect plan that never starts.', 'motivation')
  ];
}
