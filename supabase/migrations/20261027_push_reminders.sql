-- =====================================================================
-- Push reminders (class-break reminder + inactivity reminder)
-- Additive only: two new tables and two functions. Existing tables and data are not touched.
-- Safe to run more than once.
-- =====================================================================

-- One row per device that turned reminders on
create table if not exists public.push_subscriptions (
  id                     bigint generated always as identity primary key,
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint               text not null unique check (char_length(endpoint) <= 1000),
  p256dh                 text not null check (char_length(p256dh) <= 200),
  auth                   text not null check (char_length(auth) <= 100),
  timezone               text not null default 'Asia/Tehran' check (char_length(timezone) <= 64),
  lang                   text not null default 'fa' check (lang in ('fa', 'en')),
  last_class_reminder_on date,          -- local date of the last 09:30 reminder on this device
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: read own" on public.push_subscriptions;
create policy "push_subscriptions: read own" on public.push_subscriptions
  for select using (auth.uid() = user_id);
-- No insert / update / delete policies: clients write only through the functions below.

-- Per-user reminder bookkeeping; only the sending function (service role) uses it
create table if not exists public.push_state (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  inactivity_count   smallint not null default 0,
  last_inactivity_at timestamptz,
  last_class_at      timestamptz
);

alter table public.push_state enable row level security;
-- No policies: not readable or writable by clients.

-- Save (or move) this device's subscription for the signed-in user
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_timezone text, p_lang text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text := coalesce(nullif(p_timezone, ''), 'Asia/Tehran');
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if not public.is_active_user() then
    raise exception 'account suspended';
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'Asia/Tehran';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, timezone, lang)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, v_tz, case when p_lang = 'en' then 'en' else 'fa' end)
  on conflict (endpoint) do update
     set p256dh = excluded.p256dh,
         auth = excluded.auth,
         timezone = excluded.timezone,
         lang = excluded.lang,
         updated_at = now(),
         -- the same browser signed in with another account: the subscription moves to that account
         last_class_reminder_on = case when push_subscriptions.user_id = excluded.user_id
                                       then push_subscriptions.last_class_reminder_on end,
         user_id = excluded.user_id;

  -- At most 10 devices per user (oldest removed)
  delete from public.push_subscriptions
   where user_id = auth.uid()
     and id not in (select id from public.push_subscriptions where user_id = auth.uid()
                     order by updated_at desc limit 10);
end;
$$;

-- Turn reminders off for this device
create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.register_push_subscription(text, text, text, text, text) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;
