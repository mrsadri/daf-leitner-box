import type { AppSettings } from './types.ts';
/** Accept only known, valid settings at storage/import boundaries. */
export function validSettings(value: unknown): Partial<AppSettings> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of ['soundEnabled','autoSpeak','hapticFeedback','nounsOnlyMode','newWordsFlipCard','overdueRuleSeen','notifyOvertake']) {
    if (typeof raw[key] === 'boolean') out[key] = raw[key];
  }
  if (typeof raw.speechRate === 'number' && Number.isFinite(raw.speechRate) && raw.speechRate >= 0.7 && raw.speechRate <= 1.2) out.speechRate = raw.speechRate;
  if (raw.language === 'fa' || raw.language === 'en') out.language = raw.language;
  return out;
}
