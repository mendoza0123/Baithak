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
