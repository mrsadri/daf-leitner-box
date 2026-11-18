\set ON_ERROR_STOP on
begin;
-- Native suites share a cluster; unrelated earlier fixtures must not enter these rank assertions.
update public.profiles set show_on_leaderboard=false;
insert into auth.users(id,email) values
 ('83000000-0000-0000-0000-000000000001','board-a@example.test'),
 ('83000000-0000-0000-0000-000000000002','board-b@example.test'),
 ('83000000-0000-0000-0000-000000000003','board-hidden@example.test'),
 ('83000000-0000-0000-0000-000000000004','board-suspended@example.test');
update public.profiles set show_on_leaderboard=false where id='83000000-0000-0000-0000-000000000003';
update public.profiles set suspended_at=now() where id='83000000-0000-0000-0000-000000000004';
insert into public.cards(user_id,id,type,box,next_review_date)
select id,'daf_01_1','vocab',4,current_date from auth.users where email like 'board-%@example.test';
insert into public.verified_card_points(user_id,card_id,points)
select id,'daf_01_1',case when email in ('board-a@example.test','board-b@example.test') then 4 else 6 end from auth.users where email like 'board-%@example.test';
alter table public.review_events disable trigger review_events_validate;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
select '83000000-0000-0000-0000-000000000001','word-'||n,'vocab',true,0,1,current_date,true,1 from generate_series(1,16)n;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
values('83000000-0000-0000-0000-000000000001','yesterday','vocab',true,0,1,current_date-1,true,1),
('83000000-0000-0000-0000-000000000001','unverified','vocab',true,0,1,current_date,false,1);
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
select '83000000-0000-0000-0000-000000000002','word-'||n,'vocab',true,0,1,current_date,true,1 from generate_series(1,17)n;
alter table public.review_events enable trigger review_events_validate;
select set_config('test.uid','83000000-0000-0000-0000-000000000001',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.get_verified_leaderboard('all',500) where user_id in ('83000000-0000-0000-0000-000000000003','83000000-0000-0000-0000-000000000004')) then raise exception 'FAILED: hidden or suspended user exposed'; end if;
 if not exists(select 1 from public.get_verified_leaderboard('all',500) where is_me and score=4 and score_7d=4 and reviews_7d=1 and streak=2 and silver=1 and rank=1) then raise exception 'FAILED: verified totals/streak/silver or tie rank'; end if;
 if not exists(select 1 from public.get_verified_leaderboard('week',500) where user_id='83000000-0000-0000-0000-000000000002' and score_7d=4 and rank=1) then raise exception 'FAILED: weekly tie rank'; end if;
end $$;
create temp table board_before as select jsonb_agg(to_jsonb(b) order by user_id) as result from public.get_verified_leaderboard('week',500)b;
reset role;
create index test_verified_board_day_user on public.review_events(review_day,user_id);
analyze public.review_events;
set local role authenticated;
do $$ begin
 if (select result from board_before)<>(select jsonb_agg(to_jsonb(b) order by user_id) from public.get_verified_leaderboard('week',500)b) then raise exception 'FAILED: candidate index changes ranking results'; end if;
 raise notice 'ok: hidden/suspended visibility, ties, streaks, silver and results preserved with candidate index';
end $$;
select set_config('test.uid','83000000-0000-0000-0000-000000000003',true);
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard('all',500) where is_me and score=4 and rank=1) then raise exception 'FAILED: hidden caller cannot see their own hypothetical rank'; end if;
end $$;
reset role;
rollback;
