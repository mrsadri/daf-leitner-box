/**
 * Side effects that run while a user is signed in (and not suspended):
 *   presence ping (admin "last seen", notices a suspension mid-session), silver-card counter, the sound switch,
 *   the account's interface language, and this device's push subscription.
 */
import { useEffect, useRef } from 'react';
import type { AppSettings, UserProfile } from '../core/types';
import { cloudSync, touchPresence } from '../core/cloudSync';
import { soundService } from '../shared/lib/soundService';
import { refreshSilver, startSilver } from '../features/silver/silver';
import { flushQueue as flushDrill } from '../features/adjective/drillSync';
import { refreshPush } from '../features/settings/pwa';
import { useI18n } from '../i18n/I18nProvider';
import { DEFAULT_LANG } from '../i18n/format';

const PRESENCE_INTERVAL_MS = 5 * 60 * 1000;

export function useSessionEffects({ userId, profile, settings, setProfile, updateSettings }: {
  userId: string;
  profile: UserProfile | null;
  settings: AppSettings;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  updateSettings: (s: Partial<AppSettings>) => void;
}) {
  const { lang, setLang } = useI18n();
  const ready = profile !== null && !profile.suspended;

  // Presence, and a suspension noticed mid-session
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    const ping = () => {
      if (stopped || !userId || document.visibilityState !== 'visible') return;
      touchPresence()
        .then(suspended => {
          if (!suspended || stopped) return;
          stopped = true;
          cloudSync.stop().finally(() => setProfile(p => (p ? { ...p, suspended: true } : p)));
        })
        .catch(() => { /* offline or schema not updated yet */ });
    };
    ping();
    const interval = setInterval(ping, PRESENCE_INTERVAL_MS);
    document.addEventListener('visibilitychange', ping);
    return () => {
      stopped = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', ping);
    };
  }, [ready, setProfile, userId]);

  useEffect(() => {
    if (!ready) return;
    const retry = () => { if (document.visibilityState === 'visible') void flushDrill(userId).catch(() => {}); };
    retry();
    window.addEventListener('online', retry); document.addEventListener('visibilitychange', retry);
    const timer = setInterval(retry, 15000);
    return () => { clearInterval(timer); window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); };
  }, [ready,userId]);

  // Silver cards: this device's running count, brought up to date with the server
  useEffect(() => {
    if (!ready) return;
    void startSilver(userId);
    return cloudSync.onStatus(status => { if (status === 'idle') void refreshSilver(); });
  }, [ready, userId]);

  // The sound toggle used to reset to "on" after every reload
  useEffect(() => {
    soundService.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  // Apply the language saved in the account once it's loaded, then save the user's later choices to it.
  // Accounts that never picked a language store nothing, so existing settings rows stay untouched.
  const languageApplied = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!languageApplied.current) {
      languageApplied.current = true;
      if (settings.language && settings.language !== lang) {
        setLang(settings.language);
        return;
      }
    }
    if (lang !== (settings.language ?? DEFAULT_LANG)) updateSettings({ language: lang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, lang]);

  // Keep this device's reminder subscription current (time zone, language)
  useEffect(() => {
    if (ready) refreshPush(lang);
  }, [ready, lang]);

  return { ready };
}
