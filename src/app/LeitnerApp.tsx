/**
 * The signed-in app: navigation, the active screen, and the dialogs that can open over any screen.
 *
 * Data and changes come from useLeitnerData; start-up side effects from useSessionEffects. Screens get plain
 * props and callbacks, so each one can be read on its own. Deep links (?go=…) come from push notifications.
 */
import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { WifiOff } from 'lucide-react';
import { getTodayString, isCardDue } from '../core/leitnerEngine';
import { cloudSync } from '../core/cloudSync';
import { supabase } from '../shared/lib/supabase';
import { useI18n } from '../i18n/I18nProvider';
import { FullScreenLoader } from '../shared/ui/FullScreenLoader';
import { Navbar, type ActiveTab } from './Navbar';
import { AppFooter } from './AppFooter';
import { useLeitnerData } from './useLeitnerData';
import { useSessionEffects } from './useSessionEffects';
import { LeitnerDashboard } from '../features/dashboard/LeitnerDashboard';
import { OverdueNotice } from '../features/dashboard/OverdueNotice';
import { fetchUnseenOverdueMoves, markOverdueMovesSeen } from '../features/dashboard/overdue';
import type { OverdueMove } from '../features/dashboard/overdueSummary';
import { ReviewSession } from '../features/review/ReviewSession';
import { NewWordsStudySession } from '../features/learn/NewWordsStudySession';
import { VocabCatalog, MY_CARDS } from '../features/vocab/VocabCatalog';
import { NewCardModal } from '../features/vocab/NewCardModal';
import { Leaderboard } from '../features/leaderboard/Leaderboard';
import { SettingsBackupModal } from '../features/settings/SettingsBackupModal';
import { disablePush } from '../features/settings/pwa';
import { AdminPanel } from '../features/admin/AdminPanel';
import { SuspendedScreen } from '../features/auth/LoginScreen';
import { refreshSilver } from '../features/silver/silver';
import { storiesEnabled } from '../features/stories/flag';

// Stories are a separate chunk (the reader and its content load only when opened)
const StoriesScreen = lazy(() => import('../features/stories/StoriesScreen'));

// Where a tapped notification wants to go ("?go=learn" / "review" / "leaderboard" / "stories"; "dictation" is the old
// name of Stories), read before the URL is cleaned up
const initialGo = new URLSearchParams(window.location.search).get('go');

export function LeitnerApp({ user }: { user: User }) {
  const { t } = useI18n();
  const { cards, catalog, settings, profile, setProfile, loadedOffline, syncStatus, refresh, actions } = useLeitnerData(user);
  const { ready } = useSessionEffects({ userId: user.id, profile, settings, setProfile, updateSettings: actions.updateSettings });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  // Lesson (or MY_CARDS) to open the word bank with; the key remounts it so the choice applies
  const [catalogLektion, setCatalogLektion] = useState<{ lektion: string; key: number } | null>(null);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  const [review, setReview] = useState<{ box?: number; nounsOnly: boolean; key: number }>({ nounsOnly: false, key: 0 });
  const [isStudyingNewWords, setIsStudyingNewWords] = useState(false);
  const [overdueMoves, setOverdueMoves] = useState<OverdueMove[]>([]);
  const [showStories, setShowStories] = useState(true);

  // Stories kill switch (app_flags.stories_enabled; missing or unreadable = on)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    storiesEnabled().then(on => { if (!cancelled) setShowStories(on); });
    return () => { cancelled = true; };
  }, [ready]);

  // Cards the nightly overdue rule moved back: explain them once (fresh server data is loaded by now)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchUnseenOverdueMoves().then(moves => { if (!cancelled) setOverdueMoves(moves); });
    return () => { cancelled = true; };
  }, [ready]);

  const todayStr = getTodayString();
  const dueCards = cards.filter(c => isCardDue(c, todayStr));
  const cardsToReview = review.box !== undefined ? dueCards.filter(c => c.box === review.box) : dueCards;

  const startReview = (box?: number, nounsOnly?: boolean) => {
    setReview(r => ({ box, nounsOnly: !!nounsOnly, key: r.key + 1 }));
    setIsStudyingNewWords(false);
    refreshSilver();
    setActiveTab('review');
  };
  const endReview = () => setReview(r => ({ nounsOnly: false, key: r.key }));

  const openWordBank = (lektion: string) => {
    setCatalogLektion({ lektion, key: Date.now() });
    setActiveTab('catalog');
  };

  // Open the screen a tapped reminder points to
  const goHandled = useRef(false);
  useEffect(() => {
    if (!profile || goHandled.current) return;
    goHandled.current = true;
    if (initialGo === 'learn') setIsStudyingNewWords(true);
    else if (initialGo === 'review') startReview();
    else if (initialGo === 'leaderboard') setActiveTab('leaderboard');
    else if (initialGo === 'stories' || initialGo === 'dictation') setActiveTab('stories');
    if (initialGo) window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const closeOverdueNotice = () => {
    setOverdueMoves([]);
    markOverdueMovesSeen().catch(() => undefined);
    if (!settings.overdueRuleSeen) actions.updateSettings({ overdueRuleSeen: true });
  };

  const signOut = async () => {
    // The next person signing in on this device must not get this user's reminders
    await disablePush().catch(() => undefined);
    await cloudSync.stop();
    await supabase?.auth.signOut();
  };

  if (!profile) return <FullScreenLoader text={t.app.preparing} />;
  if (profile.suspended) return <SuspendedScreen email={profile.email} onSignOut={() => supabase!.auth.signOut()} />;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col selection:bg-amber-100 selection:text-amber-900">
      <Navbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === 'review') return startReview();
          setIsStudyingNewWords(false);
          setActiveTab(tab);
        }}
        dueTodayCount={dueCards.length}
        onOpenNewCardModal={() => setIsNewCardModalOpen(true)}
        profile={profile}
        syncStatus={syncStatus}
        showStories={showStories}
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
            onFinish={() => { setIsStudyingNewWords(false); setActiveTab('dashboard'); }}
            onCardAdded={refresh}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <LeitnerDashboard
                cards={cards}
                catalog={catalog}
                onStartReview={startReview}
                onStartNewWordsLearning={() => setIsStudyingNewWords(true)}
                onNavigateToCatalog={() => setActiveTab('catalog')}
                onOpenLesson={openWordBank}
                onNavigateToReflections={() => openWordBank(MY_CARDS)}
                onOpenStories={showStories ? () => setActiveTab('stories') : undefined}
                onOpenNewCardModal={() => setIsNewCardModalOpen(true)}
                onOpenSettings={() => {
                  setActiveTab('settings');
                  setTimeout(() => document.getElementById('app-install')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                }}
              />
            )}

            {activeTab === 'review' && (
              <ReviewSession
                key={review.key}
                initialCards={cardsToReview}
                allCards={cards}
                initialNounsOnly={review.nounsOnly}
                onFinishSession={() => { endReview(); setActiveTab('dashboard'); }}
                onStartNewWordsLearning={() => { endReview(); setIsStudyingNewWords(true); }}
                onCardUpdated={refresh}
              />
            )}

            {activeTab === 'catalog' && (
              <VocabCatalog
                key={catalogLektion?.key ?? 0}
                initialLektion={catalogLektion?.lektion}
                catalogWords={catalog}
                activeCards={cards}
                onAddWordToLeitner={actions.addCard}
                onBatchAddWords={actions.addWords}
                onAddCard={actions.addCard}
                onDeleteCard={actions.deleteCard}
                onUpdateCard={actions.updateCard}
              />
            )}

            {activeTab === 'stories' && showStories && (
              <Suspense fallback={<FullScreenLoader text={t.stories.loading} />}>
                <StoriesScreen userId={user.id} cards={cards} onCardsChanged={refresh} onAddCard={actions.addCard} />
              </Suspense>
            )}

            {activeTab === 'leaderboard' && (
              <Leaderboard profile={profile} onOpenSettings={() => setActiveTab('settings')} />
            )}

            {activeTab === 'admin' && profile.isAdmin && <AdminPanel profile={profile} />}

            {activeTab === 'settings' && (
              <SettingsBackupModal
                settings={settings}
                onUpdateSettings={actions.updateSettings}
                cards={cards}
                onDataImported={refresh}
                profile={profile}
                onProfileChange={setProfile}
                onSignOut={signOut}
              />
            )}
          </>
        )}
      </main>

      {overdueMoves.length > 0 && (
        <OverdueNotice
          moves={overdueMoves}
          cards={cards}
          firstTime={!settings.overdueRuleSeen}
          dueCount={dueCards.length}
          onClose={closeOverdueNotice}
          onStartReview={() => { closeOverdueNotice(); startReview(); }}
        />
      )}

      <NewCardModal isOpen={isNewCardModalOpen} onClose={() => setIsNewCardModalOpen(false)} onAddCard={actions.addCard} />

      <AppFooter />
    </div>
  );
}
