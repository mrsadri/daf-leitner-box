# Contributing

Thanks for helping! Contributions in **English or Persian (فارسی)** are welcome.

## Getting started

1. Fork the repo and create a branch: `git checkout -b fix/short-description`
2. Install and run:
   ```bash
   npm install
   cp .env.example .env.local   # optional: add your own Supabase project's URL + anon key
   npm run dev                  # http://localhost:3000
   ```
   For login, sync and the leaderboard you need your **own** Supabase project — follow the setup steps in the [README](README.md). Never use someone else's production keys.
3. Before opening a PR:
   ```bash
   npm run lint    # TypeScript check
   npm run build
   ```

## Guidelines

- Keep PRs small and focused; describe *why* in the PR description.
- Match the existing code style (React function components, TypeScript, Tailwind).
- UI text is Persian (RTL); German words stay German.
- Changes to the Leitner rules (box intervals, demotion on wrong answers, scoring) change how people learn — please open an issue to discuss first.
- Database changes go in [supabase/schema.sql](supabase/schema.sql) and must stay **idempotent** (safe to run again) and keep RLS on every table.
- Vocabulary fixes (typos, translations) in `public/data/wortschatz-daf-kompakt.csv` are very welcome. Keep the column order and don't change `Lektion`/`Nr` of existing words, because card IDs depend on them.

## Reporting bugs / ideas

Open an issue using a template. For security issues see [SECURITY.md](SECURITY.md).

By contributing you agree that your contributions are licensed under the [MIT License](LICENSE) and that you follow the [Code of Conduct](CODE_OF_CONDUCT.md).
