-- Tests for migrations/20261101_shared_insights.sql on a local PostgreSQL (see scripts/test-sql.sh).
-- Each check raises an exception when it fails.
\set ON_ERROR_STOP on

-- a = author, b = adder, c = adder hidden from the leaderboard, d = suspended, e = admin
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@test'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@test'),
  ('00000000-0000-0000-0000-0000000000c1', 'c@test'),
  ('00000000-0000-0000-0000-0000000000d1', 'd@test'),
  ('00000000-0000-0000-0000-0000000000e1', 'e@test');
update public.profiles set display_name = 'Author' where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Bita'   where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set display_name = 'Cyrus', show_on_leaderboard = false where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set display_name = 'Dara'   where id = '00000000-0000-0000-0000-0000000000d1';
insert into public.app_admins (user_id) values ('00000000-0000-0000-0000-0000000000e1');

-- The author: 300 points (50 vocab cards in box 6) → 1 slot; three insight cards
insert into public.cards (user_id, id, type, box, next_review_date)
select '00000000-0000-0000-0000-0000000000a1', 'v' || g, 'vocab', 6, '9999-12-31' from generate_series(1, 50) g;
insert into public.cards (user_id, id, type, box, next_review_date, data) values
  ('00000000-0000-0000-0000-0000000000a1', 'r1', 'reflection', 0, '2026-11-01', '{"title":" Jeden Tag 20 Minuten ","content":"قبل از گوشی، لایتنر","category":"habit"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'r2', 'reflection', 0, '2026-11-01', '{"title":"Zwei","content":"","category":"goal"}'),
  ('00000000-0000-0000-0000-0000000000a1', 'rlong', 'reflection', 0, '2026-11-01', jsonb_build_object('title', 'Long', 'content', repeat('x', 1501), 'category', 'note')),
  ('00000000-0000-0000-0000-0000000000a1', 'w1', 'vocab', 0, '2026-11-01', '{"wort":"Haus"}');
-- b has a few points (no slot)
insert into public.cards (user_id, id, type, box, next_review_date, data) values
  ('00000000-0000-0000-0000-0000000000b1', 'rb', 'reflection', 2, '2026-11-01', '{"title":"Bita''s","category":"note"}');

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

-- Runs a statement and returns the error message ('' when it succeeded)
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated;
grant execute on function pg_temp.err(text) to authenticated;

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

set role authenticated;

-- ---------------- Quota and publishing ----------------
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check((select score = 300 and allowed = 1 and used = 0 and points_per_slot = 256 from public.share_quota()), 'author: 300 points → 1 slot, none used');
select pg_temp.check(pg_temp.err($$select public.publish_insight('w1')$$) like '%share:not_allowed%', 'a word card can''t be published');
select pg_temp.check(pg_temp.err($$select public.publish_insight('nope')$$) like '%share:not_found%', 'unknown card → not_found');
select pg_temp.check(pg_temp.err($$select public.publish_insight('rlong')$$) like '%share:too_long%', 'text over 1500 characters → too_long');
insert into ids select 'p1', public.publish_insight('r1');
select pg_temp.check((select title = 'Jeden Tag 20 Minuten' and category = 'habit' from public.my_insights() where id = (select id from ids where name = 'p1')), 'published snapshot (title trimmed)');
select pg_temp.check(pg_temp.err($$select public.publish_insight('r1')$$) like '%share:already_public%', 'same card twice → already_public');
select pg_temp.check(pg_temp.err($$select public.publish_insight('r2')$$) like '%share:quota%', 'second card with one slot → quota');
select pg_temp.check((select used = 1 from public.share_quota()), 'one slot used');

-- Direct table access is closed
select pg_temp.check(pg_temp.err($$select * from public.shared_insights$$) like '%permission denied%', 'no direct read of shared_insights');
select pg_temp.check(pg_temp.err($$insert into public.shared_insights (author_id, source_card_id, title, category) values (auth.uid(), 'r2', 'x', 'note')$$) like '%permission denied%', 'no direct insert into shared_insights');

-- Editing the author's card doesn't change the public copy
update public.cards set data = data || '{"title":"Changed"}' where id = 'r1';
select pg_temp.check((select title = 'Jeden Tag 20 Minuten' from public.my_insights() where id = (select id from ids where name = 'p1')), 'public version is a fixed copy');

-- ---------------- Browsing and adding ----------------
set test.uid = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select count(*) = 1 from public.get_public_insights()), 'b sees one public card');
select pg_temp.check((select author_name = 'Author' and not is_mine and not i_have and adopters = 0 from public.get_public_insights()), 'b: author name, not mine, not added');
select pg_temp.check(pg_temp.err($$select public.publish_insight('rb')$$) like '%share:quota%', 'b with 2 points has no slot');

-- A forged copy written straight to the cards table is dropped silently
insert into public.cards (user_id, id, type, box, next_review_date, data)
values (auth.uid(), 'shared_' || (select id from ids where name = 'p1'), 'reflection', 0, '2026-11-01', '{"title":"fake"}');
select pg_temp.check((select count(*) = 0 from public.cards where id like 'shared_%'), 'forged shared_ row is skipped (no error)');
insert into public.cards (user_id, id, type, box, next_review_date) values (auth.uid(), 'shared_not-a-uuid', 'reflection', 0, '2026-11-01');
select pg_temp.check((select count(*) = 0 from public.cards where id like 'shared_%'), 'malformed shared_ id is skipped');

select pg_temp.check((select added and card_id = 'shared_' || (select id from ids where name = 'p1') and data ->> 'title' = 'Jeden Tag 20 Minuten' and data ->> 'sharedId' = (select id::text from ids where name = 'p1') from public.adopt_insight((select id from ids where name = 'p1'), current_date)), 'b adds the card');
select pg_temp.check((select box = 0 and type = 'reflection' from public.cards where id like 'shared_%'), 'copy is an insight card in Box 0');
select pg_temp.check((select not added from public.adopt_insight((select id from ids where name = 'p1'), current_date)), 'adding twice → already there, no error');
select pg_temp.check((select i_have and adopters = 1 from public.get_public_insights()), 'b now has it; 1 adopter');

-- Review progress on the copy is an upsert of an existing row: allowed
insert into public.cards (user_id, id, type, box, next_review_date, data)
values (auth.uid(), 'shared_' || (select id from ids where name = 'p1'), 'reflection', 1, '2026-11-03', '{"title":"Jeden Tag 20 Minuten"}')
on conflict (user_id, id) do update set box = excluded.box, next_review_date = excluded.next_review_date;
select pg_temp.check((select box = 1 from public.cards where id like 'shared_%'), 'review upsert of an existing copy goes through');
select pg_temp.check((select count(*) = 1 and bool_and(author_name = 'Author') from public.insight_attribution(array[(select id from ids where name = 'p1')])), 'attribution while public');

-- c (hidden) adds it too; d adds then gets suspended
set test.uid = '00000000-0000-0000-0000-0000000000c1';
select public.adopt_insight((select id from ids where name = 'p1'), current_date);
set test.uid = '00000000-0000-0000-0000-0000000000d1';
select public.adopt_insight((select id from ids where name = 'p1'), current_date);
reset role;
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;

set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check(pg_temp.err($$select public.adopt_insight((select id from ids where name = 'p1'), current_date)$$) like '%share:own_card%', 'author can''t add own card');
select pg_temp.check((select jsonb_array_length(adopters) = 2 from public.my_insights() where id = (select id from ids where name = 'p1')), 'author sees 2 adopters (suspended one left out)');
select pg_temp.check((select adopters @> '[{"name":"Bita"}]' and adopters @> '[{"name":null}]' and not adopters::text like '%Cyrus%' from public.my_insights() where id = (select id from ids where name = 'p1')), 'hidden adopter has no name');
select pg_temp.check((select is_mine from public.get_public_insights()), 'author sees is_mine');
select pg_temp.check(pg_temp.err($$select public.report_insight((select id from ids where name = 'p1'), 'x')$$) like '%share:own_card%', 'author can''t report own card');

-- Suspended users can't add or browse
set test.uid = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.check(pg_temp.err($$select public.adopt_insight((select id from ids where name = 'p1'), current_date)$$) like '%share:not_allowed%', 'suspended user can''t add');
select pg_temp.check((select count(*) = 0 from public.get_public_insights()), 'suspended user sees nothing');

-- ---------------- Removing a copy ----------------
set test.uid = '00000000-0000-0000-0000-0000000000c1';
delete from public.cards where id like 'shared_%';
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check((select jsonb_array_length(adopters) = 1 from public.my_insights() where id = (select id from ids where name = 'p1')), 'removed copy leaves the author''s list');
set test.uid = '00000000-0000-0000-0000-0000000000c1';
select pg_temp.check((select added from public.adopt_insight((select id from ids where name = 'p1'), current_date)), 'adding again after removing works');

-- ---------------- Unpublishing ----------------
set test.uid = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.check(pg_temp.err($$select public.unpublish_insight((select id from ids where name = 'p1'))$$) like '%share:not_found%', 'only the author can unpublish');
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select public.unpublish_insight((select id from ids where name = 'p1'));
select pg_temp.check((select unpublished_at is not null and adopters = '[]'::jsonb from public.my_insights() where id = (select id from ids where name = 'p1')), 'unpublished: no adopter list any more');
select pg_temp.check((select used = 1 and allowed = 1 from public.share_quota()), 'unpublishing doesn''t give the slot back');
select pg_temp.check(pg_temp.err($$select public.publish_insight('r1')$$) like '%share:quota%', 'republishing needs a new slot');
set test.uid = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select count(*) = 0 from public.get_public_insights()), 'unpublished card left the public list');
select pg_temp.check((select count(*) = 1 from public.cards where id like 'shared_%'), 'b still has the copy');
select pg_temp.check((select count(*) = 0 from public.insight_attribution(array[(select id from ids where name = 'p1')])), 'no author name after unpublishing');
select pg_temp.check(pg_temp.err($$select public.adopt_insight((select id from ids where name = 'p1'), current_date)$$) like '%share:not_public%', 'can''t add an unpublished card');
-- The copy keeps working (review upsert)
insert into public.cards (user_id, id, type, box, next_review_date)
values (auth.uid(), 'shared_' || (select id from ids where name = 'p1'), 'reflection', 2, '2026-11-07')
on conflict (user_id, id) do update set box = excluded.box;
select pg_temp.check((select box = 2 from public.cards where id like 'shared_%'), 'copy of an unpublished card still saves review progress');

-- ---------------- Reports and admin ----------------
reset role;
-- More points for the author: 600 → 2 slots
insert into public.cards (user_id, id, type, box, next_review_date)
select '00000000-0000-0000-0000-0000000000a1', 'x' || g, 'vocab', 6, '9999-12-31' from generate_series(1, 50) g;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000a1';
insert into ids select 'p2', public.publish_insight('r2');
select pg_temp.check((select used = 2 and allowed = 2 from public.share_quota()), 'second slot used');

set test.uid = '00000000-0000-0000-0000-0000000000b1';
select public.adopt_insight((select id from ids where name = 'p2'), current_date);
select public.report_insight((select id from ids where name = 'p2'), 'politisch');
select public.report_insight((select id from ids where name = 'p2'), 'again');
select pg_temp.check((select i_reported from public.get_public_insights() where id = (select id from ids where name = 'p2')), 'b sees own report');
set test.uid = '00000000-0000-0000-0000-0000000000c1';
select public.report_insight((select id from ids where name = 'p2'), '');
select pg_temp.check((select count(*) = 1 from public.get_public_insights()), 'two reports: still public');
select pg_temp.check(pg_temp.err($$select * from public.admin_list_insights()$$) like '%not authorized%', 'non-admin can''t list');
select pg_temp.check(pg_temp.err($$select public.admin_remove_insight((select id from ids where name = 'p2'))$$) like '%not authorized%', 'non-admin can''t remove');
set test.uid = '00000000-0000-0000-0000-0000000000e1';
select public.report_insight((select id from ids where name = 'p2'), '');
select pg_temp.check((select count(*) = 0 from public.get_public_insights()), 'three reports: hidden from the list');
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check((select hidden from public.my_insights() where id = (select id from ids where name = 'p2')), 'author sees it is hidden');

set test.uid = '00000000-0000-0000-0000-0000000000e1';
select pg_temp.check((select open_reports = 3 and hidden and adopters = 1 and author_name = 'Author' and reports @> '[{"reason":"politisch"}]' from public.admin_list_insights() where id = (select id from ids where name = 'p2')), 'admin sees the reports');
select public.admin_keep_insight((select id from ids where name = 'p2'));
select pg_temp.check((select open_reports = 0 and not hidden from public.admin_list_insights() where id = (select id from ids where name = 'p2')), 'admin keeps it: reports cleared');
select pg_temp.check((select count(*) = 1 from public.get_public_insights()), 'kept card is public again');

select pg_temp.check((select public.admin_remove_insight((select id from ids where name = 'p2')) = 1), 'takedown removes the one copy');
reset role;
select pg_temp.check((select count(*) = 0 from public.cards where id = 'shared_' || (select id from ids where name = 'p2')), 'no copies left anywhere');
set role authenticated;
-- An open app that still has the copy saves it again: dropped silently
set test.uid = '00000000-0000-0000-0000-0000000000b1';
insert into public.cards (user_id, id, type, box, next_review_date)
values (auth.uid(), 'shared_' || (select id from ids where name = 'p2'), 'reflection', 1, '2026-11-03')
on conflict (user_id, id) do update set box = excluded.box;
select pg_temp.check((select count(*) = 0 from public.cards where id = 'shared_' || (select id from ids where name = 'p2')), 'removed copy can''t come back');
select pg_temp.check(pg_temp.err($$select public.report_insight((select id from ids where name = 'p2'), '')$$) like '%share:not_found%', 'removed card can''t be reported');
set test.uid = '00000000-0000-0000-0000-0000000000a1';
select pg_temp.check((select removed_at is not null from public.my_insights() where id = (select id from ids where name = 'p2')), 'author sees the takedown');
select pg_temp.check((select used = 2 from public.share_quota()), 'takedown doesn''t give the slot back');

-- ---------------- Suspended author, deleted author ----------------
reset role;
update public.profiles set suspended_at = null where id = '00000000-0000-0000-0000-0000000000d1';
insert into public.cards (user_id, id, type, box, next_review_date)
select '00000000-0000-0000-0000-0000000000d1', 'd' || g, 'vocab', 6, '9999-12-31' from generate_series(1, 43) g;
insert into public.cards (user_id, id, type, box, next_review_date, data) values
  ('00000000-0000-0000-0000-0000000000d1', 'rd', 'reflection', 0, '2026-11-01', '{"title":"Dara''s idea"}');
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000d1';
insert into ids select 'p3', public.publish_insight('rd');
select pg_temp.check((select category = 'decision' from public.my_insights()), 'missing category → decision');
set test.uid = '00000000-0000-0000-0000-0000000000b1';
select public.adopt_insight((select id from ids where name = 'p3'), current_date);
reset role;
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000d1';
set role authenticated;
select pg_temp.check((select count(*) = 0 from public.get_public_insights()), 'suspended author''s card is hidden');
select pg_temp.check((select count(*) = 0 from public.insight_attribution(array[(select id from ids where name = 'p3')])), 'no name for a suspended author');
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.check((select count(*) = 0 from public.shared_insights where id = (select id from ids where name = 'p3')), 'deleted author: publication gone');
select pg_temp.check((select count(*) = 1 from public.cards where id = 'shared_' || (select id from ids where name = 'p3')), 'deleted author: copy stays with the adder');

-- Day sent by the app must be close to the server's day
set role authenticated;
reset role;
insert into public.cards (user_id, id, type, box, next_review_date, data) values
  ('00000000-0000-0000-0000-0000000000a1', 'r3', 'reflection', 0, '2026-11-01', '{"title":"Drei"}');
insert into public.cards (user_id, id, type, box, next_review_date)
select '00000000-0000-0000-0000-0000000000a1', 'y' || g, 'vocab', 6, '9999-12-31' from generate_series(1, 50) g;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000a1';
insert into ids select 'p4', public.publish_insight('r3');
set test.uid = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.check((select next_review_date = (now() at time zone 'utc')::date from public.adopt_insight((select id from ids where name = 'p4'), '2020-01-01')), 'far-off day replaced by the server day');

reset role;
select 'PASSED shared_insights' as result;
