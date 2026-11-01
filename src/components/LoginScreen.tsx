import React, { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { signInWithGoogle } from '../lib/supabase';
import { useI18n } from '../i18n/I18nProvider';
import { LanguageSwitch } from './ui/LanguageSwitch';
import { Ltr } from './ui/Text';
import { Credit } from './ui/Credit';
import { Onboarding } from './onboarding/Onboarding';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

/** Shown when the user isn't signed in: a Telegram-style onboarding carousel with the sign-in button always at the bottom. */
export const LoginScreen: React.FC = () => {
  const { t } = useI18n();
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
    <div className="relative min-h-dvh bg-slate-50 dark:bg-slate-950 flex flex-col items-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">L</span>
          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{t.app.name}</span>
        </div>
        <LanguageSwitch compact />
      </div>

      <Onboarding />

      <div className="w-full max-w-md space-y-3">
        <button
          onClick={handleLogin}
          disabled={isRedirecting}
          data-testid="google-sign-in"
          className="w-full flex items-center justify-center gap-3 py-3.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-semibold text-sm shadow-md shadow-indigo-600/20 transition-colors disabled:opacity-70"
        >
          <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
            {isRedirecting ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <GoogleIcon />}
          </span>
          <span>{t.login.google}</span>
        </button>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-start gap-2 text-start">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t.login.failed(error)}</span>
          </div>
        )}

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <a href="/privacy.html" className="underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200">{t.login.privacy}</a>
        </p>
        <Credit className="px-2" />
      </div>
    </div>
  );
};

/** Shown when the admin has temporarily suspended this account. */
export const SuspendedScreen: React.FC<{ email: string | null; onSignOut: () => void }> = ({ email, onSignOut }) => {
  const { t } = useI18n();
  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-3xl p-8 space-y-5 text-center">
      <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
      <div className="space-y-2">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t.login.suspendedTitle}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {t.login.suspendedBody}
        </p>
        {email && <Ltr as="div" className="text-xs text-slate-500 dark:text-slate-400">{email}</Ltr>}
      </div>
      <button
        onClick={onSignOut}
        className="w-full py-3 px-5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl font-semibold text-sm transition-colors"
      >
        {t.login.suspendedSignOut}
      </button>
    </div>
  </div>
  );
};

/** Shown when the build has no Supabase env vars. */
export const SetupRequired: React.FC = () => {
  const { t } = useI18n();
  return (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
    <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-3xl p-8 space-y-4 text-start">
      <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        {t.login.setupTitle}
      </h1>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {t.login.setupBefore} <Ltr as="code" className="font-mono-num">VITE_SUPABASE_URL</Ltr> {t.login.setupAnd}{' '}
        <Ltr as="code" className="font-mono-num">VITE_SUPABASE_ANON_KEY</Ltr> {t.login.setupAfter}
      </p>
    </div>
  </div>
  );
};
