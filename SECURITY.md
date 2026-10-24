# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.
Use GitHub's private reporting instead: **Security → Report a vulnerability** on this repository.
You should get a reply within a few days.

## How the app is secured

- The frontend is a static site. The only values it ships are `VITE_SUPABASE_URL` and the Supabase **anon / publishable** key, which are public by design.
- All data access is enforced in Postgres by Row Level Security ([supabase/schema.sql](supabase/schema.sql)): each user can only read and write their own rows.
- The leaderboard and admin features are `SECURITY DEFINER` functions that expose only aggregated fields; admin functions check `public.app_admins`.
- Never commit `.env*` files, the Supabase `service_role`/secret key, the database password or the Google OAuth client secret.

## Known limitations

- Card progress is written by the client, so the leaderboard is honor-based: a determined user can inflate their own score. Per-review moves are limited to one box, and per-user card count and payload size are capped.
