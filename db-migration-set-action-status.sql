-- Baithak Briefs: lets the dashboard mark an action item done (and undo it).
--
-- ALREADY APPLIED to project mingqlwwbwnrkyhklpyq (2026-09-01) — kept here as a record, not
-- something that still needs running. baithak_app itself has no DDL rights (by design: it can
-- only SELECT the five tables plus call functions explicitly GRANTed to it), so this went in
-- via the project's Supabase connection, not the app's own DB role.
--
-- Same shape as review_meeting: SECURITY DEFINER, the allowed transitions are the whole check,
-- everything else is rejected. Verified through the app's own restricted role afterwards: the
-- toggle works, an invalid status is rejected, and every other table is still write-blocked.
--
-- Deliberately just open <-> done, not a three-state tracker — add 'in_progress' as another
-- allowed value here (and in lib/queries.ts / components/action-status.tsx) if a checkbox
-- turns out too coarse in practice.

create or replace function baithak.set_action_status(p_id uuid, p_status text)
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

  update baithak.action_items set status = p_status
   where id = p_id and status in ('open', 'done')
   returning * into v_row;

  if not found then
    raise exception 'action item not found or not in a settable state (dropped items are not toggled here)';
  end if;

  return v_row;
end
$function$;

grant execute on function baithak.set_action_status(uuid, text) to baithak_app;
