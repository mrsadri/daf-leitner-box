# 09. Data model and migrations

Everything here is **additive**. No existing table, column, policy, trigger or function is changed. Existing users
see no difference until they open the new tab. SQL below is illustration, not a migration to run.

## Where each kind of data lives

| Data | Home | Reason |
|---|---|---|
| Story, sequence, sentence content, audio index | Static JSON in the repo (`public/data/stories/`) | `04-content-pipeline.md` |
| Audio files, illustrations | Storage bucket `story-media` (public read, service-role write) | `05-audio.md` |
| Per-user progress | New tables `story_progress`, `story_sentence_progress` | Needs to follow the user across devices |
| Audio mode, grammar drawer preference, beta notice seen | New optional keys in `profiles.settings` (existing jsonb, existing sync) | Same mechanism as `language`, `speechRate` |
| Per-device voice map, drafts, offline queue, prefetched audio | localStorage and Cache API | Device specific by nature |
| Remote kill switch | New tiny table `app_flags` | Flip without a deploy |

## Migration file

`supabase/migrations/2026MMDD_story_dictation.sql` (date set when written, same naming as `20261101_shared_insights.sql`),
idempotent (`if not exists`, `create or replace`, `drop policy if exists`), safe to run twice. It is exercised by
`scripts/test-sql.sh` (which already runs every migration twice on a throwaway local Postgres) with a new
`supabase/tests/story_dictation.test.sql`. It is applied to production only by the owner through
`docs/supabase-dictation-setup.md` (written in the style of `docs/supabase-shared-insights-setup.md`).

## Tables (illustration)

```sql
create table if not exists public.story_progress (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  story_id        text not null check (char_length(story_id) between 1 and 40),
  finished_count  integer not null default 0 check (finished_count >= 0),
  total_count     integer not null default 0 check (total_count >= 0),
  last_sentence_id text check (char_length(last_sentence_id) <= 40),   -- last entered sentence (drawer context)
  content_version text,
  started_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now(),
  completed_at    timestamptz,
  primary key (user_id, story_id)
);

create table if not exists public.story_sentence_progress (
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  story_id        text not null check (char_length(story_id) between 1 and 40),
  sentence_id     text not null check (char_length(sentence_id) between 1 and 40),
  sentence_order  integer not null check (sentence_order >= 0),     -- fallback if the id is retired
  status          text not null default 'heard'
                  check (status in ('heard', 'attempted', 'moved', 'skipped', 'correct')),
  attempts        integer not null default 0 check (attempts between 0 and 100000),
  mistakes        integer not null default 0 check (mistakes between 0 and 100000),   -- submissions with mistakes
  skips           smallint not null default 0 check (skips >= 0),
  listens         integer not null default 0 check (listens between 0 and 100000),
  leitner_actions smallint not null default 0 check (leitner_actions >= 0),          -- analytics only
  content_hash    text check (char_length(content_hash) <= 24),
  first_correct_at timestamptz,
  last_attempt_at timestamptz,
  updated_at      timestamptz not null default now(),
  primary key (user_id, sentence_id)
);
create index if not exists story_sentence_progress_story_idx on public.story_sentence_progress (user_id, story_id, sentence_order);

create table if not exists public.app_flags (
  key   text primary key check (char_length(key) <= 60),
  value jsonb not null default 'true'::jsonb,
  updated_at timestamptz not null default now()
);

-- Beta monitoring: insert-only client events, no text content, no personal data beyond the user id
create table if not exists public.dictation_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event       text not null check (event in ('audio_fallback', 'audio_failed', 'save_failed', 'content_load_failed')),
  mode        text check (mode in ('A', 'B', 'C')),
  sentence_id text check (char_length(sentence_id) <= 40),
  detail      text check (char_length(detail) <= 120),          -- for example 'A->B', 'http_404', 'NotAllowedError'
  client      text check (char_length(client) <= 60),           -- coarse browser family, no full user agent
  created_at  timestamptz not null default now()
);
```

Status meaning: `heard` (played, nothing submitted), `attempted` (submitted at least once, still being worked on),
`moved` (left with mistakes via Next), `skipped` ("I didn't get it"), `correct` (an exact match was submitted).
**Finished** = `moved`, `skipped` or `correct`. Absence of a row means the sentence is new. Rank for merging:
`heard` 1, `attempted` 2, `moved` 3, `skipped` 3, `correct` 4 (function `dictation_status_rank`).

## RLS

- `story_progress`, `story_sentence_progress`: RLS on; `select`, `insert` and `update` policies
  `auth.uid() = user_id and (select public.is_active_user())` (the same predicate as `cards`). No delete policy
  (rows go away with the account through `on delete cascade`, including the admin delete path).
- Grants: `revoke all ... from anon`; `grant select, insert, update ... to authenticated`.
- `app_flags`: RLS on, one `select` policy for `authenticated` (`using (true)`), no write policies (the owner edits it
  in the SQL editor).
- `dictation_events`: RLS on, an `insert` policy for own rows (`auth.uid() = user_id`), **no select policy** (the owner
  reads it in the SQL editor), a `before insert` trigger that caps each user at 2,000 rows, and the client sends events
  at most once per type per sentence per session. The owner prunes it with a documented `delete ... where created_at < now() - interval '60 days'`.
- Size and abuse limits in the style of `limit_cards_per_user`: a `before insert` trigger caps
  `story_sentence_progress` at 20,000 rows per user (10 stories hold about 5,000 sentences), and the RPC rejects
  batches above 500 rows.

## The save function (monotonic merge)

Client writes go through one `security invoker` function (so RLS still applies), never raw upserts:

```sql
create or replace function public.save_dictation_progress(p_story jsonb, p_sentences jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if jsonb_array_length(p_sentences) > 500 then raise exception 'batch too large'; end if;
  insert into public.story_sentence_progress as t (user_id, story_id, sentence_id, sentence_order, status, attempts,
         mistakes, skips, listens, leitner_actions, content_hash, first_correct_at, last_attempt_at, updated_at)
  select auth.uid(), r.story_id, r.sentence_id, r.sentence_order, r.status, r.attempts, r.mistakes, r.skips,
         r.listens, r.leitner_actions, r.content_hash, r.first_correct_at, r.last_attempt_at, now()
    from jsonb_to_recordset(p_sentences) as r(story_id text, sentence_id text, sentence_order int, status text,
         attempts int, mistakes int, skips int, listens int, leitner_actions int, content_hash text,
         first_correct_at timestamptz, last_attempt_at timestamptz)
  on conflict (user_id, sentence_id) do update set
    status       = case when public.dictation_status_rank(excluded.status) >= public.dictation_status_rank(t.status)
                        then excluded.status else t.status end,
    attempts     = greatest(t.attempts, excluded.attempts),
    mistakes     = greatest(t.mistakes, excluded.mistakes),
    skips        = greatest(t.skips, excluded.skips),
    listens      = greatest(t.listens, excluded.listens),
    leitner_actions = greatest(t.leitner_actions, excluded.leitner_actions),
    first_correct_at = least(t.first_correct_at, excluded.first_correct_at),   -- least() ignores NULLs
    last_attempt_at  = greatest(t.last_attempt_at, excluded.last_attempt_at),
    content_hash = excluded.content_hash,
    updated_at   = now();
  -- plus an upsert of the story_progress summary row from p_story, with greatest() on finished_count
end $$;
```

Why `greatest` and not addition: the client sends **absolute** totals (server baseline plus local increments), so a
retry after a lost response writes the same numbers again (**idempotent**), and two devices cannot double count. The
accepted cost: increments made on two devices at the same moment can lose one device's increments (counters are
analytics, not scores). Status and finished counts never go backwards.

## Settings keys (in `profiles.settings`, all optional)

| Key | Values | Default when unset |
|---|---|---|
| `dictationAudioMode` | the string A, B or C | A |
| `dictationGrammarOpen` | boolean | viewport based (open at 1024 px and above) |
| `dictationIntroSeen` | boolean | false (shows the one-time Beta explainer) |

`AppSettings` in `src/types/leitner.ts` gets three optional fields; `DEFAULT_SETTINGS` stays unchanged, exactly as
`language` and `overdueRuleSeen` were added. Old rows lack the keys and keep working; the 16 KB check on
`profiles.settings` is nowhere near reached. Backup export and import (`SettingsBackupModal`) carry the settings keys
along and ignore unknown keys; dictation **progress is not part of the JSON backup in v1** (Open Question 11).

## Client persistence (new service `dictationSync`)

Same design as `cloudSync` (`src/services/cloudSync.ts`): an in-memory map of dirty rows, persisted to
`daf_dictation_queue_<uid>` in localStorage, debounced flush after 800 ms, flush on `visibilitychange: hidden` and on
`online`, retry with backoff from 2 s to 60 s, status reported on the existing sync dot. On start it loads the user's
rows for published stories (at most about 1,000 rows for two stories, paged by 1,000 like cards) and merges them with the
local cache (rank and `greatest`, same as the server). Demo mode keeps everything in localStorage
(`daf_dictation_demo`) and never builds a Supabase call.

Drafts (`daf_dictation_draft_<uid>_<sentenceId>`): `{ text, hash, ts }`, written on a 400 ms debounce, deleted when the
sentence finishes, ignored when `hash` differs from the sentence's current hash, capped at 20 entries (oldest removed).

## Content change after a user has progress

| Change | What happens to progress |
|---|---|
| Typo fix in a finished sentence (same id, new hash) | Status kept, the new text is shown in history, row `content_hash` updated on next write |
| Edit of the current or a future sentence | Draft for the old hash is discarded; the learner just types the new text |
| Sentence inserted | New id, no progress row, appears as new at its position; frontier is recomputed (first unfinished sentence), so the learner may be sent back to it |
| Sentence removed (id retired) | Row stays (harmless); history skips it; counts use only existing ids |
| Sequence reordered or split | Progress is by sentence id, so it follows the sentences |
| Whole story rewritten (new `story_id`) | Treated as a new story; the old one disappears from the list |

The story JSON carries `contentVersion`; the client compares it with `story_progress.content_version` and, when it differs,
recomputes `finished_count` from the rows against the current ids (a pure function in `progressMerge.ts`, unit-tested).

## Rollback of the database part

The app is rolled back (or the feature disabled with `app_flags`) without touching the DB. The DB objects are inert
without the app. A drop script for the three tables and two functions is kept in the setup document for completeness; it
deletes only dictation progress and is used only if the owner decides to abandon the feature.
