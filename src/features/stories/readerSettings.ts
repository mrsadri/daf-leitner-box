export interface ReaderSettings { fontSize: number; underlines: boolean }
export const READER_SETTINGS_KEY = 'daf_reader_settings_v1';
export const DEFAULT_READER_SETTINGS: ReaderSettings = { fontSize: 22, underlines: true };

export function parseReaderSettings(value: string | null): ReaderSettings {
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_READER_SETTINGS };
    const input = parsed as Record<string, unknown>;
    return {
      fontSize: typeof input.fontSize === 'number' && Number.isFinite(input.fontSize)
        ? Math.min(32, Math.max(18, Math.round(input.fontSize))) : DEFAULT_READER_SETTINGS.fontSize,
      underlines: typeof input.underlines === 'boolean' ? input.underlines : DEFAULT_READER_SETTINGS.underlines,
    };
  } catch { return { ...DEFAULT_READER_SETTINGS }; }
}
