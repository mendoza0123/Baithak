import { q } from "./db";

export type Status =
  | "discovered"
  | "pending_transcript"
  | "summarising"
  | "awaiting_approval"
  | "ready"
  | "emailed"
  | "skipped"
  | "failed";

export type MeetingType = "mis" | "sales" | "other" | "unclassified";

export type MeetingRow = {
  id: string;
  title_en: string | null;
  title_original: string | null;
  meeting_type: MeetingType;
  status: Status;
  status_reason: string | null;
  recorded_at: Date;
  duration_sec: number | null;
  sensitive: boolean;
  gist: string | null;
  open_actions: number;
};

export type TranscriptSegment = {
  start_ms?: number;
  end_ms?: number;
  speaker?: string;
  text?: string;
};

export type DiscussionPoint = {
  topic?: string;
  summary?: string;
  details?: string[];
  metrics?: string[];
};

export type Brief = {
  executive_summary?: string;
  participants?: { label?: string; inferred_name?: string; role?: string }[];
  quality_notes?: string;
  decisions?: string[];
  open_issues?: string[];
  next_meeting_agenda?: string[];
  discussion_points?: DiscussionPoint[];
};

export type MeetingDetail = MeetingRow & {
  sensitivity_reason: string | null;
  plaud_summary_md: string | null;
  transcript: TranscriptSegment[] | null;
  summary_md: string | null;
  brief: Brief | null;
  version: number | null;
  model: string | null;
  prompt_version: string | null;
  summarised_at: Date | null;
  /** When Plaud's cloud first had the file — the pipeline copies Plaud's own created_at here. */
  synced_at: Date | null;
  /** When this row was inserted, i.e. when the pipeline first discovered the recording. */
  discovered_at: Date | null;
};

export type ActionItem = {
  id: string;
  meeting_id: string;
  description: string;
  owner: string | null;
  due_date: string | null;
  priority: "high" | "normal";
  status: "open" | "done" | "dropped";
  source_ms: number | null;
  status_note: string | null;
};

export type ActionWithMeeting = ActionItem & {
  title_en: string | null;
  title_original: string | null;
  recorded_at: Date;
  meeting_type: MeetingType;
};

export type ActionFilter = {
  type?: string;
  /** "overdue" (past due_date) or "high" (priority = high). Open-view only — see the page. */
  urgent?: string;
  search?: string;
};

// Latest brief for a meeting; left join so meetings the pipeline hasn't summarised yet still show up.
const LATEST_SUMMARY = `
  left join lateral (
    select * from baithak.summaries s
    where s.meeting_id = m.id order by s.version desc limit 1
  ) s on true`;

export function listMeetings(filter: { status?: string; type?: string; search?: string }) {
  return q<MeetingRow>(
    `select m.id, m.title_en, m.title_original, m.meeting_type, m.status, m.status_reason,
            m.recorded_at, m.duration_sec, m.sensitive,
            s.brief->>'executive_summary' as gist,
            (select count(*)::int from baithak.action_items a
              where a.meeting_id = m.id and a.status = 'open') as open_actions
     from baithak.meetings m ${LATEST_SUMMARY}
     where ($1::text is null or m.status::text = $1)
       and ($2::text is null or m.meeting_type::text = $2)
       and ($3::text is null or
            coalesce(m.title_en, '') || ' ' || coalesce(m.title_original, '') ilike '%' || $3 || '%')
     order by m.recorded_at desc
     limit 100`,
    [filter.status || null, filter.type || null, filter.search || null],
  );
}

export function statusCounts() {
  return q<{ status: Status; count: number }>(
    `select status, count(*)::int as count from baithak.meetings group by status`,
  );
}

export function typeCounts() {
  return q<{ meeting_type: MeetingType; count: number }>(
    `select meeting_type, count(*)::int as count from baithak.meetings group by meeting_type`,
  );
}

export async function getMeeting(id: string) {
  const rows = await q<MeetingDetail>(
    `select m.id, m.title_en, m.title_original, m.meeting_type, m.status, m.status_reason,
            m.recorded_at, m.duration_sec, m.sensitive, m.sensitivity_reason,
            m.plaud_summary_md, m.transcript,
            m.synced_at, m.created_at as discovered_at,
            s.summary_md, s.brief, s.version, s.model, s.prompt_version,
            s.created_at as summarised_at,
            s.brief->>'executive_summary' as gist,
            0 as open_actions
     from baithak.meetings m ${LATEST_SUMMARY}
     where m.id = $1::uuid`,
    [id],
  );
  return rows[0] ?? null;
}

export function meetingActions(id: string) {
  return q<ActionItem>(
    `select id, meeting_id, description, owner,
            to_char(due_date, 'YYYY-MM-DD') as due_date,
            priority, status, source_ms, status_note
     from baithak.action_items
     where meeting_id = $1::uuid
     order by (status = 'open') desc, priority = 'high' desc, due_date nulls last`,
    [id],
  );
}

// Shared by openActions/completedActions — type, urgency and a description+owner search, each
// only applied when set. $1 is injected by the caller (the status to match).
const ACTION_FILTER_WHERE = `
  and ($2::text is null or m.meeting_type::text = $2)
  and ($3::text is null or
       ($3 = 'overdue' and a.due_date < current_date and a.status = 'open')
       or ($3 = 'high' and a.priority = 'high'))
  and ($4::text is null or
       coalesce(a.description, '') || ' ' || coalesce(a.owner, '') ilike '%' || $4 || '%')`;

const ACTION_SELECT = `
  select a.id, a.meeting_id, a.description, a.owner,
         to_char(a.due_date, 'YYYY-MM-DD') as due_date,
         a.priority, a.status, a.source_ms, a.status_note,
         m.title_en, m.title_original, m.recorded_at, m.meeting_type
  from baithak.action_items a
  join baithak.meetings m on m.id = a.meeting_id
  where a.status = $1`;

export type SyncState = {
  last_run_at: Date | null;
  last_run_status: "ok" | "partial" | "error" | null;
  last_run_note: string | null;
  last_synced_at: Date | null;
  recordings_seen: number | null;
  recordings_new: number | null;
  /** Fallbacks, always present — see freshness() for why they exist. */
  newest_row_at: Date | null;
  processing: number;
};

/**
 * The header freshness bar. sync_state is written by the scheduled Plaud sync, not by this app
 * (it only has SELECT there) — so until that job starts writing, last_run_at is null and the bar
 * falls back to newest_row_at: the most recent row the pipeline actually inserted, which is a
 * true "when did data last arrive" even with nothing reporting its own runs.
 */
export async function freshness() {
  const rows = await q<SyncState>(
    `select ss.last_run_at, ss.last_run_status, ss.last_run_note, ss.last_synced_at,
            ss.recordings_seen, ss.recordings_new,
            (select max(created_at) from baithak.meetings) as newest_row_at,
            (select count(*)::int from baithak.meetings
              where status in ('pending_transcript', 'summarising')) as processing
     from baithak.sync_state ss
     where ss.source = 'plaud'`,
  );
  return rows[0] ?? null;
}

/** Counts for the Open/Completed tabs. */
export function actionStatusCounts() {
  return q<{ status: "open" | "done"; count: number }>(
    `select status, count(*)::int as count from baithak.action_items
     where status in ('open', 'done') group by status`,
  );
}

/** Type-chip counts, independent of whatever filter is currently active — same pattern as
 * the Meetings page's statusCounts/typeCounts, so chip numbers don't shift confusingly as
 * you filter. */
export function actionTypeCounts(status: "open" | "done") {
  return q<{ meeting_type: MeetingType; count: number }>(
    `select m.meeting_type, count(*)::int as count
     from baithak.action_items a join baithak.meetings m on m.id = a.meeting_id
     where a.status = $1 group by m.meeting_type`,
    [status],
  );
}

/** Open items only — "urgent" isn't a concept that applies to completed work. */
export function actionUrgentCounts() {
  return q<{ overdue: number; high: number }>(
    `select count(*) filter (where due_date < current_date)::int as overdue,
            count(*) filter (where priority = 'high')::int as high
     from baithak.action_items where status = 'open'`,
  ).then((rows) => rows[0] ?? { overdue: 0, high: 0 });
}

/**
 * Dated vs undated, open items only. Only 35 of 279 items carry a due_date, which is why
 * "overdue" can structurally only ever describe a tenth of the backlog — the Today screen
 * says so out loud rather than letting the overdue number imply full coverage.
 */
export async function actionDateCoverage() {
  const rows = await q<{ dated: number; undated: number }>(
    `select count(*) filter (where due_date is not null)::int as dated,
            count(*) filter (where due_date is null)::int as undated
     from baithak.action_items where status = 'open'`,
  );
  return rows[0] ?? { dated: 0, undated: 0 };
}

export type AgeBuckets = { d7: number; d14: number; d30: number; d60: number; older: number };

/**
 * How old the open backlog is, measured from the meeting rather than from a due date —
 * the one staleness signal that covers all of it. Same idea as isStale() in lib/format,
 * done in SQL so the whole distribution comes back as one row instead of 279.
 */
export async function actionAgeBuckets() {
  const rows = await q<AgeBuckets>(
    `select count(*) filter (where days <= 7)::int                 as d7,
            count(*) filter (where days > 7  and days <= 14)::int  as d14,
            count(*) filter (where days > 14 and days <= 30)::int  as d30,
            count(*) filter (where days > 30 and days <= 60)::int  as d60,
            count(*) filter (where days > 60)::int                 as older
     from (
       select extract(epoch from (now() - m.recorded_at)) / 86400 as days
       from baithak.action_items a
       join baithak.meetings m on m.id = a.meeting_id
       where a.status = 'open'
     ) t`,
  );
  return rows[0] ?? { d7: 0, d14: 0, d30: 0, d60: 0, older: 0 };
}

export type CadenceCell = { week: string; dow: number; n: number };

/**
 * Meetings per IST weekday over the last eight weeks, for the cadence heatmap. Bucketed in
 * the database at `Asia/Kolkata` rather than in JS, so a 23:30 IST recording lands on the day
 * the team had it and not on whatever UTC day the server was in.
 */
export function meetingCadence() {
  return q<CadenceCell>(
    `select to_char(date_trunc('week', (m.recorded_at at time zone 'Asia/Kolkata')), 'YYYY-MM-DD') as week,
            extract(isodow from (m.recorded_at at time zone 'Asia/Kolkata'))::int as dow,
            count(*)::int as n
     from baithak.meetings m
     where m.recorded_at >= now() - interval '8 weeks'
     group by 1, 2
     order by 1, 2`,
  );
}

export function openActions(filter: ActionFilter = {}) {
  return q<ActionWithMeeting>(
    `${ACTION_SELECT} ${ACTION_FILTER_WHERE}
     order by a.due_date nulls last, m.recorded_at desc
     limit 400`,
    ["open", filter.type || null, filter.urgent || null, filter.search || null],
  );
}

/** Most recently changed first — that's "what did we just finish," not meeting order. */
export function completedActions(filter: Omit<ActionFilter, "urgent"> = {}) {
  return q<ActionWithMeeting>(
    `${ACTION_SELECT} ${ACTION_FILTER_WHERE}
     order by a.updated_at desc
     limit 200`,
    ["done", filter.type || null, null, filter.search || null],
  );
}

/* ============================================================================
   The MD tab (/md). Week-scoped reads over the same four tables — no schema
   change, no new grants.
   ============================================================================ */

/**
 * An IST week is [weekStart 00:00, weekStart+7 00:00) in Asia/Kolkata, bucketed in the
 * database rather than in JS so a 23:30 IST recording lands on the day the team had it.
 * `$1` is a 'YYYY-MM-DD' Monday from istWeekStart() / shiftWeek().
 */
const IST_WEEK = `
  m.recorded_at >= ($1::date)::timestamp at time zone 'Asia/Kolkata'
  and m.recorded_at < (($1::date) + 7)::timestamp at time zone 'Asia/Kolkata'`;

export type WeekMeeting = MeetingRow & {
  /** A brief exists for the latest summary version — not just a summaries row. */
  briefed: boolean;
  decisions: number;
  issues: number;
};

/** Every meeting recorded in one IST week, with whether its brief landed. */
export function weekMeetings(weekStart: string) {
  return q<WeekMeeting>(
    `select m.id, m.title_en, m.title_original, m.meeting_type, m.status, m.status_reason,
            m.recorded_at, m.duration_sec, m.sensitive,
            s.brief->>'executive_summary' as gist,
            (s.summary_md is not null) as briefed,
            coalesce(jsonb_array_length(
              case when jsonb_typeof(s.brief->'decisions') = 'array'
                   then s.brief->'decisions' else '[]'::jsonb end), 0) as decisions,
            coalesce(jsonb_array_length(
              case when jsonb_typeof(s.brief->'open_issues') = 'array'
                   then s.brief->'open_issues' else '[]'::jsonb end), 0) as issues,
            (select count(*)::int from baithak.action_items a
              where a.meeting_id = m.id and a.status = 'open') as open_actions
     from baithak.meetings m ${LATEST_SUMMARY}
     where ${IST_WEEK}
     order by m.recorded_at`,
    [weekStart],
  );
}

export type Takeaway = {
  meeting_id: string;
  title_en: string | null;
  title_original: string | null;
  recorded_at: Date;
  meeting_type: MeetingType;
  kind: "decision" | "issue" | "agenda";
  text: string;
};

/**
 * Every decision, open issue and next-agenda line from the week's briefs, flattened.
 *
 * The pipeline already writes these into `summaries.brief`; this just unnests them so the
 * week reads as one list instead of one meeting at a time. The jsonb_typeof guard matters —
 * jsonb_array_elements_text() raises on a non-array, and `brief` is model output.
 */
export function weekTakeaways(weekStart: string) {
  return q<Takeaway>(
    `select m.id as meeting_id, m.title_en, m.title_original, m.recorded_at, m.meeting_type,
            k.kind, k.text
     from baithak.meetings m
     join lateral (
       select * from baithak.summaries s
       where s.meeting_id = m.id order by s.version desc limit 1
     ) s on true
     cross join lateral (
       select 'decision' as kind, jsonb_array_elements_text(
         case when jsonb_typeof(s.brief->'decisions') = 'array'
              then s.brief->'decisions' else '[]'::jsonb end) as text
       union all
       select 'issue', jsonb_array_elements_text(
         case when jsonb_typeof(s.brief->'open_issues') = 'array'
              then s.brief->'open_issues' else '[]'::jsonb end)
       union all
       select 'agenda', jsonb_array_elements_text(
         case when jsonb_typeof(s.brief->'next_meeting_agenda') = 'array'
              then s.brief->'next_meeting_agenda' else '[]'::jsonb end)
     ) k
     where ${IST_WEEK}
     order by m.recorded_at desc
     limit 200`,
    [weekStart],
  );
}

/** Every action item raised in the week's meetings, open first. */
export function weekActions(weekStart: string) {
  return q<ActionWithMeeting>(
    `select a.id, a.meeting_id, a.description, a.owner,
            to_char(a.due_date, 'YYYY-MM-DD') as due_date,
            a.priority, a.status, a.source_ms, a.status_note,
            m.title_en, m.title_original, m.recorded_at, m.meeting_type
     from baithak.action_items a
     join baithak.meetings m on m.id = a.meeting_id
     where ${IST_WEEK}
     order by (a.status = 'open') desc, a.priority = 'high' desc,
              a.due_date nulls last, m.recorded_at desc
     limit 400`,
    [weekStart],
  );
}

export type FlowWeek = { week: string; opened: number; closed: number };

/**
 * Commitments opened vs closed, per IST week, over a trailing window.
 *
 * "Opened" is dated from the *meeting*, not from a row timestamp: a commitment is made when
 * it is said out loud, and action_items has no column that reliably records insertion anyway.
 * "Closed" uses updated_at, which is what the toggle touches — the same column completedActions
 * already orders by.
 *
 * The gap between the two lines is the backlog growing or shrinking, which is the one number
 * that says whether the meetings are working.
 */
export function commitmentFlow(weeks = 12) {
  return q<FlowWeek>(
    `with wk as (
       select generate_series(
         date_trunc('week', (now() at time zone 'Asia/Kolkata')) - (($1::int - 1) * interval '1 week'),
         date_trunc('week', (now() at time zone 'Asia/Kolkata')),
         interval '1 week'
       )::date as w
     )
     select to_char(wk.w, 'YYYY-MM-DD') as week,
            (select count(*)::int
               from baithak.action_items a
               join baithak.meetings m on m.id = a.meeting_id
              where date_trunc('week', (m.recorded_at at time zone 'Asia/Kolkata'))::date = wk.w) as opened,
            (select count(*)::int
               from baithak.action_items a
              where a.status = 'done'
                and date_trunc('week', (a.updated_at at time zone 'Asia/Kolkata'))::date = wk.w) as closed
     from wk
     order by wk.w`,
    [weeks],
  );
}

/**
 * The only write this app makes. set_action_status is a SECURITY DEFINER function on
 * baithak_app's grant list — the database enforces which transitions are legal, this is
 * just the call. `actor` becomes "marked done by <email>" / "reopened by <email>" in
 * status_note — same idea as review_meeting's "approved in dashboard by <email>", one
 * latest-note field, not a full history. Requires db-migration-action-status-note.sql.
 */
export async function setActionStatus(id: string, status: "open" | "done", actor: string) {
  const rows = await q<ActionItem>(
    `select (baithak.set_action_status($1::uuid, $2, $3)).*`,
    [id, status, actor],
  );
  return rows[0] ?? null;
}
