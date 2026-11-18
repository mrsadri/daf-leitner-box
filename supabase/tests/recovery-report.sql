-- Operator-only post-migration dry run. Includes hidden accounts; never expose this report publicly.
with eligible as (
 select e.* from public.review_events e where e.verified or exists(select 1 from app_private.legacy_reviews l where l.id=e.id)
), silver_days as (
 select user_id,review_day from eligible where correct and card_type='vocab' and review_day>=date '2026-10-31'
 group by user_id,review_day having count(*)>15
)
select p.id as user_id,p.show_on_leaderboard,
 (select count(*) from eligible e where e.user_id=p.id) as accepted_reviews,
 least(30,(select count(*) from silver_days d where d.user_id=p.id)) as reconstructed_silver,
 coalesce((select sum(c.box) from public.cards c where c.user_id=p.id),0) as card_score,
 coalesce((select sum(r.points) from app_private.scene_rewards r where r.user_id=p.id),0) as scene_score,
 (select count(*) from app_private.scene_rewards r where r.user_id=p.id) as completed_scenes
from public.profiles p order by p.id;
