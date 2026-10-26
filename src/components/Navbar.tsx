import React from 'react';
import { Layers, PlayCircle, BookOpen, Sparkles, Settings2, Plus, Trophy, ShieldCheck, LucideIcon } from 'lucide-react';
import { UserProfile } from '../types/leitner';
import type { SyncStatus } from '../services/cloudSync';
import { useI18n } from '../i18n/I18nProvider';
import { LanguageSwitch } from './ui/LanguageSwitch';

export type ActiveTab = 'dashboard' | 'review' | 'catalog' | 'reflections' | 'leaderboard' | 'settings' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  dueTodayCount: number;
  onOpenNewCardModal: () => void;
  profile: UserProfile;
  syncStatus: SyncStatus;
}

const SYNC_DOT: Record<SyncStatus, string> = {
  idle: 'bg-emerald-500',
  syncing: 'bg-amber-400 animate-pulse',
  error: 'bg-red-500',
  offline: 'bg-slate-400'
};

const TABS: { id: ActiveTab; icon: LucideIcon }[] = [
  { id: 'dashboard', icon: Layers },
  { id: 'review', icon: PlayCircle },
  { id: 'catalog', icon: BookOpen },
  { id: 'reflections', icon: Sparkles },
  { id: 'leaderboard', icon: Trophy },
  { id: 'settings', icon: Settings2 },
  { id: 'admin', icon: ShieldCheck }
];

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  dueTodayCount,
  onOpenNewCardModal,
  profile,
  syncStatus
}) => {
  const { t, num } = useI18n();
  const syncText = t.sync[syncStatus];
  const tabs = TABS.filter(tab => tab.id !== 'admin' || profile.isAdmin);

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 lg:gap-8">

        {/* Brand */}
        <button
          onClick={() => onTabChange('dashboard')}
          className="flex items-center gap-2 min-w-0 text-start group focus:outline-none"
        >
          <div className="w-9 h-9 shrink-0 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-indigo-700 transition-colors">
            L
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white truncate block">
              <span className="sm:hidden">{t.app.shortName}</span>
              <span className="hidden sm:inline">{t.app.name}</span>
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap hidden sm:block">
              {t.app.tagline}
            </span>
          </div>
        </button>

        {/* Desktop navigation */}
        <nav className="hidden lg:flex items-center gap-5 xl:gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          {tabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === id
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.nav[id]}</span>
              {id === 'review' && dueTodayCount > 0 && (
                <span className="px-1.5 text-[11px] font-mono-num font-bold rounded-md bg-amber-500 text-white">
                  {num(dueTodayCount)}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <LanguageSwitch compact />
          <button
            onClick={onOpenNewCardModal}
            aria-label={t.nav.newCard}
            title={t.nav.newCard}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t.nav.newCard}</span>
          </button>
          <button
            onClick={() => onTabChange('settings')}
            className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title={`${profile.displayName} · ${syncText}`}
            aria-label={t.sync.account(syncText)}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                {profile.displayName.slice(0, 1)}
              </span>
            )}
            <span className={`absolute bottom-0 end-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${SYNC_DOT[syncStatus]}`} />
          </button>
        </div>
      </div>

      {/* Mobile navigation */}
      <nav
        className="lg:hidden grid border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 px-1 py-1.5 text-[11px] sm:text-xs"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            aria-current={activeTab === id ? 'page' : undefined}
            className={`flex flex-col items-center gap-1 px-0.5 py-1 min-w-0 rounded-lg ${
              activeTab === id ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="relative">
              <Icon className="w-5 h-5" />
              {id === 'review' && dueTodayCount > 0 && (
                <span className="absolute -top-1.5 -end-3 min-w-4 px-1 text-[9px] leading-4 text-center bg-amber-500 text-white rounded-full font-mono-num">
                  {num(dueTodayCount)}
                </span>
              )}
            </span>
            <span className="truncate max-w-full">{t.nav.short[id]}</span>
          </button>
        ))}
      </nav>
    </header>
  );
};
