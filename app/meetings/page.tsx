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
const SWATCH = {
  mis: "bg-series-1",
  sales: "bg-series-2",
  other: "bg-series-3",
  unclassified: "bg-series-0",
} as const;

const href = (current: Record<string, string>, patch: Record<string, string | null>) =>
  chipHref("/meetings", current, patch);

/** The query caps at 100 — say so rather than truncating in silence. */
const LIST_LIMIT = 100;

export default async function MeetingsPage({ searchParams }: PageProps<"/meetings">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
  const filter = { status: one(sp.status), type: one(sp.type), search: one(sp.q) };
  const active = {
    ...(filter.status && { status: filter.status }),
    ...(filter.type && { type: filter.type }),
    ...(filter.search && { q: filter.search }),
  };

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
  const capped = meetings.length === LIST_LIMIT;

  return (
    <Shell session={session} active="meetings">
      {/* One row on a monitor, one column on a phone: the wrappers below are plain blocks until
          `lg`, so the mobile document flows exactly as it did before the desktop layout existed. */}
      <div className="lg:flex lg:items-start lg:gap-6">
        {/* Filters: a scrolling strip on a phone, a permanent left rail on a desktop. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[212px] lg:shrink-0 lg:overflow-y-auto lg:pb-2">
          <div className="-mx-4 mb-3 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
            <div className="flex w-max gap-1.5 lg:w-full lg:flex-col lg:gap-0.5">
              <p className="eyebrow hidden px-1 pb-1 lg:block">Status</p>
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
            <p className="eyebrow hidden w-full px-1 pb-1 lg:block">Type</p>
            {TYPES.filter((t) => byType.has(t)).map((t) => (
              <Chip
                key={t}
                href={href(active, { type: filter.type === t ? null : t })}
                on={filter.type === t}
                label={t === "mis" ? "MIS" : t[0].toUpperCase() + t.slice(1)}
                count={byType.get(t) ?? 0}
                swatch={SWATCH[t]}
                block
              />
            ))}
          </div>

          <form className="mb-4 flex gap-2 lg:mt-4 lg:mb-0 lg:flex-col lg:gap-1.5">
            {filter.status ? <input type="hidden" name="status" value={filter.status} /> : null}
            {filter.type ? <input type="hidden" name="type" value={filter.type} /> : null}
            <label htmlFor="q" className="sr-only">
              Search meeting titles
            </label>
            <input
              id="q"
              name="q"
              defaultValue={filter.search}
              placeholder="Search titles…"
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

        {/* The list itself. */}
        <div className="lg:min-w-0 lg:flex-1">
          {filtered || capped ? (
            <div className="mb-3 flex items-center justify-between gap-3 text-support text-ink-2">
              <span className="num">
                {capped ? `Showing ${meetings.length} of ${total}` : `${meetings.length} meeting${meetings.length === 1 ? "" : "s"}`}
              </span>
              {filtered ? (
                <Link href="/meetings" className="text-accent underline underline-offset-2">
                  Clear filters
                </Link>
              ) : null}
            </div>
          ) : null}

          {meetings.length === 0 ? (
            <p className="rounded-card border border-dashed border-strong px-4 py-10 text-center text-body text-ink-2">
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
      className="block rounded-card border border-subtle bg-surface p-3.5 transition-colors hover:border-strong lg:flex lg:items-start lg:gap-4 lg:p-2.5"
    >
      <div className="num flex items-center gap-2 text-meta text-ink-3 lg:w-[150px] lg:shrink-0 lg:flex-wrap lg:gap-x-1.5 lg:gap-y-0 lg:pt-px">
        <span>{ist(m.recorded_at)}</span>
        {duration ? <span>· {duration}</span> : null}
        {m.sensitive ? <span className="text-warning">· sensitive</span> : null}
      </div>

      {/* Wrapper is inert on a phone (a plain block inside a plain block) and becomes the middle
          column of the row on a desktop. */}
      <div className="lg:min-w-0 lg:flex-1">
        <h2 className="mt-1 text-body leading-snug font-medium text-ink lg:mt-0">
          {m.title_en || m.title_original || "Untitled recording"}
        </h2>

        {!summarised && m.title_original ? (
          <p className="mt-0.5 text-meta text-ink-3">Original title — not yet summarised</p>
        ) : null}

        {m.gist ? (
          <p className="mt-1.5 line-clamp-2 text-support text-ink-2 lg:mt-0.5 lg:line-clamp-1">{m.gist}</p>
        ) : null}

        {m.status_reason ? (
          <p className="mt-1.5 text-meta text-ink-3 lg:mt-0.5">{m.status_reason}</p>
        ) : null}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 lg:mt-0 lg:w-[232px] lg:shrink-0 lg:justify-end lg:gap-1">
        <TypeBadge type={m.meeting_type} />
        <StatusBadge status={m.status} />
        {m.open_actions > 0 ? (
          <span className="num rounded-full bg-sunken px-2 py-0.5 text-label font-medium text-ink-2">
            {m.open_actions} open
          </span>
        ) : null}
      </div>
    </Link>
  );
}
