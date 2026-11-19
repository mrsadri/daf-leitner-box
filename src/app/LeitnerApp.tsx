import { speechService } from '../shared/lib/speechService';
/**
 * The signed-in app: navigation, the active screen, and the dialogs that can open over any screen.
 *
 * Data and changes come from useLeitnerData; start-up side effects from useSessionEffects. Screens get plain
 * props and callbacks, so each one can be read on its own. Deep links (?go=…) come from push notifications.
 */
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getTodayString, isCardDue } from '../core/leitnerEngine';
import { cloudSync } from '../core/cloudSync';
import { supabase } from '../shared/lib/supabase';
import { useI18n } from '../i18n/I18nProvider';
import { RecoveryMessage } from '../shared/ui/RecoveryBoundary';
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
import { adjectiveDrillEnabled } from '../features/adjective/flag';
import { clearQueue as clearAdjectiveQueue } from '../features/adjective/drillSync';
import { Dialog, Button } from '../shared/ui';

// Stories and the adjective drill are separate chunks, loaded only when opened
const StoriesScreen = lazy(() => import('../features/stories/StoriesScreen'));
const DrillScreen = lazy(() => import('../features/adjective/DrillScreen'));

// Where a tapped notification wants to go ("?go=learn" / "review" / "leaderboard" / "stories" / "adjective";
// "dictation" is the old name of Stories), read before the URL is cleaned up
const initialGo = new URLSearchParams(window.location.search).get('go');

export function LeitnerApp({ user }: { user: User }) {
  const { t } = useI18n();
  const { loadError, retryLoad, cards, catalog, settings, profile, setProfile, syncStatus, refresh, actions } = useLeitnerData(user);
  const { ready } = useSessionEffects({ userId: user.id, profile, settings, setProfile, updateSettings: actions.updateSettings });

  useEffect(() => {
    if (!supabase) return;
    void supabase.rpc('set_activity_timezone', { p_zone: Intl.DateTimeFormat().resolvedOptions().timeZone });
  }, [user.id]);
  const [activeTab, updateActiveTab] = useState<ActiveTab>('dashboard');
  useEffect(() => () => speechService.cancel(), [activeTab, user.id]);
  const setActiveTab = useCallback((tab: ActiveTab) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('go') !== tab) {
      url.searchParams.set('go', tab);
      window.history.pushState(null, '', url);
    }
    updateActiveTab(tab);
    requestAnimationFrame(() => document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true }));
  }, []);
  // Lesson (or MY_CARDS) to open the word bank with; the key remounts it so the choice applies
  const [catalogLektion, setCatalogLektion] = useState<{ lektion: string; key: number } | null>(null);
  const [isNewCardModalOpen, setIsNewCardModalOpen] = useState(false);
  const [review, setReview] = useState<{ box?: number; nounsOnly: boolean; key: number }>({ nounsOnly: false, key: 0 });
  const [isStudyingNewWords, setIsStudyingNewWords] = useState(false);
  const [overdueMoves, setOverdueMoves] = useState<OverdueMove[]>([]);
  const [showStories, setShowStories] = useState(true);
  const [showAdjective, setShowAdjective] = useState(true);
  const [storyReading, setStoryReading] = useState(false);
  const reading = activeTab === 'stories' && showStories && storyReading;
  const [leaderboardTopTab, setLeaderboardTopTab] = useState<'leitner' | 'adjective'>('leitner');
  // True while an adjective drill run is in progress; guards navigating away without confirming.
  const [adjectiveRunning, setAdjectiveRunning] = useState(false);
  const [pendingTab, setPendingTab] = useState<ActiveTab | null>(null);

  // Stories kill switch (app_flags.stories_enabled; missing or unreadable = on)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    storiesEnabled().then(on => { if (!cancelled) setShowStories(on); });
    return () => { cancelled = true; };
  }, [ready]);

  // Adjective drill kill switch (app_flags.adjective_drill_enabled; missing or unreadable = on)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    adjectiveDrillEnabled().then(on => { if (!cancelled) setShowAdjective(on); });
    return () => { cancelled = true; };
  }, [ready]);

  // If the flag turns out to be off, a deep link (or an already-open tab) falls back to the home page.
  useEffect(() => {
    if (activeTab === 'adjective' && !showAdjective) setActiveTab('dashboard');
  }, [activeTab, showAdjective, setActiveTab]);

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
    else if (initialGo === 'adjective') setActiveTab('adjective');
    else if (initialGo === 'catalog' || initialGo === 'settings' || initialGo === 'admin' || initialGo === 'dashboard') setActiveTab(initialGo);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const closeOverdueNotice = () => {
    setOverdueMoves([]);
    markOverdueMovesSeen().catch(() => undefined);
    if (!settings.overdueRuleSeen) actions.updateSettings({ overdueRuleSeen: true });
  };

  const [signOutRequested, setSignOutRequested] = useState(false);
  const signOut = () => setSignOutRequested(true);
  const completeSignOut = async () => {
    // The next person signing in on this device must not get this user's reminders or pending results
    await disablePush().catch(() => undefined);
    clearAdjectiveQueue(user.id);
    await cloudSync.stop();
    await supabase?.auth.signOut();
  };

  // A run in progress blocks navigating away until the learner confirms abandoning it.
  const applyTabChange = (tab: ActiveTab) => {
    if (tab === 'review') return startReview();
    setIsStudyingNewWords(false);
    setActiveTab(tab);
  };
  const requestTabChange = (tab: ActiveTab) => {
    if (adjectiveRunning && activeTab === 'adjective' && tab !== 'adjective') { setPendingTab(tab); return; }
    applyTabChange(tab);
  };
  const confirmLeaveDrill = () => {
    const tab = pendingTab;
    setPendingTab(null);
    setAdjectiveRunning(false);
    if (tab) applyTabChange(tab);
  };

  useEffect(() => {
    const onBack = () => {
      const tab = new URLSearchParams(window.location.search).get('go') || 'dashboard';
      if (['dashboard','review','catalog','stories','adjective','leaderboard','settings','admin'].includes(tab)) requestTabChange(tab as ActiveTab);
    };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  });

  const cancelLeaveDrill = () => {
    setPendingTab(null);
    const url = new URL(window.location.href); url.searchParams.set('go', activeTab);
    window.history.replaceState(null, '', url);
  };

  if (loadError) return <RecoveryMessage onRetry={retryLoad} />;
  if (!profile) return <FullScreenLoader text={t.app.preparing} />;
  if (profile.suspended) return <SuspendedScreen email={profile.email} onSignOut={() => supabase!.auth.signOut()} />;

  return (
    <div className={`min-h-screen flex flex-col selection:bg-amber-100 selection:text-amber-900 ${reading ? 'story-reading-shell' : activeTab === 'stories' ? 'story-library-shell' : 'bg-slate-50 dark:bg-slate-950'}`}>
      {!reading && <Navbar
        activeTab={activeTab}
        onTabChange={requestTabChange}
        showAdjective={showAdjective}
        dueTodayCount={dueCards.length}
        onOpenNewCardModal={() => setIsNewCardModalOpen(true)}
        profile={profile}
        syncStatus={syncStatus}
        showStories={showStories}
      />}

      <main tabIndex={-1} className={reading ? 'flex-1 w-full' : 'flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8'}>
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
                onOpenAdjective={showAdjective ? () => setActiveTab('adjective') : undefined}
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
                <StoriesScreen onReadingChange={setStoryReading} userId={user.id} cards={cards} onCardsChanged={refresh} onAddCard={actions.addCard} />
              </Suspense>
            )}

            {activeTab === 'adjective' && showAdjective && (
              <Suspense fallback={<FullScreenLoader text={t.app.preparing} />}>
                <DrillScreen
                  userId={user.id}
                  onRunningChange={setAdjectiveRunning}
                  onViewRecords={() => { setLeaderboardTopTab('adjective'); setActiveTab('leaderboard'); }}
                />
              </Suspense>
            )}

            {activeTab === 'leaderboard' && (
              <Leaderboard
                profile={profile}
                onOpenSettings={() => setActiveTab('settings')}
                showAdjective={showAdjective}
                topTab={leaderboardTopTab}
                onTopTabChange={setLeaderboardTopTab}
              />
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

      {pendingTab && (
        <Dialog
          onClose={cancelLeaveDrill}
          title={t.adjective.leaveConfirm.title}
          description={t.adjective.leaveConfirm.body}
          footer={
            <>
              <Button variant="secondary" onClick={cancelLeaveDrill}>{t.adjective.leaveConfirm.cancel}</Button>
              <Button variant="danger" onClick={confirmLeaveDrill}>{t.adjective.leaveConfirm.confirm}</Button>
            </>
          }
        />
      )}

      {signOutRequested && <Dialog title={t.settings.signOut} description={t.sync.signOutWarning}
        onClose={() => setSignOutRequested(false)} footer={<>
          <Button variant="secondary" onClick={() => setSignOutRequested(false)}>{t.common.cancel}</Button>
          <Button variant="danger" onClick={() => { setSignOutRequested(false); void completeSignOut(); }}>{t.settings.signOut}</Button>
        </>} />}
      {!reading && <AppFooter />}
    </div>
  );
}
