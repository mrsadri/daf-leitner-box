\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('30000000-0000-0000-0000-000000000001','review-id@test');
set local role authenticated;
select set_config('test.uid','30000000-0000-0000-0000-000000000001',true);
insert into public.review_events(operation_id,card_id,card_type,correct,from_box,to_box,review_day)
values ('30000000-0000-0000-0000-000000000002','word','vocab',true,0,1,current_date)
on conflict(user_id,operation_id) do nothing;
insert into public.review_events(operation_id,card_id,card_type,correct,from_box,to_box,review_day)
values ('30000000-0000-0000-0000-000000000002','word','vocab',true,0,1,current_date)
on conflict(user_id,operation_id) do nothing;
do $$ begin
 if (select count(*) from public.review_events where operation_id='30000000-0000-0000-0000-000000000002') <> 1 then
  raise exception 'FAILED: retry duplicated review'; end if;
 raise notice 'ok: stable operation identity makes repeated review submission idempotent';
end $$;
reset role;
rollback;
