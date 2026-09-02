import Link from "next/link";
import { Shell } from "@/components/shell";
import { ActionRow } from "@/components/action-row";
import { Chip, chipHref } from "@/components/chip";
import { currentSession } from "@/lib/session";
import { ist, isStale } from "@/lib/format";
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

  return (
    <Shell session={session} active="actions">
      <div className="-mx-4 mb-3 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          <Chip href={chipHref("/actions", carry, {})} on={view === "open"} label="Open" count={openTotal} />
          <Chip
            href={chipHref("/actions", carry, { view: "done", urgent: null })}
            on={view === "done"}
            label="Completed"
            count={doneTotal}
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <Chip
          href={href({ type: null })}
          on={!filter.type}
          label="All types"
          count={view === "open" ? openTotal : doneTotal}
        />
        {TYPES.filter((t) => byType.has(t)).map((t) => (
          <Chip
            key={t}
            href={href({ type: filter.type === t ? null : t })}
            on={filter.type === t}
            label={TYPE_LABEL[t]}
            count={byType.get(t) ?? 0}
          />
        ))}
      </div>

      {view === "open" ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Chip
            href={href({ urgent: filter.urgent === "overdue" ? null : "overdue" })}
            on={filter.urgent === "overdue"}
            label="Overdue"
            count={urgentCount.overdue}
          />
          <Chip
            href={href({ urgent: filter.urgent === "high" ? null : "high" })}
            on={filter.urgent === "high"}
            label="High priority"
            count={urgentCount.high}
          />
        </div>
      ) : null}

      <form className="mb-4 flex gap-2">
        <input type="hidden" name="view" value={view} />
        {filter.type ? <input type="hidden" name="type" value={filter.type} /> : null}
        {filter.urgent ? <input type="hidden" name="urgent" value={filter.urgent} /> : null}
        <input
          name="q"
          defaultValue={filter.search}
          placeholder="Search task or owner…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none placeholder:opacity-40 focus:border-black/25"
        />
        <button type="submit" className="rounded-lg border border-black/10 px-3 py-2 text-[14px] font-medium">
          Search
        </button>
      </form>

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
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <li key={a.id}>
              <ActionRow
                a={a}
                interactive
                stale={view === "open" && isStale(a.recorded_at)}
                type={filter.type ? undefined : a.meeting_type}
                footer={<MeetingLink a={a} />}
              />
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function MeetingLink({ a }: { a: ActionWithMeeting }) {
  return (
    <Link
      href={`/m/${a.meeting_id}`}
      className="mt-2 block truncate text-[12px] opacity-45 underline underline-offset-2 hover:opacity-100"
    >
      {a.title_en || a.title_original || "Untitled"} · {ist(a.recorded_at)}
    </Link>
  );
}
