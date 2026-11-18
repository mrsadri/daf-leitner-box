-- Future-dated activity cannot extend an island beyond the user local day and erase a valid streak.
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
      where (e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id)) and e.to_box>e.from_box and e.created_at<=now()
      union all
      select sr.user_id,(sr.completed_at at time zone coalesce(t.zone,'Asia/Tehran'))::date from app_private.scene_rewards sr left join app_private.activity_timezones t on t.user_id=sr.user_id where sr.completed_at<=now()
      union all
      select r.user_id,(r.finished_at at time zone coalesce(t.zone,'Asia/Tehran'))::date from public.adjective_drill_runs r left join app_private.activity_timezones t on t.user_id=r.user_id
      where r.finished_at is not null and r.finished_at<=now() and r.score>0 and (r.verified or exists(select 1 from app_private.legacy_drills l where l.id=r.id))
      union all
      select b.user_id,(b.occurred_at at time zone coalesce(t.zone,'Asia/Tehran'))::date from app_private.balance_events b left join app_private.activity_timezones t on t.user_id=b.user_id where b.delta>0 and b.occurred_at<=now()
    ) activity
    where activity.review_day <= (now() at time zone coalesce((select zone from app_private.activity_timezones t where t.user_id=activity.user_id),'Asia/Tehran'))::date
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
