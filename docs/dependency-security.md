# Dependency security record

Checked 18 November 2026 with `npm audit --json`: five high-severity affected packages (`picomatch`, `fdir`, `tinyglobby`, `vite`, `@vitejs/plugin-react`) from the tracked picomatch ReDoS advisory GHSA-fc5q-39xc-vjpf. This is a dated result, not a claim that the issue is fixed.

The registry suggests major toolchain downgrades (Vite 6.2.7/plugin-react 5.2.0), rather than a reviewed drop-in patch for the current stack. No automatic force fix was applied. The delivered browser assets do not invoke build-time glob matching; no production-browser exploit path was established. Avoid untrusted glob inputs, keep build runners isolated and credential-free for untrusted branches, and do not expose the development server publicly.

Owner/maintainer: review the advisory and dependency updates weekly, starting 25 November 2026, and before every release. This documents a maintenance process; no scheduled automation was created. For a candidate fix, review the changelog/lockfile, then run lint, unit/content/SQL/browser suites and configured production build. Reassess reachability when adding glob inputs or build services. Keep this finding open until a compatible reviewed update or an explicit maintainer disposition is recorded.

Weekly npm and GitHub Actions update PRs are now configured in `.github/dependabot.yml`. This takes effect after the file reaches the repository's default branch; it does not auto-merge, change production, or resolve the existing advisory by itself. Current primary advisory: [GitHub GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), rechecked 18 November 2026. No compatible upstream fix was established in this pass.
