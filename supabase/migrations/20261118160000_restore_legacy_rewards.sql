-- Compatibility baseline is restricted to the pre-release snapshot, never all unverified rows.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
create table if not exists app_private.legacy_reviews(id bigint primary key);
create table if not exists app_private.legacy_drills(id uuid primary key);
do $$ begin
 if to_regclass('release_backup_20261118_pr32.review_events') is not null then
  insert into app_private.legacy_reviews select id from release_backup_20261118_pr32.review_events on conflict do nothing;
  insert into app_private.legacy_drills select id from release_backup_20261118_pr32.adjective_drill_runs on conflict do nothing;
 end if;
end $$;

create table if not exists app_private.scene_catalog(id text primary key, points integer not null check(points>0));
insert into app_private.scene_catalog values
('S01-Q1',69),
('S01-Q2',88),
('S01-Q3',78),
('S01-Q4',65),
('S01-Q5',71),
('S01-Q6',75),
('S02-Q1',122),
('S02-Q2',77),
('S02-Q3',70),
('S02-Q4',86),
('S02-Q5',69),
('S02-Q6',90),
('S03-Q1',67),
('S03-Q2',68),
('S03-Q3',70),
('S03-Q4',81),
('S03-Q5',86),
('S03-Q6',128),
('S04-Q1',117),
('S04-Q2',89),
('S04-Q3',85),
('S04-Q4',87),
('S04-Q5',112),
('S04-Q6',138),
('S05-Q1',88),
('S05-Q2',110),
('S05-Q3',77),
('S05-Q4',88),
('S05-Q5',75),
('S05-Q6',147),
('S06-Q1',100),
('S06-Q2',112),
('S06-Q3',81),
('S06-Q4',84),
('S06-Q5',92),
('S06-Q6',103),
('S07-Q1',101),
('S07-Q2',100),
('S07-Q3',110),
('S07-Q4',117),
('S07-Q5',81),
('S07-Q6',94),
('S08-Q1',115),
('S08-Q2',119),
('S08-Q3',87),
('S08-Q4',113),
('S08-Q5',92),
('S08-Q6',100),
('S09-Q1',102),
('S09-Q2',84),
('S09-Q3',85),
('S09-Q4',89),
('S09-Q5',97),
('S09-Q6',117),
('S10-Q1',108),
('S10-Q2',87),
('S10-Q3',102),
('S10-Q4',106),
('S10-Q5',109),
('S10-Q6',126) on conflict(id) do nothing;
create table if not exists app_private.scene_rewards(user_id uuid references auth.users(id) on delete cascade, scene_id text references app_private.scene_catalog(id), points integer not null, completed_at timestamptz not null, primary key(user_id,scene_id));
create or replace function app_private.award_scene() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if new.completed_at is not null then
  insert into app_private.scene_rewards(user_id,scene_id,points,completed_at)
  select new.user_id,id,points,new.completed_at from app_private.scene_catalog where id=new.story_id
  on conflict(user_id,scene_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function app_private.award_scene() from public,anon,authenticated;
drop trigger if exists award_scene on public.story_progress;
create trigger award_scene after insert or update on public.story_progress for each row execute function app_private.award_scene();
insert into app_private.scene_rewards select p.user_id,c.id,c.points,p.completed_at from public.story_progress p join app_private.scene_catalog c on c.id=p.story_id where p.completed_at is not null on conflict do nothing;

create table if not exists app_private.activity_timezones(user_id uuid primary key references auth.users(id) on delete cascade, zone text not null);
create or replace function public.set_activity_timezone(p_zone text) returns void language plpgsql security definer set search_path=public,pg_temp as $$ begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from pg_timezone_names where name=p_zone) then raise exception 'Invalid timezone'; end if;
 insert into app_private.activity_timezones values(auth.uid(),p_zone) on conflict(user_id) do update set zone=excluded.zone;
end $$;
revoke all on function public.set_activity_timezone(text) from public,anon;
grant execute on function public.set_activity_timezone(text) to authenticated;
create table if not exists app_private.balance_cutover(id boolean primary key default true check(id),at timestamptz not null);
insert into app_private.balance_cutover values(true,now()) on conflict do nothing;
create table if not exists app_private.balance_events(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id) on delete cascade,card_id text not null,delta integer not null,occurred_at timestamptz not null default now());
create index if not exists balance_user_time on app_private.balance_events(user_id,occurred_at);
create or replace function app_private.record_balance() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare change integer; owner_id uuid; card text;
begin
 if tg_op='DELETE' then change:=-old.box;owner_id:=old.user_id;card:=old.id;
 elsif tg_op='INSERT' then change:=new.box;owner_id:=new.user_id;card:=new.id;
 else change:=new.box-old.box;owner_id:=new.user_id;card:=new.id;end if;
 if change<>0 and exists(select 1 from auth.users where id=owner_id) then insert into app_private.balance_events(user_id,card_id,delta) values(owner_id,card,change);end if;
 return null;
end $$;
revoke all on function app_private.record_balance() from public,anon,authenticated;
drop trigger if exists record_balance on public.cards;
create trigger record_balance after insert or update or delete on public.cards for each row execute function app_private.record_balance();
create or replace function public.get_verified_leaderboard(p_period text default 'all', p_limit integer default 100)
returns table (
  user_id     uuid,
  display_name text,
  avatar_url  text,
  score       bigint,
  score_7d    bigint,
  mastered    bigint,
  learning    bigint,
  reviews_7d  bigint,
  streak      integer,
  silver      bigint,
  rank        bigint,
  is_me       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with card_stats as (
    select c.user_id,
           coalesce(sum(c.box), 0)::bigint                  as box_sum,
           count(*) filter (where c.box >= 6)::bigint        as mastered,
           count(*)::bigint                                  as learning
    from public.cards c
    left join public.verified_card_points v on v.user_id=c.user_id and v.card_id=c.id
    group by c.user_id
  ),
  week_stats as (
    select user_id,sum(delta)::bigint score_7d,count(*)::bigint reviews_7d from (
      select user_id,delta from app_private.balance_events where occurred_at>now()-interval '168 hours' and occurred_at<=now()
      union all
      select e.user_id,(e.to_box-e.from_box) from public.review_events e
      where (e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id))
      and e.created_at<(select at from app_private.balance_cutover where id)
      and e.created_at>now()-interval '168 hours' and e.created_at<=now()
    ) movements group by user_id
  ),
  days as (
    select distinct user_id,review_day from (
      select e.user_id,e.review_day from public.review_events e
      where (e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id)) and e.to_box>e.from_box
      union all
      select sr.user_id,(sr.completed_at at time zone coalesce(t.zone,'Asia/Tehran'))::date from app_private.scene_rewards sr left join app_private.activity_timezones t on t.user_id=sr.user_id
      union all
      select r.user_id,(r.finished_at at time zone coalesce(t.zone,'Asia/Tehran'))::date from public.adjective_drill_runs r left join app_private.activity_timezones t on t.user_id=r.user_id
      where r.finished_at is not null and r.score>0 and (r.verified or exists(select 1 from app_private.legacy_drills l where l.id=r.id))
      union all
      select b.user_id,(b.occurred_at at time zone coalesce(t.zone,'Asia/Tehran'))::date from app_private.balance_events b left join app_private.activity_timezones t on t.user_id=b.user_id where b.delta>0
    ) activity
  ),
  islands as (
    select d.user_id, d.review_day,
           d.review_day - (row_number() over (partition by d.user_id order by d.review_day))::integer as grp
    from days d
  ),
  runs as (
    select i.user_id, count(*)::integer as len, max(i.review_day) as last_day
    from islands i
    group by i.user_id, i.grp
  ),
  streaks as (
    select r.user_id, max(r.len) as streak
    from runs r
    where r.last_day >= (now() at time zone coalesce((select zone from app_private.activity_timezones t where t.user_id=r.user_id),'Asia/Tehran'))::date - 1 and r.last_day <= (now() at time zone coalesce((select zone from app_private.activity_timezones t where t.user_id=r.user_id),'Asia/Tehran'))::date
    group by r.user_id
  ),
  -- Silver cards: days (from the start date) with more than 15 correct vocabulary answers, at most 30
  silver_days as (
    select e.user_id, e.review_day
    from public.review_events e
    where (e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id)) and e.review_day >= date '2026-10-31' and e.correct and e.card_type = 'vocab'
    group by e.user_id, e.review_day
    having count(*) > 15
  ),
  silver_stats as (
    select sd.user_id, least(30, count(*))::bigint as silver
    from silver_days sd
    group by sd.user_id
  ),
  board as (
    select p.id                                                    as user_id,
           p.display_name,
           p.avatar_url,
           coalesce(cs.box_sum, 0) + coalesce((select sum(sr.points) from app_private.scene_rewards sr where sr.user_id=p.id),0) as score,
           coalesce(ws.score_7d, 0)                                as score_7d,
           coalesce(cs.mastered, 0)                                as mastered,
           coalesce(cs.learning, 0)                                as learning,
           coalesce(ws.reviews_7d, 0)                              as reviews_7d,
           coalesce(st.streak, 0)                                  as streak,
           coalesce(sv.silver, 0)                                  as silver,
           (p.id = auth.uid())                                     as is_me,
           p.show_on_leaderboard                                   as visible
    from public.profiles p
    left join card_stats cs on cs.user_id = p.id
    left join week_stats ws on ws.user_id = p.id
    left join streaks st   on st.user_id = p.id
    left join silver_stats sv on sv.user_id = p.id
    where p.suspended_at is null
      and (p.show_on_leaderboard or p.id = auth.uid())
  ),
  scored as (
    select b.*, case when p_period = 'week' then b.score_7d else b.score end as metric
    from board b
  ),
  -- Ranks are computed over visible users only, so everyone sees the same ranks.
  -- A hidden caller still sees where they would stand.
  ranked as (
    select s.*, rank() over (order by s.metric desc) as rank
    from scored s
    where s.visible
    union all
    select s.*, 1 + (select count(*) from scored v where v.visible and v.metric > s.metric) as rank
    from scored s
    where not s.visible
  )
  select r.user_id, r.display_name, r.avatar_url, r.score, r.score_7d, r.mastered, r.learning,
         r.reviews_7d, r.streak, r.silver, r.rank, r.is_me
  from ranked r
  where r.rank <= greatest(1, least(p_limit, 500)) or r.is_me
  order by r.rank, r.is_me desc, r.display_name;
$$;

create or replace function public.get_verified_silver_status(p_day date)
returns table (total integer, today_correct integer, earned_today boolean)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select e.review_day, count(*) filter (where (e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id)) and e.correct and e.card_type = 'vocab') as correct
      from public.review_events e
     where (e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id)) and e.user_id = auth.uid() and e.review_day >= date '2026-10-31'
     group by e.review_day
  )
  select least(30, (select count(*) from days where correct > 15))::integer,
         coalesce((select correct from days where review_day = p_day), 0)::integer,
         coalesce((select correct > 15 from days where review_day = p_day), false);
$$;

create or replace function public.get_verified_adjective_board(p_period text default 'all', p_limit integer default 100)
returns table (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  best         integer,
  top3         integer[],
  best_at      timestamptz,
  rank         bigint,
  is_me        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select r.user_id, r.score, r.finished_at
    from public.adjective_drill_runs r
    where r.finished_at is not null and (r.verified or exists(select 1 from app_private.legacy_drills l where l.id=r.id))
      and (p_period <> 'week' or r.finished_at >= now() - interval '7 days')
  ),
  per_user as (
    select s.user_id, max(s.score) as best
    from scoped s
    group by s.user_id
  ),
  best_runs as (
    select pu.user_id, min(s.finished_at) as best_at
    from per_user pu
    join scoped s on s.user_id = pu.user_id and s.score = pu.best
    group by pu.user_id
  ),
  top3s as (
    select x.user_id, array_agg(x.score order by x.score desc) as top3
    from (
      select s.user_id, s.score, row_number() over (partition by s.user_id order by s.score desc) as rn
      from scoped s
    ) x
    where x.rn <= 3
    group by x.user_id
  ),
  board as (
    select p.id                        as user_id,
           p.display_name,
           p.avatar_url,
           pu.best                     as best,
           t.top3                      as top3,
           br.best_at                  as best_at,
           (p.id = auth.uid())         as is_me,
           p.show_on_leaderboard       as visible
    from public.profiles p
    join per_user pu   on pu.user_id = p.id
    join best_runs br   on br.user_id = p.id
    join top3s t         on t.user_id = p.id
    where p.suspended_at is null
      and (p.show_on_leaderboard or p.id = auth.uid())
  ),
  ranked as (
    select b.*, rank() over (order by b.top3 desc) as rank
    from board b
    where b.visible
    union all
    select b.*, 1 + (
      select count(*) from board v
      where v.visible and v.top3 > b.top3
    ) as rank
    from board b
    where not b.visible
  )
  select r.user_id, r.display_name, r.avatar_url, r.best, r.top3, r.best_at, r.rank, r.is_me
  from ranked r
  where r.rank <= greatest(1, least(p_limit, 500)) or r.is_me
  order by r.rank, r.is_me desc, r.display_name;
$$;

create or replace function public.get_my_verified_adjective_bests()
returns table (best_all integer, best_week integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select max(score) from public.adjective_drill_runs r where user_id = auth.uid() and finished_at is not null and (verified or exists(select 1 from app_private.legacy_drills l where l.id=r.id))),
    (select max(score) from public.adjective_drill_runs r where user_id = auth.uid() and finished_at is not null and (verified or exists(select 1 from app_private.legacy_drills l where l.id=r.id))
       and finished_at >= now() - interval '7 days');
$$;

-- Overtake notifications share the same total as the visible table.
create or replace function public.verified_leaderboard_ranks()
returns table(user_id uuid,score bigint,rank bigint)
language sql stable security definer set search_path=public as $$
 with totals as (
 select p.id user_id,coalesce((select sum(c.box) from public.cards c where c.user_id=p.id),0)::bigint
 +coalesce((select sum(r.points) from app_private.scene_rewards r where r.user_id=p.id),0)::bigint as score
 from public.profiles p where p.suspended_at is null and p.show_on_leaderboard
 ) select t.user_id,t.score,rank() over(order by t.score desc) from totals t;
$$;
revoke all on function public.verified_leaderboard_ranks() from public,anon,authenticated;
grant execute on function public.verified_leaderboard_ranks() to service_role;
