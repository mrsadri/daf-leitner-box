/**
 * One user's data for the whole app: cards, the word catalogue, settings, profile and sync status.
 *
 * The engine (src/core/leitnerEngine.ts) owns the data; React gets copies through refresh(). Every change goes
 * through the engine, which queues it for Supabase (src/core/cloudSync.ts) and then calls refresh().
 */
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppSettings, LeitnerCard, UserProfile } from '../core/types';
import { leitnerEngine } from '../core/leitnerEngine';
import { onDrillSync, drillSyncInfo, flushQueue as flushDrill } from '../features/adjective/drillSync';
import { cloudSync, type SyncStatus } from '../core/cloudSync';

export function useLeitnerData(user: User) {
  const [cards, setCards] = useState<LeitnerCard[]>([]);
  const [catalog, setCatalog] = useState<LeitnerCard[]>([]);
  const [settings, setSettings] = useState<AppSettings>(leitnerEngine.getSettings());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedOffline, setLoadedOffline] = useState(false);
  const [syncInfo, setSyncInfo] = useState(() => ({ ...cloudSync.getSyncInfo(), drillPending:0, drillError:false }));
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');

  const refresh = () => {
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
      refresh();
    }).catch(() => { if (!cancelled) setLoadError(true); });
    const updateInfo = () => {
      const drill = drillSyncInfo(user.id);
      setSyncInfo({ ...cloudSync.getSyncInfo(), drillPending:drill.pending, drillError:drill.error });
    };
    const offDrill = onDrillSync(user.id,updateInfo);
    const unsubscribe = cloudSync.onStatus(status => { setSyncStatus(status); updateInfo(); if (status === 'idle') refresh(); });
    return () => {
      cancelled = true;
      unsubscribe(); offDrill();
      cloudSync.detach();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, attempt]);

  const actions = {
    retrySync() { void cloudSync.flush(); void flushDrill(user.id).catch(() => {}); },
    addCard(cardData: Partial<LeitnerCard>) { leitnerEngine.addCard(cardData); refresh(); },
    addWords(words: LeitnerCard[]) { leitnerEngine.addBatchWords(words); refresh(); },
    deleteCard(cardId: string) { leitnerEngine.deleteCard(cardId); refresh(); },
    updateCard(cardId: string, updates: Partial<LeitnerCard>) { leitnerEngine.updateCard(cardId, updates); refresh(); },
    updateSettings(newSettings: Partial<AppSettings>) { leitnerEngine.saveSettings(newSettings); refresh(); },
  };

  return { loadError, retryLoad: () => { setLoadError(false); setAttempt(a => a + 1); }, cards, catalog, settings, profile, setProfile, loadedOffline, syncStatus, syncInfo, refresh, actions };
}
