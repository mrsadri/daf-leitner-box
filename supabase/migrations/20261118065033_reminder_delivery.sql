-- Per-device delivery identities survive worker retries and account-wide bookkeeping failures.
create table if not exists public.push_delivery_attempts (
 subscription_id bigint not null references public.push_subscriptions(id) on delete cascade,
 delivery_key text not null check(char_length(delivery_key) between 1 and 300),
 user_id uuid not null references auth.users(id) on delete cascade,
 state text not null check(state in ('sending','sent','failed','unknown','expired')),
 attempts smallint not null check(attempts between 1 and 3),
 lease_until timestamptz not null,
 http_status integer,
 updated_at timestamptz not null default now(),
 primary key(subscription_id,delivery_key)
);
alter table public.push_delivery_attempts enable row level security;
revoke all on public.push_delivery_attempts from public,anon,authenticated;
grant all on public.push_delivery_attempts to service_role;
create or replace function public.claim_push_delivery(p_subscription bigint,p_user uuid,p_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare row_ public.push_delivery_attempts%rowtype;
begin
 if not exists(select 1 from public.push_subscriptions where id=p_subscription and user_id=p_user) then return '{"state":"gone"}'; end if;
 insert into public.push_delivery_attempts(subscription_id,delivery_key,user_id,state,attempts,lease_until)
 values(p_subscription,p_key,p_user,'sending',1,clock_timestamp()+interval '30 seconds') on conflict do nothing returning * into row_;
 if found then return jsonb_build_object('state','claimed','attempt',row_.attempts); end if;
 select * into row_ from public.push_delivery_attempts where subscription_id=p_subscription and delivery_key=p_key for update;
 if row_.state='sending' and row_.lease_until<clock_timestamp() then
   update public.push_delivery_attempts set state='unknown',updated_at=clock_timestamp() where subscription_id=p_subscription and delivery_key=p_key;
   return '{"state":"unknown"}';
 end if;
 if row_.state in ('sent','unknown','expired') then return jsonb_build_object('state',row_.state); end if;
 if row_.attempts>=3 and row_.state='failed' then return '{"state":"exhausted"}'; end if;
 if row_.state='sending' or row_.lease_until>clock_timestamp() then return '{"state":"skip"}'; end if;
 update public.push_delivery_attempts set state='sending',attempts=attempts+1,lease_until=clock_timestamp()+interval '30 seconds',updated_at=clock_timestamp()
 where subscription_id=p_subscription and delivery_key=p_key returning * into row_;
 return jsonb_build_object('state','claimed','attempt',row_.attempts);
end $$;
create or replace function public.finish_push_delivery(p_subscription bigint,p_key text,p_attempt integer,p_state text,p_status integer)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_state not in ('sent','failed','unknown','expired') then raise exception 'invalid delivery outcome' using errcode='22023'; end if;
 update public.push_delivery_attempts set state=p_state,http_status=p_status,lease_until=clock_timestamp(),updated_at=clock_timestamp()
 where subscription_id=p_subscription and delivery_key=p_key and attempts=p_attempt and state='sending';
end $$;
revoke all on function public.claim_push_delivery(bigint,uuid,text) from public,anon,authenticated;
revoke all on function public.finish_push_delivery(bigint,text,integer,text,integer) from public,anon,authenticated;
grant execute on function public.claim_push_delivery(bigint,uuid,text) to service_role;
grant execute on function public.finish_push_delivery(bigint,text,integer,text,integer) to service_role;
