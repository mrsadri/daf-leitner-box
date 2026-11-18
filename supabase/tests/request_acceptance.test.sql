\set ON_ERROR_STOP on
begin;
update public.profiles set show_on_leaderboard=false;
insert into auth.users(id,email) values('92000000-0000-0000-0000-000000000001','acceptance@example.test');
select set_config('test.uid','92000000-0000-0000-0000-000000000001',true);
insert into public.cards(user_id,id,type,box,next_review_date) values
(auth.uid(),'daf_03_1','vocab',3,current_date),(auth.uid(),'daf_03_2','vocab',3,current_date),(auth.uid(),'daf_03_3','vocab',6,current_date);
insert into app_private.scene_rewards values(auth.uid(),'S01-Q1',10,now()-interval '7 days');
delete from app_private.balance_events where user_id=auth.uid();
insert into app_private.balance_events(user_id,card_id,delta,occurred_at) values
(auth.uid(),'a',-20,now()-interval '168 hours'),
(auth.uid(),'b',-3,now()-interval '168 hours'+interval '1 microsecond'),
(auth.uid(),'c',2,now()),
(auth.uid(),'d',100,now()+interval '1 day');
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and score=22 and score_7d=-1) then raise exception 'FAILED: exact 168h boundary, future exclusion, signed balance or story/Leitner separation';end if;
end $$;
-- A local calendar day can differ from the server UTC date. Yesterday stays active until local midnight.
select public.set_activity_timezone('Pacific/Kiritimati');
delete from app_private.balance_events where user_id=auth.uid();
delete from app_private.scene_rewards where user_id=auth.uid();
alter table public.review_events disable trigger review_events_validate;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
values(auth.uid(),'yesterday','vocab',true,1,2,(now() at time zone 'Pacific/Kiritimati')::date-1,true,1),
(auth.uid(),'today-wrong','vocab',false,2,1,(now() at time zone 'Pacific/Kiritimati')::date,true,-1);
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and streak=1) then raise exception 'FAILED: local yesterday or wrong-only day';end if;
end $$;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
values(auth.uid(),'today-positive','vocab',true,0,1,(now() at time zone 'Pacific/Kiritimati')::date,true,1),
(auth.uid(),'tomorrow','vocab',true,0,1,(now() at time zone 'Pacific/Kiritimati')::date+1,true,1);
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and streak=2) then raise exception 'FAILED: future day must not erase current streak or negative answer erase positive day';end if;
end $$;
update public.review_events set review_day=review_day-3 where user_id=auth.uid();
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and streak=0) then raise exception 'FAILED: genuinely broken streak';end if;
end $$;
-- First threshold and repeat-day behavior are computed from distinct earning days.
delete from public.review_events where user_id=auth.uid();
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
select auth.uid(),'silver-'||n,'vocab',true,0,1,current_date,true,1 from generate_series(1,15)n;
do $$ begin if (select total from public.get_verified_silver_status(current_date))<>0 then raise exception 'FAILED: 15 answers earned silver';end if;end $$;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta) values(auth.uid(),'silver-16','vocab',true,0,1,current_date,true,1);
do $$ begin if (select total from public.get_verified_silver_status(current_date))<>1 then raise exception 'FAILED: 16th answer did not earn silver';end if;end $$;
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta) values(auth.uid(),'silver-17','vocab',true,0,1,current_date,true,1);
do $$ begin if (select total from public.get_verified_silver_status(current_date))<>1 then raise exception 'FAILED: same-day duplicate silver';end if;raise notice 'ok: 168h edge, local calendar streak, future filtering and silver threshold';end $$;
rollback;
