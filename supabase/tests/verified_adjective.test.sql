\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('60000000-0000-0000-0000-000000000001','contest-a@test'),('60000000-0000-0000-0000-000000000002','contest-b@test');
select set_config('test.uid','60000000-0000-0000-0000-000000000001',true);
do $$ declare run jsonb; rid uuid; answer jsonb; receipt jsonb; result record;
begin
 run:=public.start_verified_adjective_run(); rid:=(run->>'id')::uuid;
 if jsonb_array_length(run->'questions')<>150 then raise exception 'FAILED: server did not issue 150 questions'; end if;
 select b.answers into answer from public.adjective_issued_questions q join public.adjective_question_bank b using(question_key) where q.run_id=rid and q.ordinal=0;
 receipt:=public.answer_verified_adjective(rid,0,answer);
 if not (receipt->>'correct')::boolean then raise exception 'FAILED: correct answer rejected'; end if;
 if receipt<>public.answer_verified_adjective(rid,0,answer) then raise exception 'FAILED: duplicate answer not idempotent'; end if;
 begin
  perform public.answer_verified_adjective(rid,0,'{}');
  raise exception 'FAILED: changed answer accepted';
 exception when invalid_parameter_value then null; end;
 perform set_config('test.uid','60000000-0000-0000-0000-000000000002',true);
 begin
  perform public.answer_verified_adjective(rid,1,'{}');
  raise exception 'FAILED: cross-owner answer';
 exception when insufficient_privilege then null; end;
 perform set_config('test.uid','60000000-0000-0000-0000-000000000001',true);
 update public.adjective_drill_runs set started_at=now()-interval '306 seconds' where id=rid;
 begin
  perform public.answer_verified_adjective(rid,1,answer);
  raise exception 'FAILED: answer after deadline accepted';
 exception when invalid_parameter_value then null; end;
 -- Legacy raw-score submission must never determine the verified score.
 perform public.finish_adjective_run(rid,150,150);
 if exists(select 1 from public.get_verified_adjective_board('all',100) where is_me) then raise exception 'FAILED: unverified score appeared in product board'; end if;
 select * into result from public.finish_verified_adjective_run(rid);
 if result.score<>1 or result.answered<>1 then raise exception 'FAILED: score was not derived from received answers'; end if;
 if not exists(select 1 from public.get_verified_adjective_board('all',100) where is_me and best=1) then raise exception 'FAILED: verified result not ranked'; end if;
 select * into result from public.finish_verified_adjective_run(rid);
 if result.score<>1 then raise exception 'FAILED: finish receipt changed'; end if;
 raise notice 'ok: issued questions, answer ownership/deadline/immutability, computed score and idempotent finish';
end $$;
set local role authenticated;
do $$ begin
 begin
  perform 1 from public.adjective_question_bank;
  raise exception 'FAILED: client can read private answer bank';
 exception when insufficient_privilege then null; end;
 raise notice 'ok: answer bank is not exposed to clients';
end $$;
reset role;
rollback;
