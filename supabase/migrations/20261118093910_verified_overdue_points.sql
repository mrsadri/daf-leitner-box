-- Preserve the existing server-run overdue penalty in verified competitive totals.
-- Only the privileged demotion job can insert these audit rows; direct card edits/imports cannot assert credit.
create or replace function public.apply_verified_overdue_points()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 update public.verified_card_points
 set points=greatest(0,points-(new.from_box-new.to_box))
 where user_id=new.user_id and card_id=new.card_id;
 return new;
end $$;
revoke all on function public.apply_verified_overdue_points() from public,anon,authenticated;
drop trigger if exists overdue_verified_points on public.overdue_demotions;
create trigger overdue_verified_points after insert on public.overdue_demotions
for each row execute function public.apply_verified_overdue_points();
