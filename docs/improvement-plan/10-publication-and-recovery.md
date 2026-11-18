# Publication and remaining acceptance — 18 November 2026

## Published

PR [#35](https://github.com/mrsadri/daf-leitner-box/pull/35) is merged at `a63142c7e65ee4c24b01f24fcb4e9d88ce85eb86` and deployed to https://daf-leitner-box.vercel.app. The additive scoped-start RPC was applied before deployment; rollback-only live authorization checks passed. Public HTTP checks pass for security headers, bundled scripts/styles/fonts, all 10 story books, privacy and worker asset. CI passed 227 Node, 68 browser, 14 SQL and 3 Deno tests. Tasks 8, 16, 19 and 20 have their implementation and automated acceptance published; task 14's concurrent reminder lifecycle tests are also published. Real provider delivery remains an operator acceptance item.

## Follow-up prepared

- **13 — measured:** Read-only production function benchmarks (two warmups, ten samples per period) measured median/p95 9.558/9.795ms for all-time and 9.5095/9.599ms for weekly leaderboards, 32 returned rows, warm shared buffers and zero disk/temp reads in final plans. Network time is excluded; these samples are not an SLA. Together with the recorded 100-user/200k-event synthetic benchmark and result-equivalence tests, there is no evidence justifying another production index. Local synthetic volumes plus read-only production measurements replace paid staging for this investigation, following the owner's local-only staging decision.
- **22 — CSP defect fixed:** Strict enforcement blocked the inline language bootstrap. It now loads from a same-origin file. Both languages pass browser-injected enforcement and Google OAuth handoff with correct redirect origin; the Google page was intercepted before credentials. Preview browsers exercise the same policy under enforcement. Production remains report-only pending full authenticated/provider acceptance.
- **23 — runtime boundary corrected:** Vite and its build plugins are dev dependencies. Vercel installs the locked build dependencies explicitly with `npm ci --include=dev`; CI gates high runtime advisories. Runtime audit reports zero vulnerabilities. The full tooling audit still reports five high findings from the picomatch advisory; latest checked picomatch is 4.0.7. Classification is not a vulnerability fix and does not close upstream remediation.
- **25 — encrypted pipeline prepared:** Twice-daily opt-in backup workflow streams a full logical dump into age encryption and uploads only ciphertext to a separate private repository. No decryption identity enters CI. The owner selected Free; no plan/billing changes were made. Synthetic encrypted/decrypted restore and failed-connection cleanup pass. Operator setup and real hosted recovery remain pending.
- **21 — human test prepared:** `docs/screen-reader-acceptance.md` provides the actual VoiceOver/NVDA observation checklist. No human screen-reader pass is claimed.

## Still required before all backlog items can close

1. Owner custody of an offline decryption identity, private backup destination and PostgreSQL/limited-repository credentials; activate the workflow only after setup. No secrets should be pasted into chat.
2. Download and decrypt a real encrypted backup, restore into an isolated compatible Supabase environment, validate Auth/RLS/jobs/app behavior, and measure the agreed 24-hour RPO / 4-hour RTO. Local rehearsal does not establish this.
3. Actual screen-reader observation in both UI languages.
4. Complete interactive Google sign-in and an explicitly authorized real-device push check before the final production CSP enforcement decision.
5. Reviewed upstream remediation for the remaining build-tool advisory.

See `docs/encrypted-backups.md` for concrete activation and recovery instructions. This document distinguishes published work from prepared follow-up; release status for the latter will be recorded after its checks and publication.
