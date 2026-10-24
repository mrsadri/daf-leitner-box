import React, { useState, useRef } from 'react';
import { AppSettings, LeitnerCard, UserProfile } from '../types/leitner';
import { leitnerEngine } from '../services/leitnerEngine';
import { cloudSync } from '../services/cloudSync';
import { soundService } from '../services/soundService';
import { Download, Upload, Volume2, ShieldCheck, Check, AlertTriangle, UserRound, LogOut, Trophy } from 'lucide-react';

interface SettingsBackupModalProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  cards: LeitnerCard[];
  onDataImported: () => void;
  profile: UserProfile;
  onProfileChange: (profile: UserProfile) => void;
  onSignOut: () => void;
}

export const SettingsBackupModal: React.FC<SettingsBackupModalProps> = ({
  settings,
  onUpdateSettings,
  cards,
  onDataImported,
  profile,
  onProfileChange,
  onSignOut
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const saveProfile = async (patch: Partial<Pick<UserProfile, 'displayName' | 'showOnLeaderboard'>>) => {
    setProfileStatus('saving');
    try {
      await cloudSync.updateProfile(patch);
      onProfileChange({ ...profile, ...patch });
      setProfileStatus('saved');
      setTimeout(() => setProfileStatus('idle'), 2500);
    } catch (e) {
      console.error(e);
      setProfileStatus('error');
    }
  };

  const trimmedName = displayName.trim();
  const nameIsValid = trimmedName.length >= 1 && trimmedName.length <= 40;

  const handleExport = () => {
    const dataStr = leitnerEngine.exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daf_leitner_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    soundService.playSuccess();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = leitnerEngine.importData(content);
      if (result.ok) {
        soundService.playSuccess();
        setImportStatus('success');
        setImportMessage(result.skipped > 0
          ? `${result.imported} کارت وارد شد؛ ${result.skipped} کارت نامعتبر نادیده گرفته شد.`
          : `${result.imported} کارت وارد شد.`);
        onDataImported();
      } else {
        soundService.playWrong();
        setImportStatus('error');
      }
      setTimeout(() => setImportStatus('idle'), 4000);
    };
    reader.readAsText(file);
    // Allow importing the same file again later
    e.target.value = '';
  };

  const handleResetData = () => {
    leitnerEngine.clearAllCards();
    soundService.playWrong();
    setResetConfirm(false);
    onDataImported();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      
      {/* Title */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          تنظیمات، پشتیبان‌گیری و قوانین
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          مدیریت حساب کاربری، تنظیمات تلفظ صوتی و فایل پشتیبان پیشرفت یادگیری.
        </p>
      </div>

      {/* Account & Leaderboard */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <UserRound className="w-5 h-5 text-indigo-600" />
          <span>حساب کاربری و جدول رقابت</span>
        </h2>

        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
              {profile.displayName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <span className="font-semibold text-sm text-slate-900 dark:text-white block truncate">{profile.displayName}</span>
            {profile.email && (
              <span className="text-xs text-slate-600 dark:text-slate-400 block truncate dir-ltr text-right">{profile.email}</span>
            )}
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label htmlFor="displayName" className="font-semibold text-slate-800 dark:text-slate-200 block">
              نام نمایشی در جدول رقابت
            </label>
            <div className="flex gap-2">
              <input
                id="displayName"
                type="text"
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 min-w-0 px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => saveProfile({ displayName: trimmedName })}
                disabled={!nameIsValid || trimmedName === profile.displayName || profileStatus === 'saving'}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
              >
                ذخیره نام
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" />
                نمایش من در جدول رقابت
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                اگر خاموش باشد، نام و امتیاز شما برای دیگران نمایش داده نمی‌شود (خودتان همچنان رتبه‌تان را می‌بینید).
              </span>
            </div>
            <input
              type="checkbox"
              checked={profile.showOnLeaderboard}
              disabled={profileStatus === 'saving'}
              onChange={(e) => saveProfile({ showOnLeaderboard: e.target.checked })}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {profileStatus === 'saved' && (
            <div className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> ذخیره شد.
            </div>
          )}
          {profileStatus === 'error' && (
            <div className="text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> ذخیره نشد. اتصال اینترنت را بررسی کنید.
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>خروج از حساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audio & Pronunciation Settings */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-indigo-600" />
          <span>تنظیمات صدا و تلفظ آلمانی</span>
        </h2>

        <div className="space-y-4 text-xs">
          {/* Sound Effects */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                جلوه‌های صوتی ملایم (Web Audio)
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                پخش صدای آرام هنگام چرخش کارت، ارتقای خانه لایتنر و پاسخ صحیح
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={(e) => {
                onUpdateSettings({ soundEnabled: e.target.checked });
                soundService.enabled = e.target.checked;
              }}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Auto Speak */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                پخش خودکار تلفظ واژه آلمانی
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                با ورود هر کارت لغت در جلسه مرور، واژه به زبان آلمانی خوانده شود
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSpeak}
              onChange={(e) => onUpdateSettings({ autoSpeak: e.target.checked })}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Nouns Only Default Mode */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                حالت پیش‌فرض اختصاصی اسامی (Nomen Mode)
              </span>
              <span className="text-slate-600 dark:text-slate-400">
                فقط اسامی و آرتیکل‌ها در جلسات مرور فراخوانی شوند و سایر کارت‌ها اسکیپ شده و در خانه فعلی‌شان باقی بمانند
              </span>
            </div>
            <input
              type="checkbox"
              checked={settings.nounsOnlyMode}
              onChange={(e) => onUpdateSettings({ nounsOnlyMode: e.target.checked })}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Speech Rate Slider */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center font-semibold text-slate-800 dark:text-slate-200">
              <span>سرعت تلفظ گوینده آلمانی</span>
              <span className="font-mono-num text-indigo-600">{settings.speechRate}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.2"
              step="0.05"
              value={settings.speechRate}
              onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>آهسته و آموزشی (0.7x)</span>
              <span>نرمال (0.9x)</span>
              <span>سریع طبیعی (1.2x)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Backup and Restore */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span>پشتیبان‌گیری و بازنشانی اطلاعات (JSON)</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          تمام پیشرفت‌های یادگیری، وضعیت خانه‌های لایتنر، واژگان مطالعه‌شده و تصمیم‌های شخصی شما در حساب کاربری‌تان ذخیره و روی همه دستگاه‌ها همگام می‌شوند. در صورت نیاز می‌توانید یک نسخه پشتیبان JSON هم دانلود کنید. بارگذاری فایل پشتیبان، کارت‌های فعلی حساب را جایگزین می‌کند.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>دانلود فایل پشتیبان کامل ({cards.length} کارت)</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>بارگذاری و بازنشانی از فایل JSON</span>
          </button>
        </div>

        {importStatus === 'success' && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>اطلاعات فایل پشتیبان با موفقیت وارد شد. {importMessage}</span>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>خطا در خواندن فایل! لطفاً از معتبر بودن فایل JSON اطمینان حاصل فرمایید.</span>
          </div>
        )}
      </div>

      {/* Dangerous Zone */}
      <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>منطقه حساس و ریست یادگیری</span>
        </h3>
        <p className="text-xs text-red-600 dark:text-red-300">
          با ریست داده‌ها، تمام کارت‌های موجود در خانه‌های لایتنر و پیشرفت مرورها از حساب شما پاک خواهند شد. سابقه مرورهای این هفته (برای جدول رقابت) باقی می‌ماند.
        </p>

        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100/50 rounded-xl text-xs font-semibold transition-colors"
          >
            پاک‌سازی تمام پیشرفت‌ها و کارت‌های لایتنر
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetData}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              بله، کاملاً پاک شود
            </button>
            <button
              onClick={() => setResetConfirm(false)}
              className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:underline"
            >
              انصراف
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
