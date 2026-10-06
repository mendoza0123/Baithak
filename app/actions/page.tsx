import Link from "next/link";
import { AlertTriangle, ChevronRight, Hourglass } from "lucide-react";
import { Shell } from "@/components/shell";
import { ActionRow } from "@/components/action-row";
import { Chip, chipHref } from "@/components/chip";
import { OwnerPanel } from "@/components/panels";
import { currentSession } from "@/lib/session";
import { dayLabel, isStale, istDateKey, timeLabel } from "@/lib/format";
import {
  actionStatusCounts,
  actionTypeCounts,
  actionUrgentCounts,
  completedActions,
  openActions,
  type ActionFilter,
  type ActionWithMeeting,
  type MeetingType,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const TYPES: MeetingType[] = ["mis", "sales", "other", "unclassified"];
const TYPE_LABEL: Record<MeetingType, string> = {
  mis: "MIS",
  sales: "Sales",
  other: "Other",
  unclassified: "Unclassified",
};
const SWATCH: Record<MeetingType, string> = {
  mis: "bg-series-1",
  sales: "bg-series-2",
  other: "bg-series-3",
  unclassified: "bg-series-0",
};

/** openActions caps at 400, completedActions at 200 — disclosed, not silent. */
const CAP = { open: 400, done: 200 } as const;

function one(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v) || "";
}

/** date -> meeting -> its items, both levels newest-meeting-first. Grouped in JS rather than
 * SQL: it's a display reshape of an already-fetched, already-filtered list, not a new query. */
function groupByDateAndMeeting(items: ActionWithMeeting[]) {
  const dates = new Map<string, Map<string, { meeting: ActionWithMeeting; items: ActionWithMeeting[] }>>();

  for (const a of items) {
    const dateKey = istDateKey(a.recorded_at);
    if (!dates.has(dateKey)) dates.set(dateKey, new Map());
    const meetings = dates.get(dateKey)!;
    if (!meetings.has(a.meeting_id)) meetings.set(a.meeting_id, { meeting: a, items: [] });
    meetings.get(a.meeting_id)!.items.push(a);
  }

  return [...dates.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([dateKey, meetings]) => ({
      dateKey,
      meetings: [...meetings.values()].sort(
        (a, b) => +new Date(b.meeting.recorded_at) - +new Date(a.meeting.recorded_at),
      ),
    }));
}

export default async function ActionsPage({ searchParams }: PageProps<"/actions">) {
  const sp = await searchParams;
  const view = one(sp.view) === "done" ? "done" : "open";
  const filter: ActionFilter = {
    type: one(sp.type),
    urgent: view === "open" ? one(sp.urgent) : "",
    search: one(sp.q),
  };
  // Params that survive a chip toggle: never urgent when switching to Completed (it doesn't apply there).
  const carry: Record<string, string> = {
    ...(filter.type && { type: filter.type }),
    ...(view === "open" && filter.urgent && { urgent: filter.urgent }),
    ...(filter.search && { q: filter.search }),
  };
  const href = (patch: Record<string, string | null>) => chipHref("/actions", { view, ...carry }, patch);

  const [session, items, statusCount, typeCount, urgentCount] = await Promise.all([
    currentSession(),
    view === "open" ? openActions(filter) : completedActions(filter),
    actionStatusCounts(),
    actionTypeCounts(view),
    actionUrgentCounts(),
  ]);

  const openTotal = statusCount.find((c) => c.status === "open")?.count ?? 0;
  const doneTotal = statusCount.find((c) => c.status === "done")?.count ?? 0;
  const byType = new Map(typeCount.map((t) => [t.meeting_type, t.count]));
  const filtered = Boolean(filter.type || filter.urgent || filter.search);
  const groups = groupByDateAndMeeting(items);
  const capped = items.length === CAP[view];
  const viewTotal = view === "open" ? openTotal : doneTotal;

  return (
    <Shell session={session} active="actions">
      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Same filters, same links — stacked into a permanent rail once there's room for one. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[204px] lg:shrink-0 lg:overflow-y-auto lg:pb-2">
          <div className="-mx-4 mb-3 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <div className="flex w-max gap-1.5 lg:w-full lg:flex-col lg:gap-0.5">
              <Chip href={chipHref("/actions", carry, {})} on={view === "open"} label="Open" count={openTotal} block />
              <Chip
                href={chipHref("/actions", carry, { view: "done", urgent: null })}
                on={view === "done"}
                label="Completed"
                count={doneTotal}
                block
              />
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5 lg:mt-4 lg:flex-col lg:gap-0.5">
            <p className="eyebrow hidden w-full px-1 pb-1 lg:block">Type</p>
            <Chip href={href({ type: null })} on={!filter.type} label="All types" count={viewTotal} block />
            {TYPES.filter((t) => byType.has(t)).map((t) => (
              <Chip
                key={t}
                href={href({ type: filter.type === t ? null : t })}
                on={filter.type === t}
                label={TYPE_LABEL[t]}
                count={byType.get(t) ?? 0}
                swatch={SWATCH[t]}
                block
              />
            ))}
          </div>

          {view === "open" ? (
            <div className="mb-3 flex flex-wrap gap-1.5 lg:mt-4 lg:flex-col lg:gap-0.5">
              <p className="eyebrow hidden w-full px-1 pb-1 lg:block">Urgency</p>
              <Chip
                href={href({ urgent: filter.urgent === "overdue" ? null : "overdue" })}
                on={filter.urgent === "overdue"}
                label="Overdue"
                count={urgentCount.overdue}
                block
              />
              <Chip
                href={href({ urgent: filter.urgent === "high" ? null : "high" })}
                on={filter.urgent === "high"}
                label="High priority"
                count={urgentCount.high}
                block
              />
            </div>
          ) : null}

          <form className="mb-4 flex gap-2 lg:mt-4 lg:mb-0 lg:flex-col lg:gap-1.5">
            <input type="hidden" name="view" value={view} />
            {filter.type ? <input type="hidden" name="type" value={filter.type} /> : null}
            {filter.urgent ? <input type="hidden" name="urgent" value={filter.urgent} /> : null}
            <label htmlFor="q" className="sr-only">
              Search task or owner
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filter.search}
              placeholder="Search task or owner…"
              autoComplete="off"
              className="min-h-10 min-w-0 flex-1 rounded-control border border-strong bg-surface px-3 text-body text-ink outline-none placeholder:text-ink-3 focus:border-accent"
            />
            <button
              type="submit"
              className="min-h-10 rounded-control border border-strong px-3 text-body font-medium text-ink transition-colors lg:text-meta lg:hover:bg-sunken"
            >
              Search
            </button>
          </form>
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          {filtered || capped ? (
            <div className="mb-3 flex items-center justify-between gap-3 text-support text-ink-2">
              <span className="num">
                {capped
                  ? `Showing ${items.length} of ${viewTotal}`
                  : `${items.length} item${items.length === 1 ? "" : "s"}`}
              </span>
              {filtered ? (
                <Link href={`/actions?view=${view}`} className="text-accent underline underline-offset-2">
                  Clear filters
                </Link>
              ) : null}
            </div>
          ) : null}

          {/* The owner-spelling problem, said once where it matters rather than
              implied by a list of near-duplicate names. */}
          {view === "open" && !filtered && items.length > 0 ? (
            <p className="mb-3 flex items-start gap-2 rounded-card border border-warning bg-warning-wash px-3.5 py-2.5 text-meta leading-relaxed text-ink">
              <AlertTriangle size={14} strokeWidth={2.5} className="mt-px shrink-0 text-warning" aria-hidden />
              <span>
                <strong className="font-semibold">Owners are free text.</strong> The pipeline writes
                whatever it heard, so one person can appear under several spellings — treat the owner
                tallies as spellings, not people.
              </span>
            </p>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-card border border-dashed border-strong px-4 py-10 text-center text-body text-ink-2">
              {view === "open" ? "Nothing open." : "Nothing completed yet."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((g, i) => {
                const count = g.meetings.reduce((n, mg) => n + mg.items.length, 0);
                return (
                  <details
                    key={g.dateKey}
                    // Filtering is itself a request to see the matches, so don't make them click
                    // twice. Unfiltered, only the newest day opens — the rest is 200+ items of scroll.
                    open={filtered || i === 0}
                  >
                    <summary className="flex min-h-11 items-center gap-2 rounded-control bg-sunken px-3 text-support font-semibold text-ink lg:hover:bg-subtle">
                      <ChevronRight size={13} strokeWidth={3} className="twist text-ink-3" aria-hidden />
                      {dayLabel(g.dateKey)}
                      <span className="num ml-auto text-meta font-normal whitespace-nowrap text-ink-2">
                        {count} in {g.meetings.length} meeting{g.meetings.length === 1 ? "" : "s"}
                      </span>
                    </summary>

                    <div className="mt-2 mb-1 flex flex-col gap-3">
                      {g.meetings.map(({ meeting, items: meetingItems }) => (
                        <div key={meeting.meeting_id} className="border-l-2 border-subtle pl-3">
                          <Link
                            href={`/m/${meeting.meeting_id}`}
                            className="mb-1.5 flex items-center gap-2 truncate text-meta font-medium text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                          >
                            <span className={`size-2 shrink-0 rounded-[2px] ${SWATCH[meeting.meeting_type]}`} aria-hidden />
                            {meeting.title_en || meeting.title_original || "Untitled"} ·{" "}
                            <span className="num">{timeLabel(meeting.recorded_at)}</span>
                          </Link>
                          {/* One column on a phone, two or three once the window is wide enough —
                              the same <li> elements either way. */}
                          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:items-start xl:grid-cols-3">
                            {meetingItems.map((a) => (
                              <li key={a.id}>
                                <ActionRow
                                  a={a}
                                  interactive
                                  stale={view === "open" && isStale(a.recorded_at)}
                                  type={filter.type ? undefined : a.meeting_type}
                                />
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          {view === "open" && !filtered && urgentCount.high > 0 ? (
            <p className="mt-4 flex items-center gap-2 text-meta text-ink-3">
              <Hourglass size={12} strokeWidth={2.5} aria-hidden />
              {urgentCount.high} marked high priority ·{" "}
              <Link href="/actions?urgent=high" className="text-accent underline underline-offset-2">
                show only those
              </Link>
            </p>
          ) : null}
        </div>

        <OwnerPanel items={items} view={view} hrefFor={(owner) => href({ q: owner || null })} />
      </div>
    </Shell>
  );
}
