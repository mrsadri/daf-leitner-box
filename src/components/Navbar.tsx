import React from 'react';
import { Layers, PlayCircle, BookOpen, Sparkles, Settings2, Plus, Trophy, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types/leitner';
import type { SyncStatus } from '../services/cloudSync';

export type ActiveTab = 'dashboard' | 'review' | 'catalog' | 'reflections' | 'leaderboard' | 'settings' | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  dueTodayCount: number;
  onOpenNewCardModal: () => void;
  profile: UserProfile;
  syncStatus: SyncStatus;
}

const SYNC_LABEL: Record<SyncStatus, { text: string; dot: string }> = {
  idle: { text: 'همگام‌سازی شده', dot: 'bg-emerald-500' },
  syncing: { text: 'در حال ذخیره…', dot: 'bg-amber-400 animate-pulse' },
  error: { text: 'خطا در ذخیره؛ دوباره تلاش می‌شود', dot: 'bg-red-500' },
  offline: { text: 'آفلاین؛ پس از اتصال ذخیره می‌شود', dot: 'bg-slate-400' }
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  dueTodayCount,
  onOpenNewCardModal,
  profile,
  syncStatus
}) => {
  const sync = SYNC_LABEL[syncStatus];
  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-8">
        
        {/* Zone 1: Brand title, single line */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => onTabChange('dashboard')} 
            className="flex items-center gap-2 text-right group focus:outline-none"
          >
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-indigo-700 transition-colors">
              L
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap block">
                لایتنر هوشمند DaF & Mind
              </span>
              <span className="text-[11px] text-slate-600 dark:text-slate-400 font-mono-num whitespace-nowrap hidden sm:block">
                فرمول فواصل ۲ⁿ روز · نسخه DaF kompakt
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: 4-5 Navigation Links, single-line text */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>داشبورد</span>
          </button>

          <button
            onClick={() => onTabChange('review')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 relative ${
              activeTab === 'review'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PlayCircle className="w-4 h-4" />
            <span>مرور امروز</span>
            {dueTodayCount > 0 && (
              <span className="px-1.5 py-0.2 text-[11px] font-mono-num font-bold rounded-md bg-amber-500 text-white">
                {dueTodayCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('catalog')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'catalog'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>مخزن کلمات DaF</span>
          </button>

          <button
            onClick={() => onTabChange('reflections')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'reflections'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>تصمیم‌ها و انگیزه‌ها</span>
          </button>

          <button
            onClick={() => onTabChange('leaderboard')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'leaderboard'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>رقابت</span>
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>پشتیبان و تنظیمات</span>
          </button>

          {profile.isAdmin && (
            <button
              onClick={() => onTabChange('admin')}
              className={`flex items-center gap-2 py-1.5 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                activeTab === 'admin'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>کاربران</span>
            </button>
          )}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenNewCardModal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">ثبت کارت جدید</span>
          </button>
          <button
            onClick={() => onTabChange('settings')}
            className="relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            title={`${profile.displayName} · ${sync.text}`}
            aria-label={`حساب کاربری (${sync.text})`}
          >
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm">
                {profile.displayName.slice(0, 1)}
              </span>
            )}
            <span className={`absolute bottom-0 left-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${sync.dot}`} />
          </button>
        </div>

      </div>

      {/* Mobile Nav Bar for smaller viewports */}
      <div className="lg:hidden flex items-center justify-around border-t border-slate-200 dark:border-slate-800 bg-slate-50/95 dark:bg-slate-900/95 px-2 py-2 text-xs">
        <button
          onClick={() => onTabChange('dashboard')}
          className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'dashboard' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
        >
          <Layers className="w-4 h-4" />
          <span>خانه‌ها</span>
        </button>
        <button
          onClick={() => onTabChange('review')}
          className={`flex flex-col items-center gap-1 p-1 relative ${activeTab === 'review' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
        >
          <div className="relative">
            <PlayCircle className="w-4 h-4" />
            {dueTodayCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 text-[9px] bg-amber-500 text-white rounded-full font-mono-num">
                {dueTodayCount}
              </span>
            )}
          </div>
          <span>مرور</span>
        </button>
        <button
          onClick={() => onTabChange('catalog')}
          className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'catalog' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
        >
          <BookOpen className="w-4 h-4" />
          <span>واژگان</span>
        </button>
        <button
          onClick={() => onTabChange('reflections')}
          className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'reflections' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
        >
          <Sparkles className="w-4 h-4" />
          <span>بینش‌ها</span>
        </button>
        <button
          onClick={() => onTabChange('leaderboard')}
          className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'leaderboard' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
        >
          <Trophy className="w-4 h-4" />
          <span>رقابت</span>
        </button>
        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'settings' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
        >
          <Settings2 className="w-4 h-4" />
          <span>تنظیمات</span>
        </button>
        {profile.isAdmin && (
          <button
            onClick={() => onTabChange('admin')}
            className={`flex flex-col items-center gap-1 p-1 ${activeTab === 'admin' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>کاربران</span>
          </button>
        )}
      </div>
    </header>
  );
};
