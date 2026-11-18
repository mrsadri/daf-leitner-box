# Remaining four tasks — implementation follow-up

18 November 2026. Based on released main `b16c6c1` (PR #36). This follow-up adds concrete fixes and acceptance checks; it does not mark unavailable human, provider or hosted recovery evidence as passed.

| Task | New work | Still required |
|---|---|---|
| 21 | Corrected roving tabindex: one word is tabbable; arrow movement updates the active word; Tab leaves, Shift+Tab returns to the selected word, and reverse traversal exits without an extra container stop. Existing localized instructions and German language semantics retained. | Actual VoiceOver/NVDA observations. The owner has been asked for a guided walkthrough or checklist results. |
| 22 | Worker notification clicks now accept same-origin links only and reject credentials/external/malformed payloads. Tests exercise push display data, app-window reuse and safe fallback. Browser probes under enforced CSP verify inline script rejection, allowed synthetic Supabase transport, forbidden transport rejection and real local worker registration. | Complete interactive OAuth and explicitly authorized real-device push checks before the production CSP enforcement decision. Production remains report-only. |
| 23 | Fresh registry/advisory recheck still finds no patched picomatch release. Added a full-audit CI review gate: known high build finding remains visible; new/critical findings, unavailable metadata and the 25 November review expiry fail. Runtime audit is already gated separately. | Compatible reviewed upstream fix. No patched version exists in the checked advisory; classification and the dated gate are interim measures, not remediation. |
| 25 | Added read-only backup configuration preflight. The owner supplied the public age recipient. The private backup repository and matching public variables are configured. The workflow runs in that private repository with its built-in upload token, avoiding a separate token. Four PostgreSQL secrets remain absent; scheduling is disabled. Reports never read secret values or connect to PostgreSQL. | Credentials configured directly in the private backup repository, protected offline key custody, then a real encrypted snapshot and isolated compatible hosted restore measured against 24-hour RPO / 4-hour RTO. No paid resource or password reset was made. |

## Verification

- 233 unit tests pass, including new worker URL/payload/window cases and audit gate failure/expiry checks.
- 70 browser tests pass, including corrected forward/reverse reader traversal and enforced-CSP/worker probes on phone and desktop.
- TypeScript and oxlint pass.
- Backup readiness report is intentionally failing: setup is missing. This is diagnostic evidence, not a successful backup.
- No production user data was accessed and no notification was delivered by these tests.

## Operator steps

1. Follow `docs/encrypted-backups.md` to create and safely hold an age identity; share only the public recipient. Configure PostgreSQL credentials directly in the private backup repository’s GitHub Actions settings, never in chat.
2. Use `docs/screen-reader-acceptance.md` to record actual VoiceOver output in both languages. Automation cannot supply that observation.
3. Keep tasks 21, 22, 23 and 25 open until their final evidence exists. The separate automated and operator requirements are listed above so completion is not overstated.
