/**
 * Entry component: demo mode, missing configuration, or the app.
 *
 *   App -> AuthGate (Supabase session) -> LeitnerApp (one user's data; keyed by user id)
 *                                      -> GuestApp (signed out: Stories without an account, then "sign in to continue")
 *
 * Demo mode (src/shared/lib/demo.ts) skips sign-in and Supabase entirely; ?guest=1 shows the guest view there.
 */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { subscribeSession } from '../core/sessionSubscription';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../shared/lib/supabase';
import { isDemoMode, DEMO_USER } from '../shared/lib/demo';
import { SetupRequired } from '../features/auth/LoginScreen';
import { restoreReturnTo } from '../features/auth/returnTo';
import { GuestApp } from './GuestApp';
import { useI18n } from '../i18n/I18nProvider';
import { RecoveryMessage } from '../shared/ui/RecoveryBoundary';
import { FullScreenLoader } from '../shared/ui/FullScreenLoader';
import { LeitnerApp } from './LeitnerApp';

// Design-system gallery (?gallery=1): development and demo builds only. The condition is written out here so the
// production build drops the import entirely.
const Gallery = (import.meta.env.DEV || import.meta.env.MODE === 'demo') && new URLSearchParams(window.location.search).get('gallery') === '1'
  ? lazy(() => import('../shared/ui/Gallery'))
  : null;

export default function App() {
  if (Gallery) return <Suspense fallback={null}><Gallery /></Suspense>;
  if (isDemoMode) return new URLSearchParams(window.location.search).get('guest') === '1'
    ? <GuestApp onDemoSignIn={demoSignIn} />
    : <LeitnerApp user={DEMO_USER} />;
  if (!isSupabaseConfigured) return <SetupRequired />;
  return <AuthGate />;
}

/** Demo builds have no sign-in: "Sign in" in the guest view opens the demo account at the same place. */
function demoSignIn() {
  const url = new URL(window.location.href);
  url.searchParams.delete('guest');
  url.searchParams.set('go', 'stories');
  window.location.assign(url.href);
}

function AuthGate() {
  const { t } = useI18n();
  // undefined = still checking the stored session
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    return subscribeSession<Session>({
      load:async()=>{
        const {data,error}=await supabase!.auth.getSession();
        if(error)throw error;
        return data.session;
      },
      listen:callback=>{
        const {data:{subscription}}=supabase!.auth.onAuthStateChange((_event,nextSession)=>callback(nextSession));
        return ()=>subscription.unsubscribe();
      },
      // Signed in after reading as a guest: back to the story they were on (before the app reads the address)
      onSession:nextSession=>{if(nextSession)restoreReturnTo();setFailed(false);setSession(nextSession);},
      onError:()=>setFailed(true),
    });
  // eslint-disable-next-line react/exhaustive-effect-dependencies -- The explicit retry token deliberately resubscribes and reloads Auth state.
  }, [attempt]);

  useEffect(() => {
    // Remove ?code=… / ?error=… left by the OAuth redirect once the session is established
    if (session && window.location.search) {
      const url = new URL(window.location.href);
      for (const key of ['code', 'error', 'error_description', 'error_code']) url.searchParams.delete(key);
      window.history.replaceState(null, '', url);
    }
  }, [session]);

  if (failed) return <RecoveryMessage onRetry={() => { setFailed(false); setAttempt(a => a + 1); }} />;
  if (session === undefined) return <FullScreenLoader text={t.app.checkingSignIn} />;
  if (!session) return <GuestApp />;
  // Keyed by user id so switching accounts starts from a clean state
  return <LeitnerApp key={session.user.id} user={session.user} />;
}
