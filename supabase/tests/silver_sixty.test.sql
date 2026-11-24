\set ON_ERROR_STOP on
-- Silver cards: the cap is 60 (20261124150000_silver_sixty), on the device's status and on the leaderboard alike.
begin;
update public.profiles set show_on_leaderboard=false;
insert into auth.users(id,email) values('92000000-0000-0000-0000-000000000060','silver-sixty@example.test');
select set_config('test.uid','92000000-0000-0000-0000-000000000060',true);
alter table public.review_events disable trigger review_events_validate;
-- 31 earning days: more than the old cap of 30
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
select auth.uid(),'cap-'||d||'-'||n,'vocab',true,0,1,date '2026-10-31'+d,true,1 from generate_series(0,30)d,generate_series(1,16)n;
do $$ begin
 if (select total from public.get_verified_silver_status(current_date))<>31 then raise exception 'FAILED: status still capped at 30';end if;
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and silver=31) then raise exception 'FAILED: leaderboard still capped at 30';end if;
end $$;
-- 65 earning days: never more than 60
insert into public.review_events(user_id,card_id,card_type,correct,from_box,to_box,review_day,verified,verified_delta)
select auth.uid(),'cap-'||d||'-'||n,'vocab',true,0,1,date '2026-10-31'+d,true,1 from generate_series(31,64)d,generate_series(1,16)n;
do $$ begin
 if (select total from public.get_verified_silver_status(current_date))<>60 then raise exception 'FAILED: status cap is not 60';end if;
 if not exists(select 1 from public.get_verified_leaderboard() where is_me and silver=60) then raise exception 'FAILED: leaderboard cap is not 60';end if;
 raise notice 'ok: silver collection capped at 60 on status and leaderboard';
end $$;
rollback;
