\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values('82000000-0000-0000-0000-000000000001','verified-overdue@example.test');
insert into public.cards(user_id,id,type,box,next_review_date)
values('82000000-0000-0000-0000-000000000001','daf_01_1','vocab',3,'2026-11-07'),
('82000000-0000-0000-0000-000000000001','personal-only','vocab',3,'2026-11-07');
insert into public.verified_card_points(user_id,card_id,points,next_review_day)
values('82000000-0000-0000-0000-000000000001','daf_01_1',3,'2026-11-07');
select public.apply_overdue_demotions(true,'2026-11-10');
do $$ begin
 if (select points from public.verified_card_points where card_id='daf_01_1')<>3 then raise exception 'FAILED: dry-run changed verified points'; end if;
end $$;
select public.apply_overdue_demotions(false,'2026-11-10');
select public.apply_overdue_demotions(false,'2026-11-10');
do $$ begin
 if (select points from public.verified_card_points where card_id='daf_01_1')<>2 then raise exception 'FAILED: verified overdue deduction missing or repeated'; end if;
 if exists(select 1 from public.verified_card_points where card_id='personal-only') then raise exception 'FAILED: demotion fabricated verified history'; end if;
 raise notice 'ok: server overdue penalty reaches verified totals exactly once, without inventing credit';
end $$;
set local role authenticated;
select set_config('test.uid','82000000-0000-0000-0000-000000000001',true);
do $$ begin
 if not exists(select 1 from public.get_verified_leaderboard('all',100) where is_me and score=2) then raise exception 'FAILED: verified board ignores overdue penalty'; end if;
 begin
  insert into public.overdue_demotions(user_id,card_id,from_box,to_box,demoted_on) values(auth.uid(),'daf_01_1',3,2,current_date);
  raise exception 'FAILED: client can forge a verified overdue deduction';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
