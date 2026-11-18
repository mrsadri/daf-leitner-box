\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('20000000-0000-0000-0000-000000000001','reliability@test');
set local role authenticated;
select set_config('test.uid','20000000-0000-0000-0000-000000000001',true);
insert into public.story_progress(user_id,story_id,finished_count,total_count,completed_at)
values (auth.uid(),'S01-Q1',5,5,now());
insert into public.story_progress(user_id,story_id,finished_count,total_count)
values (auth.uid(),'S01-Q1',2,5)
on conflict(user_id,story_id) do update set finished_count=excluded.finished_count,total_count=excluded.total_count,completed_at=null;
do $$ begin
 if not exists(select 1 from public.story_progress where story_id='S01-Q1' and finished_count=5 and completed_at is not null) then
  raise exception 'FAILED: story progress regressed'; end if;
 begin
  insert into public.story_progress(story_id,finished_count,total_count) values ('garbage',1,5);
  raise exception 'FAILED: malformed story accepted';
 exception when invalid_parameter_value then null; end;
 raise notice 'ok: story upserts retain maximum page and completion; malformed progress rejected';
end $$;
reset role;
-- Seed quota fixture efficiently, then restore all trigger behavior before the assertion.
alter table public.cards disable trigger cards_limit_per_user;
insert into public.cards(user_id,id,type,box,next_review_date)
select '20000000-0000-0000-0000-000000000001','quota-'||n,'vocab',0,current_date from generate_series(1,10000) n;
alter table public.cards enable trigger cards_limit_per_user;
set local role authenticated;
insert into public.cards(id,type,box,next_review_date) values ('quota-1','vocab',1,current_date)
on conflict(user_id,id) do update set box=excluded.box;
do $$ begin
 if (select box from public.cards where id='quota-1') <> 1 then raise exception 'FAILED: quota update failed'; end if;
 begin
  insert into public.cards(id,type,box,next_review_date) values ('over-quota','vocab',0,current_date);
  raise exception 'FAILED: quota insert allowed';
 exception when program_limit_exceeded then null; end;
 raise notice 'ok: existing-card update succeeds at quota; new insertion is rejected';
end $$;
reset role;
rollback;
