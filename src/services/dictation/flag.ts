/**
 * The dictation kill switch (docs/dictation/11-release-plan.md). Pure.
 *
 *   remote   = app_flags.dictation_enabled: true, false, or null when it could not be read (fail open to the build constant)
 *   build    = DICTATION_ENABLED in src/config.ts (false until the release PR flips it)
 *   preview  = ?dictation=1 in the URL, honored only for admins
 */
export interface FlagInput {
  remote: boolean | null;
  build: boolean;
  isAdmin: boolean;
  previewParam: boolean;
}

export interface FlagState {
  enabled: boolean;
  /** An admin looking at the feature while it is off for everyone else (shows a "preview" ribbon). */
  preview: boolean;
}

export function resolveFlag({ remote, build, isAdmin, previewParam }: FlagInput): FlagState {
  const base = remote ?? build;
  if (base) return { enabled: true, preview: false };
  if (isAdmin && previewParam) return { enabled: true, preview: true };
  return { enabled: false, preview: false };
}

/** app_flags.value is jsonb: true/false, or the strings 'true'/'false'. Anything else counts as unreadable. */
export function parseFlagValue(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

export const previewRequested = (search: string): boolean => new URLSearchParams(search).get('dictation') === '1';
