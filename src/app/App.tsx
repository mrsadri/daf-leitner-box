/**
 * Entry component: demo mode, missing configuration, or the signed-in app.
 *
 *   App -> AuthGate (Supabase session) -> LeitnerApp (one user's data; keyed by user id)
 *
 * Demo mode (src/shared/lib/demo.ts) skips sign-in and Supabase entirely.
 */
import React, { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../shared/lib/supabase';
import { isDemoMode, DEMO_USER } from '../shared/lib/demo';
import { LoginScreen, SetupRequired } from '../features/auth/LoginScreen';
import { useI18n } from '../i18n/I18nProvider';
import { FullScreenLoader } from '../shared/ui/FullScreenLoader';
import { LeitnerApp } from './LeitnerApp';

export default function App() {
  if (isDemoMode) return <LeitnerApp user={DEMO_USER} />;
  if (!isSupabaseConfigured) return <SetupRequired />;
  return <AuthGate />;
}

function AuthGate() {
  const { t } = useI18n();
  // undefined = still checking the stored session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase!.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Remove ?code=… / ?error=… left by the OAuth redirect once the session is established
    if (session && window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [session]);

  if (session === undefined) return <FullScreenLoader text={t.app.checkingSignIn} />;
  if (!session) return <LoginScreen />;
  // Keyed by user id so switching accounts starts from a clean state
  return <LeitnerApp key={session.user.id} user={session.user} />;
}
