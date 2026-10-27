import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/demo';

/**
 * Installing the app on the home screen (PWA) and push reminders.
 * The server side (subscriptions table, scheduler, sending function) is in
 * supabase/migrations and supabase/functions/send-reminders (see docs/supabase-push-setup.md).
 */

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || '';

// ---------------------------------------------------------------------------------------------
// Platform

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isMobile = () => isIOS() || /Android/i.test(navigator.userAgent);

// ---------------------------------------------------------------------------------------------
// Service worker and install prompt

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installEvent: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

/** Re-render hook for components that show install / push state. */
export function onPwaChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // we show our own button
    installEvent = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    notify();
  });
  // Only in production builds: a service worker in dev would interfere with hot reload
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service worker registration failed', err));
  }
}

export const canPromptInstall = () => installEvent !== null;

export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  notify();
  return outcome === 'accepted';
}

// ---------------------------------------------------------------------------------------------
// Push reminders

export type PushStatus =
  | 'unavailable'      // not configured (no VAPID key) or demo mode
  | 'unsupported'      // this browser can't receive push
  | 'ios-install'      // iPhone/iPad: only works after adding the app to the home screen
  | 'denied'           // the user blocked notifications for this site
  | 'off'
  | 'on';

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!VAPID_PUBLIC_KEY || isDemoMode || !supabase) return 'unavailable';
  if (isIOS() && !isStandalone()) return 'ios-install';
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran';
  } catch {
    return 'Asia/Tehran';
  }
};

async function saveSubscription(sub: PushSubscription, lang: string) {
  const json = sub.toJSON();
  const { error } = await supabase!.rpc('register_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_timezone: deviceTimeZone(),
    p_lang: lang
  });
  if (error) throw error;
}

/** Ask for permission (must run from a user gesture), subscribe this device and save it. */
export async function enablePush(lang: string): Promise<PushStatus> {
  const status = await getPushStatus();
  if (status === 'unavailable' || status === 'unsupported' || status === 'ios-install') return status;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
  await saveSubscription(sub, lang);
  notify();
  return 'on';
}

/** Stop reminders on this device (also used when signing out, so the next user doesn't get them). */
export async function disablePush(): Promise<void> {
  const sub = await currentSubscription().catch(() => null);
  if (!sub) return;
  if (supabase) {
    await supabase.rpc('unregister_push_subscription', { p_endpoint: sub.endpoint }).then(({ error }) => {
      if (error) console.error('Could not remove push subscription', error);
    });
  }
  await sub.unsubscribe().catch(() => undefined);
  notify();
}

/** On every app start / language change: keep the stored time zone and language current. */
export async function refreshPush(lang: string): Promise<void> {
  if ((await getPushStatus()) !== 'on') return;
  const sub = await currentSubscription();
  if (sub) await saveSubscription(sub, lang).catch(err => console.error('Could not refresh push subscription', err));
}
