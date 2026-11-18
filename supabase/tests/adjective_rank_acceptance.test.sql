\set ON_ERROR_STOP on
begin;
update public.profiles set show_on_leaderboard=false;
insert into auth.users(id,email) values
('93000000-0000-0000-0000-000000000001','rank-one@example.test'),
('93000000-0000-0000-0000-000000000002','rank-two@example.test'),
('93000000-0000-0000-0000-000000000003','rank-three@example.test'),
('93000000-0000-0000-0000-000000000004','rank-hidden@example.test');
insert into public.adjective_drill_runs(user_id,score,answered,started_at,finished_at,verified)
select ('93000000-0000-0000-0000-00000000000'||u)::uuid,score,10,now()-interval '5 minutes',now(),true
from (values(1,3),(1,2),(1,1),(2,3),(2,2),(2,1),(3,3),(3,1),(3,1),(4,4)) as runs(u,score);
update public.profiles set show_on_leaderboard=false where id='93000000-0000-0000-0000-000000000004';
select set_config('test.uid','93000000-0000-0000-0000-000000000003',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.get_verified_adjective_board('all',1))<>3 then raise exception 'FAILED: shared first rank or caller outside limit missing';end if;
 if not exists(select 1 from public.get_verified_adjective_board('all',1) where is_me and rank=3) then raise exception 'FAILED: second/third record tie breaker';end if;
 if exists(select 1 from public.get_verified_adjective_board('all',500) where user_id='93000000-0000-0000-0000-000000000004') then raise exception 'FAILED: hidden record exposed';end if;
end $$;
select set_config('test.uid','93000000-0000-0000-0000-000000000004',true);
do $$ begin
 if not exists(select 1 from public.get_verified_adjective_board('week',1) where is_me and rank=1 and best=4) then raise exception 'FAILED: hidden caller hypothetical rank';end if;
 raise notice 'ok: adjective top-three ties, hidden caller and own rank outside limit';
end $$;
reset role;
rollback;
