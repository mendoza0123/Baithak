-- Baithak Briefs: the freshness bar's data source.
--
-- ALREADY APPLIED to project mingqlwwbwnrkyhklpyq (2026-09-04) — record, not something to run.
--
-- The dashboard only has SELECT here. The scheduled "Baithak Plaud Sync" job is what writes
-- this, and it does not do so yet — until it does, last_run_at stays null and the bar falls
-- back to max(meetings.created_at), which is a true "when did data last arrive" either way.
--
-- For the sync job to start reporting, it needs one statement at the end of each run:
--
--   insert into baithak.sync_state
--     (source, last_run_at, last_run_status, last_run_note,
--      last_synced_at, recordings_seen, recordings_new, updated_at)
--   values ('plaud', now(), 'ok', null, now(), <seen>, <new>, now())
--   on conflict (source) do update set
--     last_run_at     = excluded.last_run_at,
--     last_run_status = excluded.last_run_status,
--     last_run_note   = excluded.last_run_note,
--     last_synced_at  = excluded.last_synced_at,
--     recordings_seen = excluded.recordings_seen,
--     recordings_new  = excluded.recordings_new,
--     updated_at      = now();

create table if not exists baithak.sync_state (
  source           text primary key,
  last_run_at      timestamptz,
  last_run_status  text check (last_run_status in ('ok', 'partial', 'error')),
  last_run_note    text,
  last_synced_at   timestamptz,
  recordings_seen  int,
  recordings_new   int,
  updated_at       timestamptz not null default now()
);

comment on table baithak.sync_state is
  'One row per sync source. The dashboard reads this for its freshness bar; the scheduled Plaud sync job is what writes it.';

-- Seeded so the dashboard always gets a row back and can distinguish "never run"
-- (last_run_at is null) from "no such source".
insert into baithak.sync_state (source) values ('plaud') on conflict (source) do nothing;

grant select on baithak.sync_state to baithak_app;
