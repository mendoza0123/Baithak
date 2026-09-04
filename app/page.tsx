import Link from "next/link";
import { Shell } from "@/components/shell";
import { StatusBadge, TypeBadge, statusLabel } from "@/components/badges";
import { Chip, chipHref } from "@/components/chip";
import { CommandDeck } from "@/components/panels";
import { currentSession } from "@/lib/session";
import { ist, mins } from "@/lib/format";
import {
  actionUrgentCounts,
  listMeetings,
  openActions,
  statusCounts,
  typeCounts,
  type MeetingRow,
  type Status,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const STATUS_ORDER: Status[] = [
  "awaiting_approval",
  "ready",
  "emailed",
  "summarising",
  "pending_transcript",
  "discovered",
  "failed",
  "skipped",
];

const TYPES = ["mis", "sales", "other", "unclassified"] as const;
const href = (current: Record<string, string>, patch: Record<string, string | null>) =>
  chipHref("/", current, patch);

export default async function MeetingsPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
  const filter = { status: one(sp.status), type: one(sp.type), search: one(sp.q) };
  const active = { ...(filter.status && { status: filter.status }), ...(filter.type && { type: filter.type }), ...(filter.search && { q: filter.search }) };

  const [session, meetings, counts, types, urgent, overdueItems] = await Promise.all([
    currentSession(),
    listMeetings(filter),
    statusCounts(),
    typeCounts(),
    // Two extra counts for the desktop deck. Both are cheap aggregate/indexed reads, and the
    // page is force-dynamic anyway — not worth a second render path to skip them on a phone.
    actionUrgentCounts(),
    openActions({ urgent: "overdue" }),
  ]);

  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  const byType = new Map(types.map((t) => [t.meeting_type, t.count]));
  const total = counts.reduce((n, c) => n + c.count, 0);
  const filtered = Boolean(filter.status || filter.type || filter.search);

  return (
    <Shell session={session} active="meetings">
      {/* One row on a monitor, one column on a phone: the wrappers below are plain blocks until
          `lg`, so the mobile document flows exactly as it did before the desktop layout existed. */}
      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Filters: a scrolling strip on a phone, a permanent left rail on a desktop. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[212px] lg:shrink-0 lg:overflow-y-auto lg:pb-2">
          <div className="-mx-4 mb-3 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <div className="flex w-max gap-1.5 lg:w-full lg:flex-col lg:gap-0.5">
              <p className="hidden px-1 pb-1 text-[10.5px] font-semibold tracking-wide uppercase opacity-35 lg:block">
                Status
              </p>
              <Chip href={href(active, { status: null })} on={!filter.status} label="All" count={total} block />
              {STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => (
                <Chip
                  key={s}
                  href={href(active, { status: filter.status === s ? null : s })}
                  on={filter.status === s}
                  label={statusLabel(s)}
                  count={byStatus.get(s) ?? 0}
                  block
                />
              ))}
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5 lg:mt-4 lg:flex-col lg:gap-0.5">
            <p className="hidden w-full px-1 pb-1 text-[10.5px] font-semibold tracking-wide uppercase opacity-35 lg:block">
              Type
            </p>
            {TYPES.filter((t) => byType.has(t)).map((t) => (
              <Chip
                key={t}
                href={href(active, { type: filter.type === t ? null : t })}
                on={filter.type === t}
                label={t === "mis" ? "MIS" : t[0].toUpperCase() + t.slice(1)}
                count={byType.get(t) ?? 0}
                block
              />
            ))}
          </div>

          <form className="mb-4 flex gap-2 lg:mt-4 lg:mb-0 lg:flex-col lg:gap-1.5">
            {filter.status ? <input type="hidden" name="status" value={filter.status} /> : null}
            {filter.type ? <input type="hidden" name="type" value={filter.type} /> : null}
            <input
              name="q"
              defaultValue={filter.search}
              placeholder="Search titles…"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none placeholder:opacity-40 focus:border-black/25 lg:py-1.5 lg:text-[12.5px] dark:border-white/12 dark:bg-white/[0.04] dark:focus:border-white/30"
            />
            <button
              type="submit"
              className="rounded-lg border border-black/10 px-3 py-2 text-[14px] font-medium lg:py-1.5 lg:text-[12.5px] lg:hover:bg-black/[0.04] dark:border-white/12"
            >
              Search
            </button>
          </form>
        </div>

        {/* The list itself. */}
        <div className="lg:min-w-0 lg:flex-1">
          {filtered ? (
            <div className="mb-3 flex items-center justify-between text-[13px] opacity-55">
              <span>
                {meetings.length} meeting{meetings.length === 1 ? "" : "s"}
              </span>
              <Link href="/" className="underline underline-offset-2">
                Clear filters
              </Link>
            </div>
          ) : null}

          {meetings.length === 0 ? (
            <p className="rounded-xl border border-dashed border-black/12 px-4 py-10 text-center text-[14px] opacity-50 dark:border-white/12">
              No meetings match.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 lg:gap-1">
              {meetings.map((m) => (
                <li key={m.id}>
                  <MeetingCard m={m} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <CommandDeck
          byStatus={byStatus}
          total={total}
          meetings={meetings}
          overdue={urgent.overdue}
          high={urgent.high}
          overdueItems={overdueItems.slice(0, 5)}
        />
      </div>
    </Shell>
  );
}

function MeetingCard({ m }: { m: MeetingRow }) {
  const duration = mins(m.duration_sec);
  const summarised = Boolean(m.title_en);

  return (
    <Link
      href={`/m/${m.id}`}
      data-nav
      className="block rounded-xl border border-black/8 bg-white p-3.5 transition-colors hover:border-black/20 lg:flex lg:items-start lg:gap-4 lg:p-2.5 lg:hover:border-black/25 lg:hover:shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25"
    >
      <div className="flex items-center gap-2 text-[12px] opacity-50 lg:w-[148px] lg:shrink-0 lg:flex-wrap lg:gap-x-1.5 lg:gap-y-0 lg:pt-px lg:text-[11.5px]">
        <span className="tabular-nums">{ist(m.recorded_at)}</span>
        {duration ? <span className="tabular-nums">· {duration}</span> : null}
        {m.sensitive ? <span className="text-amber-600 dark:text-amber-400">· sensitive</span> : null}
      </div>

      {/* Wrapper is inert on a phone (a plain block inside a plain block) and becomes the middle
          column of the row on a desktop. */}
      <div className="lg:min-w-0 lg:flex-1">
        <h2 className="mt-1 text-[15px] leading-snug font-medium lg:mt-0 lg:text-[13.5px]">
          {m.title_en || m.title_original || "Untitled recording"}
        </h2>

        {!summarised && m.title_original ? (
          <p className="mt-0.5 text-[12px] opacity-40">Original title — not yet summarised</p>
        ) : null}

        {m.gist ? (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] opacity-65 lg:mt-0.5 lg:line-clamp-1 lg:text-[12.5px]">
            {m.gist}
          </p>
        ) : null}

        {m.status_reason ? (
          <p className="mt-1.5 text-[12.5px] opacity-45 lg:mt-0.5 lg:text-[12px]">{m.status_reason}</p>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:w-[220px] lg:shrink-0 lg:justify-end lg:gap-1">
        <TypeBadge type={m.meeting_type} />
        <StatusBadge status={m.status} />
        {m.open_actions > 0 ? (
          <span className="rounded-full bg-black/6 px-2 py-0.5 text-[11px] font-medium opacity-70 dark:bg-white/10">
            {m.open_actions} open action{m.open_actions === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
