import Link from "next/link";
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
const TYPE_LABEL: Record<MeetingType, string> = { mis: "MIS", sales: "Sales", other: "Other", unclassified: "Unclassified" };

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
  const filter: ActionFilter = { type: one(sp.type), urgent: view === "open" ? one(sp.urgent) : "", search: one(sp.q) };
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

  return (
    <Shell session={session} active="actions">
      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Same filters, same links — stacked into a permanent rail once there's room for one. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[196px] lg:shrink-0 lg:overflow-y-auto lg:pb-2">
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
            <p className="hidden w-full px-1 pb-1 text-[10.5px] font-semibold tracking-wide uppercase opacity-35 lg:block">
              Type
            </p>
            <Chip
              href={href({ type: null })}
              on={!filter.type}
              label="All types"
              count={view === "open" ? openTotal : doneTotal}
              block
            />
            {TYPES.filter((t) => byType.has(t)).map((t) => (
              <Chip
                key={t}
                href={href({ type: filter.type === t ? null : t })}
                on={filter.type === t}
                label={TYPE_LABEL[t]}
                count={byType.get(t) ?? 0}
                block
              />
            ))}
          </div>

          {view === "open" ? (
            <div className="mb-3 flex flex-wrap gap-1.5 lg:mt-4 lg:flex-col lg:gap-0.5">
              <p className="hidden w-full px-1 pb-1 text-[10.5px] font-semibold tracking-wide uppercase opacity-35 lg:block">
                Urgency
              </p>
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
            <input
              name="q"
              defaultValue={filter.search}
              placeholder="Search task or owner…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none placeholder:opacity-40 focus:border-black/25 lg:py-1.5 lg:text-[12.5px]"
            />
            <button
              type="submit"
              className="rounded-lg border border-black/10 px-3 py-2 text-[14px] font-medium lg:py-1.5 lg:text-[12.5px] lg:hover:bg-black/[0.04]"
            >
              Search
            </button>
          </form>
        </div>

        <div className="lg:min-w-0 lg:flex-1">
          {filtered ? (
            <div className="mb-3 flex items-center justify-between text-[13px] opacity-55">
              <span>
                {items.length} item{items.length === 1 ? "" : "s"}
              </span>
              <Link href={`/actions?view=${view}`} className="underline underline-offset-2">
                Clear filters
              </Link>
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/12 px-4 py-10 text-center text-[14px] opacity-50">
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
                    <summary className="flex items-center gap-2 rounded-lg bg-black/[0.04] px-3 py-2 text-[13px] font-semibold lg:hover:bg-black/[0.07]">
                      <span className="twist text-[9px] opacity-40">▶</span>
                      {dayLabel(g.dateKey)}
                      <span className="ml-auto text-[12px] font-normal whitespace-nowrap opacity-50 tabular-nums">
                        {count} in {g.meetings.length} meeting{g.meetings.length === 1 ? "" : "s"}
                      </span>
                    </summary>

                    <div className="mt-2 mb-1 flex flex-col gap-3">
                      {g.meetings.map(({ meeting, items: meetingItems }) => (
                        <div key={meeting.meeting_id} className="border-l-2 border-black/10 pl-3">
                          <Link
                            href={`/m/${meeting.meeting_id}`}
                            className="mb-1.5 block truncate text-[12.5px] font-medium opacity-70 underline-offset-2 hover:underline"
                          >
                            {meeting.title_en || meeting.title_original || "Untitled"} ·{" "}
                            {timeLabel(meeting.recorded_at)}
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
        </div>

        <OwnerPanel items={items} view={view} hrefFor={(owner) => href({ q: owner || null })} />
      </div>
    </Shell>
  );
}
