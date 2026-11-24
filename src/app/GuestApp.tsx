/**
 * Signed out: visitors land on Stories and can read without an account (the first story of every book, word
 * meanings, the quiz). Anything more — the next story, saving a word, the rest of the app — asks them to sign in
 * (SignInPrompt). Guest progress stays on this device (StoriesProgressStore with GUEST_ID) and moves into the account
 * after sign-in. If the Stories kill switch is off, the sign-in screen is shown as before.
 */
import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { Button } from '../shared/ui';
import { LanguageSwitch } from '../shared/ui/LanguageSwitch';
import { FullScreenLoader } from '../shared/ui/FullScreenLoader';
import { leitnerEngine } from '../core/leitnerEngine';
import { LoginScreen } from '../features/auth/LoginScreen';
import { SignInPrompt, type SignInReason } from '../features/auth/SignInPrompt';
import { storiesEnabled } from '../features/stories/flag';
import { GUEST_ID } from '../features/stories/storiesSync';
import { AppFooter } from './AppFooter';

const StoriesScreen = lazy(() => import('../features/stories/StoriesScreen'));
const noop = () => {};

export const GuestApp: React.FC<{ onDemoSignIn?: () => void }> = ({ onDemoSignIn }) => {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState<SignInReason | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    let live = true;
    void storiesEnabled().then(on => { if (live) setEnabled(on); });
    // Word meanings come from the bundled word list; no account needed
    void leitnerEngine.loadCatalog().catch(() => {});
    return () => { live = false; };
  }, []);
  const requireSignIn = useCallback((reason: SignInReason) => setPrompt(reason), []);

  if (enabled === null) return <FullScreenLoader text={t.stories.loading} />;
  if (!enabled) return <LoginScreen />;

  return (
    <div className={`min-h-screen flex flex-col ${reading ? 'story-reading-shell' : 'story-library-shell'}`} data-testid="guest-app">
      {!reading && (
        <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800" role="banner">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-9 h-9 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm" aria-hidden>L</span>
              <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate">
                <span className="sm:hidden">{t.app.shortName}</span><span className="hidden sm:inline">{t.app.name}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LanguageSwitch compact />
              <Button size="sm" data-testid="guest-sign-in" icon={<LogIn className="w-4 h-4 rtl:-scale-x-100" />} onClick={() => setPrompt('general')}>{t.guest.signIn}</Button>
            </div>
          </div>
        </header>
      )}
      <main tabIndex={-1} className={reading ? 'flex-1 w-full' : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8'}>
        {!reading && <p className="mb-6 text-sm text-ink-soft max-w-2xl" data-testid="guest-note">{t.guest.reading}</p>}
        <Suspense fallback={<p className="text-center py-16 text-slate-500" role="status">{t.stories.loading}</p>}>
          <StoriesScreen guest={{ onRequireSignIn: requireSignIn }} userId={GUEST_ID} cards={[]} onCardsChanged={noop} onAddCard={noop} onReadingChange={setReading} />
        </Suspense>
      </main>
      {!reading && <AppFooter />}
      {prompt && <SignInPrompt reason={prompt} onClose={() => setPrompt(null)} onDemoSignIn={onDemoSignIn} />}
    </div>
  );
};
