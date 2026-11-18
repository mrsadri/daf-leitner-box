\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values('91000000-0000-0000-0000-000000000001','recovery@example.test');
insert into public.cards(user_id,id,type,box,next_review_date) values('91000000-0000-0000-0000-000000000001','daf_01_1','vocab',3,current_date);
alter table public.review_events disable trigger review_events_validate;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day)
select '91000000-0000-0000-0000-000000000001','legacy-'||n,'vocab',true,0,1,current_date from generate_series(1,16)n;
insert into app_private.legacy_reviews select id from public.review_events where user_id='91000000-0000-0000-0000-000000000001';
alter table public.review_events enable trigger review_events_validate;
select set_config('test.uid','91000000-0000-0000-0000-000000000001',true);
set local role authenticated;
select public.set_activity_timezone('Europe/Berlin');
do $$ begin
 if not exists(select 1 from public.get_verified_silver_status(current_date) where total=1) then raise exception 'FAILED: snapshot legacy silver not restored';end if;
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and score=3 and streak=1 and silver=1 and score_7d=3) then raise exception 'FAILED: legacy streak or card baseline';end if;
end $$;
reset role;
-- First completion grants catalog points. A repeated completion does not grant again.
insert into public.story_progress(user_id,story_id,finished_count,total_count,completed_at) values('91000000-0000-0000-0000-000000000001','S01-Q1',4,4,now());
update public.story_progress set quiz_score=3 where story_id='S01-Q1';
do $$ declare expected integer; actual bigint; begin
 select points+3 into expected from app_private.scene_catalog where id='S01-Q1';
 select score into actual from public.get_verified_leaderboard() where is_me;
 if actual<>expected then raise exception 'FAILED: scene award duplicated or missing';end if;
end $$;
update public.cards set box=1 where id='daf_01_1';
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and score_7d=1) then raise exception 'FAILED: negative movement balance';end if;
end $$;
delete from public.cards where id='daf_01_1';
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and score_7d=0) then raise exception 'FAILED: deletion balance';end if;
end $$;
rollback;
