/**
 * Build-time switches.
 *
 * DICTATION_ENABLED: the fallback for the story dictation kill switch (docs/dictation/11-release-plan.md). The normal
 * switch is the remote flag app_flags.dictation_enabled; this constant is used only when that flag cannot be read.
 * It stays false until the release PR flips it, so nothing is visible to users before the owner turns the feature on.
 * Admins can preview the feature with ?dictation=1 whatever this value is.
 */
export const DICTATION_ENABLED = false;
