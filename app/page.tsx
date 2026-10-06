import Link from "next/link";
import { Shell } from "@/components/shell";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { ActionRow } from "@/components/action-row";
import { AgeBars, CadenceHeatmap, CoverageBar, StatTile, TypeBars } from "@/components/charts";
import { currentSession } from "@/lib/session";
import { dayLabel, ist, isStale, istDateKey, mins } from "@/lib/format";
import {
  actionAgeBuckets,
  actionDateCoverage,
  actionStatusCounts,
  actionTypeCounts,
  actionUrgentCounts,
  listMeetings,
  meetingCadence,
  openActions,
  statusCounts,
  type MeetingType,
  type Status,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const TYPES: MeetingType[] = ["mis", "sales", "other", "unclassified"];

/**
 * Today — the front door.
 *
 * The meeting list used to be the landing page, which meant management opened
 * the app onto a reverse-chronological feed and had to do the arithmetic
 * themselves. This answers "what is the state of play" first; the feed is one
 * click away at /meetings and unchanged.
 *
 * Every number here is an aggregate read. Nothing on this page is computed by
 * pulling rows into JS and counting them.
 */
export default async function TodayPage() {
  const [session, status, urgent, byType, coverage, ages, cadence, overdueItems, meetings, pipeline] =
    await Promise.all([
      currentSession(),
      actionStatusCounts(),
      actionUrgentCounts(),
      actionTypeCounts("open"),
      actionDateCoverage(),
      actionAgeBuckets(),
      meetingCadence(),
      openActions({ urgent: "overdue" }),
      listMeetings({}),
      statusCounts(),
    ]);

  const open = status.find((c) => c.status === "open")?.count ?? 0;
  const done = status.find((c) => c.status === "done")?.count ?? 0;

  const typeMap = new Map(byType.map((t) => [t.meeting_type, t.count]));
  const typeData = TYPES.map((type) => ({ type, n: typeMap.get(type) ?? 0 }));

  const ageBuckets = [
    { label: "0–7 days", n: ages.d7 },
    { label: "8–14 days", n: ages.d14 },
    { label: "15–30 days", n: ages.d30 },
    { label: "31–60 days", n: ages.d60 },
    { label: "60+ days", n: ages.older },
  ];

  const byStatus = new Map(pipeline.map((p) => [p.status, p.count]));
  const totalMeetings = pipeline.reduce((n, p) => n + p.count, 0);
  const inFlight =
    (byStatus.get("pending_transcript") ?? 0) +
    (byStatus.get("summarising") ?? 0) +
    (byStatus.get("discovered") ?? 0);
  const failed = byStatus.get("failed") ?? 0;

  const today = istDateKey(new Date());
  const recordedToday = meetings.filter((m) => istDateKey(m.recorded_at) === today).length;
  const latest = meetings.slice(0, 5);
  const urgentTop = overdueItems.slice(0, 5);

  const pct = open > 0 ? Math.round((urgent.overdue / open) * 1000) / 10 : 0;

  return (
    <Shell session={session} active="today">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page font-semibold tracking-tight text-ink">Today</h1>
          <p className="mt-1 text-support text-ink-2">
            {dayLabel(new Date())} · state of play across {totalMeetings} recorded meeting
            {totalMeetings === 1 ? "" : "s"}
            {recordedToday > 0 ? `, ${recordedToday} recorded today` : ""}
          </p>
        </div>
        {failed > 0 ? (
          <Link
            href="/meetings?status=failed"
            className="min-h-9 rounded-control border border-danger bg-danger-wash px-3 py-2 text-support font-semibold text-danger"
          >
            {failed} failed in the pipeline →
          </Link>
        ) : null}
      </div>

      {/* ---------------------------------------------------------- stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label="Open actions"
          value={open}
          sub={`across ${totalMeetings} meetings`}
          href="/actions"
        />
        <StatTile
          label="Overdue"
          value={urgent.overdue}
          sub={open > 0 ? `${pct}% of the backlog` : "nothing open"}
          tone={urgent.overdue > 0 ? "danger" : "success"}
          href="/actions?urgent=overdue"
        />
        <StatTile
          label="No due date"
          value={coverage.undated}
          sub={open > 0 ? `${Math.round((coverage.undated / open) * 100)}% have no deadline` : "—"}
          tone={coverage.undated > coverage.dated ? "warning" : "neutral"}
        />
        <StatTile label="Completed" value={done} sub="marked done to date" href="/actions?view=done" />
      </div>

      {/* ---------------------------------------------------------- charts */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHead
            title="Open backlog by meeting type"
            sub={`${open} items · one axis, direct-labelled`}
          />
          <TypeBars data={typeData} />
        </Card>

        <Card>
          <CardHead title="Deadline coverage" sub="The real reason nothing feels accountable" />
          <CoverageBar dated={coverage.dated} undated={coverage.undated} />
        </Card>
      </div>

      <Card className="mb-4">
        <CardHead
          title="How old is the backlog"
          sub="Age since the meeting — the one signal that covers every open item, dated or not"
        />
        <AgeBars buckets={ageBuckets} />
      </Card>

      {/* ---------------------------------------------------------- lists */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-section font-semibold tracking-tight text-ink">Needs you now</h2>
            {urgent.overdue > 0 ? (
              <Link
                href="/actions?urgent=overdue"
                className="text-support font-medium text-accent underline underline-offset-2"
              >
                All {urgent.overdue} overdue
              </Link>
            ) : null}
          </div>

          {urgentTop.length === 0 ? (
            <p className="rounded-card border border-dashed border-success px-4 py-8 text-center text-body text-success">
              Nothing overdue — all {open} open items are still in time.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {urgentTop.map((a) => (
                <li key={a.id}>
                  <ActionRow a={a} interactive stale={isStale(a.recorded_at)} type={a.meeting_type} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-section font-semibold tracking-tight text-ink">Latest briefs</h2>
            <Link
              href="/meetings"
              className="text-support font-medium text-accent underline underline-offset-2"
            >
              All meetings
            </Link>
          </div>

          {latest.length === 0 ? (
            <p className="rounded-card border border-dashed border-strong px-4 py-8 text-center text-body text-ink-2">
              No meetings recorded yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-0">
              {latest.map((m) => (
                <li key={m.id} className="border-b border-subtle last:border-0">
                  <Link
                    href={`/m/${m.id}`}
                    data-nav
                    className="block rounded-control py-2.5 transition-colors hover:bg-sunken"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <TypeBadge type={m.meeting_type} />
                      <span className="num text-meta text-ink-3">
                        {ist(m.recorded_at)}
                        {mins(m.duration_sec) ? ` · ${mins(m.duration_sec)}` : ""}
                      </span>
                    </div>
                    <p className="mt-1.5 text-body font-medium leading-snug text-ink">
                      {m.title_en || m.title_original || "Untitled recording"}
                    </p>
                    {m.gist ? (
                      <p className="mt-1 line-clamp-2 text-support text-ink-2">{m.gist}</p>
                    ) : null}
                    {m.open_actions > 0 ? (
                      <p className="num mt-1.5 text-meta text-ink-2">{m.open_actions} open</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ---------------------------------------------------------- cadence + pipeline */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHead title="Meeting cadence" sub="Last eight weeks, bucketed in IST" />
          {cadence.length > 0 ? (
            <CadenceHeatmap cells={cadence} />
          ) : (
            <p className="text-body text-ink-2">No meetings in the last eight weeks.</p>
          )}
        </Card>

        <Card>
          <CardHead title="Pipeline" sub={`${totalMeetings} recordings, by processing state`} />
          <ul className="flex flex-col gap-0">
            {([...byStatus.entries()] as [Status, number][])
              .filter(([, n]) => n > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <li
                  key={s}
                  className="flex items-center justify-between gap-3 border-b border-subtle py-2 last:border-0"
                >
                  <Link href={`/meetings?status=${s}`} className="flex items-center gap-2">
                    <StatusBadge status={s} />
                  </Link>
                  <span className="num text-support font-medium text-ink">{n}</span>
                </li>
              ))}
          </ul>
          {inFlight > 0 ? (
            <p className="mt-3 text-meta text-ink-2">
              <span className="num font-semibold text-ink">{inFlight}</span> still moving through
              transcription or summarising.
            </p>
          ) : null}
        </Card>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ primitives */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-subtle bg-surface p-4 lg:p-5 ${className}`}>
      {children}
    </section>
  );
}

function CardHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-body font-semibold text-ink">{title}</h2>
      {sub ? <p className="mt-0.5 text-meta text-ink-3">{sub}</p> : null}
    </div>
  );
}
