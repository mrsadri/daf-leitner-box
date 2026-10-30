# Supabase setup for push reminders

One-time setup in the Supabase dashboard. Everything here is **additive**: it creates two new tables,
two functions, one Edge Function and one scheduled job. No existing table, row or setting is changed.

Placeholders: `<PROJECT_REF>`, `<CRON_SECRET>`, `<VAPID_PUBLIC_KEY>`, `<VAPID_PRIVATE_KEY>`.
Generate the keys with `npx web-push generate-vapid-keys` and the secret with `openssl rand -hex 32`.
The private key and the cron secret are secrets: never commit them.

## 1. Database migration

SQL Editor → New query → paste the full contents of
[supabase/migrations/20261027_push_reminders.sql](../supabase/migrations/20261027_push_reminders.sql) → Run.

Check (should return 2 rows):

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('push_subscriptions', 'push_state');
```

## 2. Extensions

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

## 3. Edge Function secrets

Edge Functions → Secrets (or Project Settings → Edge Functions) → add:

| Name | Value |
|---|---|
| `CRON_SECRET` | `<CRON_SECRET>` |
| `VAPID_PUBLIC_KEY` | `<VAPID_PUBLIC_KEY>` |
| `VAPID_PRIVATE_KEY` | `<VAPID_PRIVATE_KEY>` |
| `VAPID_SUBJECT` | `https://daf-leitner-box.vercel.app` |

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.)

## 4. Edge Function

Edge Functions → Deploy a new function → Via Editor:
- Name: `send-reminders`
- Code: the full contents of [supabase/functions/send-reminders/index.ts](../supabase/functions/send-reminders/index.ts)
- Deploy, then open the function's settings and turn **off** “Enforce JWT verification”
  (the function checks the `x-cron-secret` header itself).

Before deploying a changed version, check it the way Supabase bundles it (only static imports, no later downloads):

```bash
python3 scripts/build-edge-function.py          # after editing reminders.ts
cd supabase/functions/send-reminders
deno check --node-modules-dir=none index.ts
deno cache --node-modules-dir=none index.ts      # then run with --cached-only
```

## 5. Test (sends nothing)

```sql
select net.http_post(
  url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
  body := '{"dryRun": true}'::jsonb
);
-- a few seconds later:
select status_code, content from net._http_response order by created desc limit 1;
```

Expected: `status_code` 200 and JSON like `{"overtakeSent":0,"inactivitySent":0,...,"dryRun":true}`.
(The class-break reminder of the first version was removed; see [supabase-overdue-overtake-setup.md](supabase-overdue-overtake-setup.md).)
Without the header the function must answer 401.

## 6. Schedule (every 15 minutes)

```sql
select cron.schedule(
  'daf-send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

Check: `select jobname, schedule, active from cron.job;` and, after 15 minutes,
`select status, return_message, start_time from cron.job_run_details order by start_time desc limit 3;`

To stop the reminders at any time: `select cron.unschedule('daf-send-reminders');`

## 7. Frontend

Set `VITE_VAPID_PUBLIC_KEY=<VAPID_PUBLIC_KEY>` in Vercel (Production and Preview) and redeploy.
The reminders section in settings appears only when this variable is set.

## Test notification for one user

After a user has turned reminders on (Settings → Reminders), send them a test notification:

```sql
select net.http_post(
  url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<CRON_SECRET>'),
  body := jsonb_build_object('testUserId', '<USER_UUID>')
);
```

The user id is in Authentication → Users.
