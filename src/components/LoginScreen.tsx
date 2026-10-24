import React, { useState } from 'react';
import { Loader2, AlertTriangle, Trophy, Cloud, BookOpen } from 'lucide-react';
import { signInWithGoogle } from '../lib/supabase';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

/** Shown when the user isn't signed in. */
export const LoginScreen: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const urlError = params.get('error_description') || params.get('error');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(urlError);

  const handleLogin = async () => {
    setError(null);
    setIsRedirecting(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : String(e));
      setIsRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm space-y-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
          L
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">لایتنر هوشمند DaF & Mind</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            واژگان کتاب DaF kompakt را با جعبه لایتنر تمرین کنید، پیشرفت‌تان را ببینید و با دیگران رقابت کنید.
          </p>
        </div>

        <ul className="text-right text-xs text-slate-700 dark:text-slate-300 space-y-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
          <li className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600 shrink-0" /> بیش از ۳۴۰۰ واژه A1 تا B1 با آرتیکل، جمع و مثال</li>
          <li className="flex items-center gap-2"><Cloud className="w-4 h-4 text-indigo-600 shrink-0" /> ذخیره پیشرفت در حساب شما و همگام‌سازی بین دستگاه‌ها</li>
          <li className="flex items-center gap-2"><Trophy className="w-4 h-4 text-amber-500 shrink-0" /> جدول رقابت کلی و هفتگی</li>
        </ul>

        <button
          onClick={handleLogin}
          disabled={isRedirecting}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-5 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-semibold text-sm shadow-xs transition-colors disabled:opacity-60"
        >
          {isRedirecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleIcon />}
          <span>ورود با حساب گوگل</span>
        </button>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2 text-right">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>ورود ناموفق بود: {error}</span>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <a href="/privacy.html" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">حریم خصوصی</a>
        </p>
      </div>
    </div>
  );
};

/** Shown when the admin has temporarily suspended this account. */
export const SuspendedScreen: React.FC<{ email: string | null; onSignOut: () => void }> = ({ email, onSignOut }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-3xl p-8 space-y-5 text-center">
      <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">حساب شما موقتاً غیرفعال شده است</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          اطلاعات و پیشرفت شما محفوظ است و پس از فعال‌شدن دوباره حساب، همه‌چیز سر جایش خواهد بود.
        </p>
        {email && <p className="text-xs text-slate-500 dark:text-slate-400 dir-ltr">{email}</p>}
      </div>
      <button
        onClick={onSignOut}
        className="w-full py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-semibold text-sm transition-colors"
      >
        خروج و ورود با حساب دیگر
      </button>
    </div>
  </div>
);

/** Shown when the build has no Supabase env vars. */
export const SetupRequired: React.FC = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
    <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-3xl p-8 space-y-4 text-right">
      <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        تنظیمات Supabase پیدا نشد
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        متغیرهای محیطی <code className="dir-ltr font-mono-num">VITE_SUPABASE_URL</code> و{' '}
        <code className="dir-ltr font-mono-num">VITE_SUPABASE_ANON_KEY</code> را در فایل <code>.env.local</code> (برای اجرای محلی)
        یا در تنظیمات پروژه Vercel تعریف کنید و دوباره build بگیرید. راهنمای کامل در README آمده است.
      </p>
    </div>
  </div>
);
