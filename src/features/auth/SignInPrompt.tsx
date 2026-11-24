/**
 * "Sign in to continue": asked of a guest reader when they want more than a first story (the next story, saving a
 * word, the rest of the app). Google sign-in keeps the reading place (returnTo.ts); the guest's progress is carried
 * into the account afterwards (importGuestProgress).
 */
import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Dialog, Button } from '../../shared/ui';
import { useI18n } from '../../i18n/I18nProvider';
import { signInWithGoogle } from '../../shared/lib/supabase';
import { saveReturnTo } from './returnTo';

export type SignInReason = 'next' | 'word' | 'general';

export const SignInPrompt: React.FC<{ reason: SignInReason; onClose: () => void; onDemoSignIn?: () => void }> = ({ reason, onClose, onDemoSignIn }) => {
  const { t } = useI18n();
  const g = t.guest;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = reason === 'next' ? g.reasonNext : reason === 'word' ? g.reasonWord : g.reasonGeneral;

  const signIn = async () => {
    if (onDemoSignIn) { onDemoSignIn(); return; }
    setError(null);
    setBusy(true);
    saveReturnTo();
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      onClose={onClose}
      dismissable={!busy}
      size="sm"
      testId="sign-in-prompt"
      title={g.promptTitle}
      description={text}
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={busy}>{g.notNow}</Button>
        <Button data-autofocus data-testid="prompt-google" onClick={signIn} disabled={busy}
          icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}>{t.login.google}</Button>
      </>}
    >
      <p className="text-sm">{g.keepsProgress}</p>
      {error && (
        <p className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />{t.login.failed(error)}
        </p>
      )}
      <p className="text-xs"><a href="/privacy.html" className="underline underline-offset-2">{t.login.privacy}</a></p>
    </Dialog>
  );
};
