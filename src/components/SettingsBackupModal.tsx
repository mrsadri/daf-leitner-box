import React, { useState, useRef, useEffect } from 'react';
import { AppSettings, LeitnerCard, UserProfile } from '../types/leitner';
import { leitnerEngine } from '../services/leitnerEngine';
import { cloudSync } from '../services/cloudSync';
import { soundService } from '../services/soundService';
import { speechService } from '../services/speechService';
import { Download, Upload, Volume2, ShieldCheck, Check, AlertTriangle, UserRound, LogOut, Trophy, Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { Switch } from './ui/Switch';
import { LanguageSwitch } from './ui/LanguageSwitch';
import { Auto, Ltr } from './ui/Text';
import { Credit } from './ui/Credit';
import { InstallSection, NotificationSection } from './AppInstall';

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
  const { t } = useI18n();
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

  // German voices of this device (the list can arrive after the page has loaded)
  const [voices, setVoices] = useState(() => speechService.availableVoices());
  const [preferredVoice, setPreferredVoice] = useState(() => speechService.preferredVoice());
  useEffect(() => speechService.onChange(() => {
    setVoices(speechService.availableVoices());
    setPreferredVoice(speechService.preferredVoice());
  }), []);

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
          ? t.settings.importOkSkipped(result.imported, result.skipped)
          : t.settings.importOk(result.imported));
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


  const section = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5';
  const sectionTitle = 'text-base font-bold text-slate-900 dark:text-white flex items-center gap-2';
  const row = 'flex items-start justify-between gap-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-b-0';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{t.settings.title}</h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{t.settings.subtitle}</p>
      </div>

      {/* Language */}
      <div className={section}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className={sectionTitle}>
              <Languages className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>{t.settings.languageTitle}</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{t.settings.languageBody}</p>
          </div>
          <LanguageSwitch className="self-start sm:self-auto shrink-0" />
        </div>
      </div>

      {/* Install + reminders */}
      <div id="app-install" className={`${section} text-xs scroll-mt-40 xl:scroll-mt-24`}>
        <InstallSection />
        <div className="border-t border-slate-100 dark:border-slate-800 pt-5 empty:hidden">
          <NotificationSection />
        </div>
      </div>

      {/* Account & leaderboard */}
      <div className={section}>
        <h2 className={sectionTitle}>
          <UserRound className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>{t.settings.accountTitle}</span>
        </h2>

        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-11 h-11 shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
              {profile.displayName.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <Auto className="font-semibold text-sm text-slate-900 dark:text-white block truncate">{profile.displayName}</Auto>
            {profile.email && (
              <Ltr className="text-xs text-slate-600 dark:text-slate-400 block truncate text-start">{profile.email}</Ltr>
            )}
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="space-y-2">
            <label htmlFor="displayName" className="font-semibold text-slate-800 dark:text-slate-200 block">{t.settings.displayName}</label>
            <div className="flex gap-2">
              <input
                id="displayName"
                type="text"
                dir="auto"
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
                {t.settings.saveName}
              </button>
            </div>
          </div>

          <div className={`${row} border-t pt-4`}>
            <label htmlFor="showOnBoard" className="min-w-0 cursor-pointer">
              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                {t.settings.showOnBoard}
              </span>
              <span className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.settings.showOnBoardBody}</span>
            </label>
            <Switch
              id="showOnBoard"
              checked={profile.showOnLeaderboard}
              disabled={profileStatus === 'saving'}
              onChange={(checked) => saveProfile({ showOnLeaderboard: checked })}
            />
          </div>

          {profileStatus === 'saved' && (
            <div className="text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> {t.settings.saved}
            </div>
          )}
          {profileStatus === 'error' && (
            <div className="text-red-700 dark:text-red-300 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {t.settings.saveError}
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={onSignOut}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              <LogOut className="w-4 h-4 rtl:-scale-x-100" />
              <span>{t.settings.signOut}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sound & pronunciation */}
      <div className={section}>
        <h2 className={sectionTitle}>
          <Volume2 className="w-5 h-5 text-indigo-600 shrink-0" />
          <span>{t.settings.audioTitle}</span>
        </h2>

        <div className="text-xs">
          {([
            {
              id: 'soundEnabled', title: t.settings.soundEffects, body: t.settings.soundEffectsBody, checked: settings.soundEnabled,
              onChange: (v: boolean) => { onUpdateSettings({ soundEnabled: v }); soundService.enabled = v; }
            },
            { id: 'autoSpeak', title: t.settings.autoSpeak, body: t.settings.autoSpeakBody, checked: settings.autoSpeak, onChange: (v: boolean) => onUpdateSettings({ autoSpeak: v }) },
            { id: 'nounsOnlyMode', title: t.settings.nounsDefault, body: t.settings.nounsDefaultBody, checked: settings.nounsOnlyMode, onChange: (v: boolean) => onUpdateSettings({ nounsOnlyMode: v }) }
          ]).map(opt => (
            <div key={opt.id} className={row}>
              <label htmlFor={opt.id} className="min-w-0 cursor-pointer">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">{opt.title}</span>
                <span className="text-slate-600 dark:text-slate-400 leading-relaxed">{opt.body}</span>
              </label>
              <Switch id={opt.id} checked={opt.checked} onChange={opt.onChange} />
            </div>
          ))}

          <div className="space-y-2 py-4 border-b border-slate-100 dark:border-slate-800">
            <label htmlFor="germanVoice" className="font-semibold text-slate-800 dark:text-slate-200 block">{t.settings.voice}</label>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.settings.voiceBody}</p>
            {!speechService.isSupported() ? (
              <p className="text-amber-700 dark:text-amber-300">{t.settings.voiceUnsupported}</p>
            ) : voices.length === 0 ? (
              <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 leading-relaxed">
                {t.settings.voiceNone}
              </p>
            ) : (
              <div className="flex gap-2">
                <select
                  id="germanVoice"
                  value={preferredVoice && voices.some(v => (v.voiceURI || v.name) === preferredVoice) ? preferredVoice : ''}
                  onChange={(e) => speechService.setPreferredVoice(e.target.value || null)}
                  className="flex-1 min-w-0 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="">{t.settings.voiceAuto}</option>
                  {voices.map(v => (
                    <option key={v.voiceURI || v.name} value={v.voiceURI || v.name} dir="ltr">
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => speechService.speak('Guten Tag! Wie geht es Ihnen?', settings.speechRate)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-semibold shrink-0"
                >
                  <Volume2 className="w-4 h-4" />
                  {t.settings.voiceTest}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-4">
            <div className="flex justify-between items-center font-semibold text-slate-800 dark:text-slate-200">
              <label htmlFor="speechRate">{t.settings.speechRate}</label>
              <span className="font-mono-num text-indigo-600 dark:text-indigo-400">{t.settings.rate(settings.speechRate)}</span>
            </div>
            <input
              id="speechRate"
              type="range"
              min="0.7"
              max="1.2"
              step="0.05"
              value={settings.speechRate}
              onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400">
              <span>{t.settings.rateSlow} ({t.settings.rate(0.7)})</span>
              <span>{t.settings.rateNormal} ({t.settings.rate(0.9)})</span>
              <span>{t.settings.rateFast} ({t.settings.rate(1.2)})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Backup & restore */}
      <div className={section}>
        <h2 className={sectionTitle}>
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{t.settings.backupTitle}</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{t.settings.backupBody}</p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{t.settings.download(cards.length)}</span>
          </button>

          <input type="file" ref={fileInputRef} onChange={handleImportFile} accept=".json" className="hidden" />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>{t.settings.upload}</span>
          </button>
        </div>

        {importStatus === 'success' && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{importMessage}</span>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{t.settings.importError}</span>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-5 sm:p-6 space-y-4">
        <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t.settings.dangerTitle}</span>
        </h3>
        <p className="text-xs text-red-600 dark:text-red-300 leading-relaxed">{t.settings.dangerBody}</p>

        {!resetConfirm ? (
          <button
            onClick={() => setResetConfirm(true)}
            className="px-4 py-2 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-950/40 rounded-xl text-xs font-semibold transition-colors"
          >
            {t.settings.resetButton}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleResetData} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors">
              {t.settings.resetConfirm}
            </button>
            <button onClick={() => setResetConfirm(false)} className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:underline">
              {t.common.cancel}
            </button>
          </div>
        )}
      </div>

      <Credit className="pt-2 px-4" />

    </div>
  );
};
