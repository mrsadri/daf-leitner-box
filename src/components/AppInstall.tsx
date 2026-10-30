import React, { useEffect, useState } from 'react';
import { Smartphone, Bell, BellOff, CheckCircle2, AlertTriangle, Loader2, X, Share } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { Switch } from './ui/Switch';
import {
  isStandalone, isIOS, isMobile, canPromptInstall, promptInstall, onPwaChange,
  getPushStatus, enablePush, disablePush, PushStatus
} from '../services/pwa';

/** Re-render when install / push state changes. */
function usePwaState(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => onPwaChange(() => setTick(t => t + 1)), []);
  return tick;
}

const IosSteps: React.FC = () => {
  const { t } = useI18n();
  const safari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
  return (
    <div className="space-y-2">
      {!safari && <p className="text-amber-700 dark:text-amber-300">{t.pwa.iosOtherBrowser}</p>}
      <ol className="space-y-1.5 list-decimal ps-5 marker:text-slate-400">
        {t.pwa.iosSteps.map((step, i) => (
          <li key={i} className="leading-relaxed">
            {step}
            {i === 0 && <Share className="inline w-4 h-4 mx-1 -mt-0.5 text-indigo-600" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </div>
  );
};

/** "Install the app" part of the settings page. */
export const InstallSection: React.FC = () => {
  const { t } = useI18n();
  usePwaState();
  const standalone = isStandalone();

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Smartphone className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t.pwa.installTitle}</h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.pwa.installBody}</p>
        </div>
      </div>
      {standalone ? (
        <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-4 h-4" />{t.pwa.installed}</p>
      ) : canPromptInstall() ? (
        <button
          onClick={() => promptInstall()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold"
        >
          <Smartphone className="w-4 h-4" />
          {t.pwa.installButton}
        </button>
      ) : isIOS() ? (
        <IosSteps />
      ) : (
        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.pwa.manualSteps}</p>
      )}
    </div>
  );
};

/** "Reminders" part of the settings page. */
interface NotificationSectionProps {
  /** Account setting (profiles.settings.notifyOvertake); unset means on */
  notifyOvertake: boolean;
  onNotifyOvertakeChange: (on: boolean) => void;
}

export const NotificationSection: React.FC<NotificationSectionProps> = ({ notifyOvertake, onNotifyOvertakeChange }) => {
  const { t, lang } = useI18n();
  const tick = usePwaState();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getPushStatus().then(s => alive && setStatus(s));
    return () => { alive = false; };
  }, [tick]);

  if (status === null || status === 'unavailable') return null;

  const toggle = async (on: boolean) => {
    setBusy(true);
    setError(false);
    try {
      if (on) setStatus(await enablePush(lang));
      else {
        await disablePush();
        setStatus('off');
      }
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Bell className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">{t.pwa.notifTitle}</h3>
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.pwa.notifBody}</p>
        </div>
      </div>

      {status === 'ios-install' && <p className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 leading-relaxed">{t.pwa.notifIosInstall}</p>}
      {status === 'unsupported' && <p className="text-slate-600 dark:text-slate-400">{t.pwa.notifUnsupported}</p>}
      {status === 'denied' && (
        <p className="flex items-start gap-1.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{t.pwa.notifDenied}
        </p>
      )}

      {(status === 'on' || status === 'off') && (
        <div className="flex flex-wrap items-center gap-3">
          {status === 'on' ? (
            <>
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-4 h-4" />{t.pwa.notifOn}</span>
              <button
                onClick={() => toggle(false)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellOff className="w-4 h-4" />}
                {t.pwa.notifDisable}
              </button>
            </>
          ) : (
            <button
              onClick={() => toggle(true)}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
              {t.pwa.notifEnable}
            </button>
          )}
          <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.pwa.notifPerDevice}</span>
        </div>
      )}
      {status === 'on' && (
        <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <label htmlFor="notifyOvertake" className="min-w-0 cursor-pointer">
            <span className="font-semibold text-slate-800 dark:text-slate-200 block">{t.pwa.notifOvertake}</span>
            <span className="text-slate-600 dark:text-slate-400 leading-relaxed">{t.pwa.notifOvertakeBody}</span>
          </label>
          <Switch id="notifyOvertake" checked={notifyOvertake} onChange={onNotifyOvertakeChange} />
        </div>
      )}
      {error && <p className="text-red-700 dark:text-red-300">{t.pwa.notifError}</p>}
    </div>
  );
};

const BANNER_KEY = 'daf_install_banner_dismissed';

/** Small dismissible banner on the dashboard, only on phones that haven't installed the app. */
export const InstallBanner: React.FC<{ onShowHow: () => void }> = ({ onShowHow }) => {
  const { t } = useI18n();
  usePwaState();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(BANNER_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (dismissed || isStandalone() || !isMobile()) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(BANNER_KEY, '1');
    } catch {
      // storage unavailable: hidden until reload
    }
  };

  return (
    <div className="flex items-center gap-3 p-3.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-xs">
      <Smartphone className="w-5 h-5 text-indigo-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-indigo-900 dark:text-indigo-200">{t.pwa.bannerTitle}</p>
        <p className="text-indigo-700 dark:text-indigo-300">{t.pwa.bannerBody}</p>
      </div>
      <button
        onClick={() => (canPromptInstall() ? promptInstall() : onShowHow())}
        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shrink-0"
      >
        {canPromptInstall() ? t.pwa.installButton : t.pwa.bannerHow}
      </button>
      <button onClick={dismiss} aria-label={t.pwa.dismiss} className="p-1 text-indigo-400 hover:text-indigo-700 shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
