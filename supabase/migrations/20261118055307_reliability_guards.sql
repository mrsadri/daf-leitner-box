-- Additive reliability guards; owner-run deployment guide: docs/supabase-reliability-setup.md
create or replace function public.limit_cards_per_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 914));
  if exists(select 1 from public.cards where user_id=new.user_id and id=new.id) then return new; end if;
  if (select count(*) from public.cards where user_id=new.user_id) >= 10000 then
    raise exception 'card limit reached' using errcode='54000';
  end if;
  return new;
end $$;
revoke all on function public.limit_cards_per_user() from public, anon, authenticated;

alter table public.story_progress add column if not exists quiz_score smallint
  check (quiz_score between 0 and 3);

-- Atomic merge also protects old clients that still use direct upsert.
create or replace function public.merge_story_progress()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.story_id !~ '^S(0[1-9]|10)-Q[1-6]$' or new.total_count < 1
     or new.total_count > 10000 or new.finished_count < 1 or new.finished_count > new.total_count then
    raise exception 'invalid story progress' using errcode='22023';
  end if;
  if tg_op = 'UPDATE' then
    if new.last_active_at < old.last_active_at then new.quiz_score := old.quiz_score;
    else new.quiz_score := coalesce(new.quiz_score,old.quiz_score); end if;
    new.finished_count := greatest(old.finished_count,new.finished_count);
    new.total_count := greatest(old.total_count,new.total_count);
    new.completed_at := case when old.completed_at is null then new.completed_at
                             when new.completed_at is null then old.completed_at
                             else least(old.completed_at,new.completed_at) end;
    new.last_active_at := greatest(old.last_active_at,new.last_active_at);
    new.content_version := coalesce(new.content_version,old.content_version);
  end if;
  new.last_sentence_id := 'p' || new.finished_count::text;
  return new;
end $$;
revoke all on function public.merge_story_progress() from public, anon, authenticated;
drop trigger if exists story_progress_merge on public.story_progress;
create trigger story_progress_merge before insert or update on public.story_progress
for each row execute function public.merge_story_progress();

create or replace function public.validate_push_destination()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.endpoint !~ '^https://(fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/[^[:space:]]+$' then
    raise exception 'unsupported push destination' using errcode='22023';
  end if;
  return new;
end $$;
revoke all on function public.validate_push_destination() from public, anon, authenticated;
drop trigger if exists push_destination_guard on public.push_subscriptions;
create trigger push_destination_guard before insert or update of endpoint on public.push_subscriptions
for each row execute function public.validate_push_destination();

-- New clients persist operation IDs before transmission. Null legacy IDs remain compatible.
alter table public.review_events add column if not exists operation_id uuid;
create unique index if not exists review_events_operation_idx on public.review_events(user_id,operation_id);

-- Service-role-only per-user leases prevent overlapping reminder invocations.
create table if not exists public.push_delivery_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
alter table public.push_delivery_leases enable row level security;
revoke all on public.push_delivery_leases from public, anon, authenticated;
grant all on public.push_delivery_leases to service_role;
create or replace function public.claim_reminder_user(p_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare claimed uuid;
begin
  insert into public.push_delivery_leases(user_id,expires_at) values(p_user,now()+interval '5 minutes')
  on conflict(user_id) do update set expires_at=excluded.expires_at
  where push_delivery_leases.expires_at <= now()
  returning user_id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_reminder_user(uuid) from public,anon,authenticated;
grant execute on function public.claim_reminder_user(uuid) to service_role;
