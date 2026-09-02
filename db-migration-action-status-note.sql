-- Baithak Briefs: records who marked an action item done (or reopened it).
--
-- ALREADY APPLIED to project mingqlwwbwnrkyhklpyq (2026-09-02) — record, not something to run.
--
-- action_items.status has been settable since db-migration-set-action-status.sql, but silently
-- -- no record of who. Same idea as meetings.status_reason ("approved in dashboard by <email>"):
-- one free-text note, overwritten on each change, not a full history table. If a real audit trail
-- (every change, not just the latest) is ever needed, that's a bigger addition -- this is
-- deliberately not it.

alter table baithak.action_items add column if not exists status_note text;

-- Adding a third parameter is a new overload, not a replacement -- drop the old shape first or
-- Postgres ends up with two set_action_status functions and an ambiguous call.
drop function if exists baithak.set_action_status(uuid, text);

create or replace function baithak.set_action_status(p_id uuid, p_status text, p_actor text default null)
returns baithak.action_items
language plpgsql
security definer
set search_path to 'baithak', 'public'
as $function$
declare v_row baithak.action_items;
begin
  if p_status not in ('open', 'done') then
    raise exception 'status must be open or done';
  end if;

  update baithak.action_items
     set status = p_status,
         status_note = case
           when p_actor is null then status_note
           when p_status = 'done' then 'marked done by ' || p_actor
           else 'reopened by ' || p_actor
         end
   where id = p_id and status in ('open', 'done')
   returning * into v_row;

  if not found then
    raise exception 'action item not found or not in a settable state (dropped items are not toggled here)';
  end if;

  return v_row;
end
$function$;

grant execute on function baithak.set_action_status(uuid, text, text) to baithak_app;
