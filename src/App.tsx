import React, { useState, useEffect, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { LeitnerCard, AppSettings, UserProfile } from './types/leitner';
import { leitnerEngine, getTodayString, isCardDue } from './services/leitnerEngine';
import { cloudSync, SyncStatus, touchPresence } from './services/cloudSync';
import { soundService } from './services/soundService';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { isDemoMode, DEMO_USER } from './lib/demo';
import { Navbar, ActiveTab } from './components/Navbar';
import { LeitnerDashboard } from './components/LeitnerDashboard';
import { ReviewSession } from './components/ReviewSession';
import { VocabCatalog } from './components/VocabCatalog';
import { ReflectionManager } from './components/ReflectionManager';
import { SettingsBackupModal } from './components/SettingsBackupModal';
import { NewCardModal } from './components/NewCardModal';
import { NewWordsStudySession } from './components/NewWordsStudySession';
import { Leaderboard } from './components/Leaderboard';
import { LoginScreen, SetupRequired, SuspendedScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { Loader2, WifiOff } from 'lucide-react';
import { useI18n } from './i18n/I18nProvider';
import { DEFAULT_LANG } from './i18n/format';
import { Credit } from './components/ui/Credit';
import { refreshPush, disablePush } from './services/pwa';

// Where a tapped reminder wants to go ("?go=learn" / "?go=review"), read before the URL is cleaned up
const initialGo = new URLSearchParams(window.location.search).get('go');

const PRESENCE_INTERVAL_MS = 5 * 60 * 1000;

const FullScreenLoader: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-600 dark:text-slate-400">
    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    <span className="text-sm font-medium px-4 text-center">{text}</span>
    <Credit className="absolute bottom-6 inset-x-0 px-6 max-w-md mx-auto" />
  </div>
);

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

function LeitnerApp({ user }: { user: User }) {
  const { t, lang, setLang } = useI18n();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [cards, setCards] = useState<LeitnerCard[]>([]);
  const [catalog, setCatalog] = useState<LeitnerCard[]>([]);
  const [settings, setSettings] = useState<AppSettings>(leitnerEngine.getSettings());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadedOffline, setLoadedOffline] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState<boolean>(false);
  const [reviewFilterBox, setReviewFilterBox] = useState<number | undefined>(undefined);
  const [reviewNounsOnly, setReviewNounsOnly] = useState<boolean>(false);
  const [reviewSessionKey, setReviewSessionKey] = useState(0);
  const [isStudyingNewWords, setIsStudyingNewWords] = useState<boolean>(false);

  const refreshState = () => {
    setCards([...leitnerEngine.getCards()]);
    setCatalog([...leitnerEngine.getCatalog()]);
    setSettings(leitnerEngine.getSettings());
  };

  useEffect(() => {
    let cancelled = false;
    cloudSync.start(user).then(({ profile: p, offline }) => {
      if (cancelled) return;
      setProfile(p);
      setLoadedOffline(offline);
      refreshState();
    });
    const unsubscribe = cloudSync.onStatus(setSyncStatus);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Record presence (shown to the admin as "last seen") and notice a suspension mid-session
  const ready = profile !== null && !profile.suspended;
  useEffect(() => {
    if (!ready) return;
    let stopped = false;
    const ping = () => {
      if (stopped || document.visibilityState !== 'visible') return;
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
  }, [ready]);

  // The sound toggle used to reset to "on" after every reload
  useEffect(() => {
    soundService.enabled = settings.soundEnabled;
  }, [settings.soundEnabled]);

  const todayStr = getTodayString();
  const dueCards = cards.filter(c => isCardDue(c, todayStr));

  const cardsToReview = reviewFilterBox !== undefined
    ? dueCards.filter(c => c.box === reviewFilterBox)
    : dueCards;

  const handleStartReview = (boxFilter?: number, nounsOnly?: boolean) => {
    setReviewFilterBox(boxFilter);
    setReviewNounsOnly(!!nounsOnly);
    setReviewSessionKey(k => k + 1);
    setIsStudyingNewWords(false);
    setActiveTab('review');
  };

  const handleAddCard = (cardData: Partial<LeitnerCard>) => {
    leitnerEngine.addCard(cardData);
    refreshState();
  };

  const handleBatchAddWords = (words: LeitnerCard[]) => {
    leitnerEngine.addBatchWords(words);
    refreshState();
  };

  const handleDeleteCard = (cardId: string) => {
    leitnerEngine.deleteCard(cardId);
    refreshState();
  };

  const handleUpdateCard = (cardId: string, updates: Partial<LeitnerCard>) => {
    leitnerEngine.updateCard(cardId, updates);
    refreshState();
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    leitnerEngine.saveSettings(newSettings);
    refreshState();
  };

  // Apply the language saved in the account once it's loaded, then save the user's later choices to it.
  // Accounts that never picked a language store nothing, so existing settings rows stay untouched.
  const languageApplied = useRef(false);
  useEffect(() => {
    if (!profile || profile.suspended) return;
    if (!languageApplied.current) {
      languageApplied.current = true;
      if (settings.language && settings.language !== lang) {
        setLang(settings.language);
        return;
      }
    }
    if (lang !== (settings.language ?? DEFAULT_LANG)) handleUpdateSettings({ language: lang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, lang]);

  // Keep this device's reminder subscription current (time zone, language)
  useEffect(() => {
    if (profile && !profile.suspended) refreshPush(lang);
  }, [profile, lang]);

  // Open the screen a tapped reminder points to
  const goHandled = useRef(false);
  useEffect(() => {
    if (!profile || goHandled.current) return;
    goHandled.current = true;
    if (initialGo === 'learn') setIsStudyingNewWords(true);
    else if (initialGo === 'review') handleStartReview();
    if (initialGo) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const handleSignOut = async () => {
    // The next person signing in on this device must not get this user's reminders
    await disablePush().catch(() => undefined);
    await cloudSync.stop();
    await supabase?.auth.signOut();
  };

  if (!profile) {
    return <FullScreenLoader text={t.app.preparing} />;
  }

  if (profile.suspended) {
    return <SuspendedScreen email={profile.email} onSignOut={() => supabase!.auth.signOut()} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col selection:bg-amber-100 selection:text-amber-900">

      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'review') {
            handleStartReview();
            return;
          }
          setIsStudyingNewWords(false);
          setActiveTab(tab);
        }}
        dueTodayCount={dueCards.length}
        onOpenNewCardModal={() => setIsNewCardModalOpen(true)}
        profile={profile}
        syncStatus={syncStatus}
      />

      {loadedOffline && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>{t.app.offlineBanner}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {isStudyingNewWords ? (
          <NewWordsStudySession
            onFinish={() => {
              setIsStudyingNewWords(false);
              setActiveTab('dashboard');
            }}
            onCardAdded={refreshState}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <LeitnerDashboard
                cards={cards}
                onStartReview={handleStartReview}
                onStartNewWordsLearning={() => setIsStudyingNewWords(true)}
                onNavigateToCatalog={() => setActiveTab('catalog')}
                onNavigateToReflections={() => setActiveTab('reflections')}
                onOpenNewCardModal={() => setIsNewCardModalOpen(true)}
                onOpenSettings={() => {
                  setActiveTab('settings');
                  setTimeout(() => document.getElementById('app-install')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                }}
              />
            )}

            {activeTab === 'review' && (
              <ReviewSession
                key={reviewSessionKey}
                initialCards={cardsToReview}
                allCards={cards}
                initialNounsOnly={reviewNounsOnly}
                onFinishSession={() => {
                  setReviewFilterBox(undefined);
                  setReviewNounsOnly(false);
                  setActiveTab('dashboard');
                }}
                onStartNewWordsLearning={() => {
                  setReviewFilterBox(undefined);
                  setReviewNounsOnly(false);
                  setIsStudyingNewWords(true);
                }}
                onCardUpdated={refreshState}
              />
            )}

            {activeTab === 'catalog' && (
              <VocabCatalog
                catalogWords={catalog}
                activeCards={cards}
                onAddWordToLeitner={handleAddCard}
                onBatchAddWords={handleBatchAddWords}
              />
            )}

            {activeTab === 'reflections' && (
              <ReflectionManager
                cards={cards}
                onAddCard={handleAddCard}
                onDeleteCard={handleDeleteCard}
                onUpdateCard={handleUpdateCard}
                onStartReview={() => handleStartReview()}
              />
            )}

            {activeTab === 'leaderboard' && (
              <Leaderboard profile={profile} onOpenSettings={() => setActiveTab('settings')} />
            )}

            {activeTab === 'admin' && profile.isAdmin && <AdminPanel profile={profile} />}

            {activeTab === 'settings' && (
              <SettingsBackupModal
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                cards={cards}
                onDataImported={refreshState}
                profile={profile}
                onProfileChange={setProfile}
                onSignOut={handleSignOut}
              />
            )}
          </>
        )}
      </main>

      <NewCardModal
        isOpen={isNewCardModalOpen}
        onClose={() => setIsNewCardModalOpen(false)}
        onAddCard={handleAddCard}
      />

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-6 text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center md:justify-between gap-3 text-center md:text-start">
          <div className="dot-list flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span className="font-bold text-slate-800 dark:text-slate-200">{t.app.footerName}</span>
            <span>{t.app.footerBook}</span>
          </div>
          <div className="dot-list flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>{t.app.footerFormula}</span>
            <span>{t.app.footerDrop}</span>
            <span>{t.app.footerCloud}</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
