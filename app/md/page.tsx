import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Info,
  UserX,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { ActionRow } from "@/components/action-row";
import { FlowBars, StatTile } from "@/components/charts";
import { currentSession } from "@/lib/session";
import {
  dayMonth,
  isOverdue,
  isStale,
  istDateKey,
  istWeekStart,
  mins,
  shiftWeek,
  timeLabel,
  weekDays,
  weekLabel,
  weekdayShort,
} from "@/lib/format";
import {
  commitmentFlow,
  weekActions,
  weekMeetings,
  weekTakeaways,
  type Takeaway,
  type WeekMeeting,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const BUCKETS = ["all", "unassigned", "overdue"] as const;
type Bucket = (typeof BUCKETS)[number];

/**
 * My week — the admin-gated executive view.
 *
 * Gated on the `admin` role, which already carries its own password (ADMIN_CODE), so there is
 * no list of people anywhere in here. Whose week it is comes from the session email, which
 * Google supplies — two people holding the same admin code still get their own view once the
 * calendar sync lands and attendance is known.
 *
 * TRACK A, and honest about it: there is no scheduled-meeting or attendee data in the
 * `baithak` schema, so this reads *recorded* meetings for the week. Personal scoping and
 * forward-looking schedule both arrive with baithak.calendar_events.
 */
export default async function MyWeekPage({ searchParams }: PageProps<"/md">) {
  const [sp, session] = await Promise.all([searchParams, currentSession()]);

  // 404 rather than 403: a member has no business learning this route exists.
  if (session?.role !== "admin") notFound();

  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
  const asked = one(sp.w);
  const week = WEEK.test(asked) ? asked : istWeekStart();
  const bucket = (BUCKETS as readonly string[]).includes(one(sp.bucket))
    ? (one(sp.bucket) as Bucket)
    : "all";

  const [meetings, takeaways, actions, flow] = await Promise.all([
    weekMeetings(week),
    weekTakeaways(week),
    weekActions(week),
    commitmentFlow(12),
  ]);

  const thisWeek = istWeekStart();
  const today = istDateKey(new Date());
  const isCurrent = week === thisWeek;
  const href = (patch: { w?: string; bucket?: Bucket }) => {
    const p = new URLSearchParams();
    const w = patch.w ?? week;
    if (w !== thisWeek) p.set("w", w);
    const b = patch.bucket ?? bucket;
    if (b !== "all") p.set("bucket", b);
    const s = p.toString();
    return s ? `/md?${s}` : "/md";
  };

  const briefed = meetings.filter((m) => m.briefed);
  const decisions = takeaways.filter((t) => t.kind === "decision");
  const issues = takeaways.filter((t) => t.kind === "issue");
  const openActions = actions.filter((a) => a.status === "open");
  const unassigned = openActions.filter((a) => !a.owner);
  const overdue = openActions.filter((a) => isOverdue(a.due_date));

  const shown =
    bucket === "unassigned" ? unassigned : bucket === "overdue" ? overdue : openActions;

  // The newest briefed meeting of the week, and its own recap lines.
  const latest = briefed.length ? briefed[briefed.length - 1] : null;
  const latestLines = latest ? takeaways.filter((t) => t.meeting_id === latest.id) : [];

  // Owner tally for the week, straight off the list already fetched.
  const tally = new Map<string, number>();
  for (const a of openActions) tally.set(a.owner || "Unassigned", (tally.get(a.owner || "Unassigned") ?? 0) + 1);
  const owners = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ownerMax = owners.length ? owners[0][1] : 1;

  const byDay = new Map<string, WeekMeeting[]>();
  for (const m of meetings) {
    const k = istDateKey(m.recorded_at);
    byDay.set(k, [...(byDay.get(k) ?? []), m]);
  }

  return (
    <Shell session={session} active="md">
      {/* Head + week navigation */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">My week</p>
          <h1 className="mt-1 text-page font-semibold tracking-tight text-ink">{weekLabel(week)}</h1>
          <p className="mt-1 text-support text-ink-2">
            {meetings.length} meeting{meetings.length === 1 ? "" : "s"} recorded ·{" "}
            {briefed.length} briefed · {openActions.length} commitment
            {openActions.length === 1 ? "" : "s"} still open
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link
            href={href({ w: shiftWeek(week, -1) })}
            aria-label="Previous week"
            className="flex size-10 items-center justify-center rounded-control border border-strong bg-surface text-ink transition-colors hover:border-accent"
          >
            <ChevronLeft size={16} strokeWidth={2.25} aria-hidden />
          </Link>
          <Link
            href="/md"
            aria-current={isCurrent ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-control border px-3.5 text-support font-semibold transition-colors ${
              isCurrent
                ? "border-accent bg-accent text-accent-ink"
                : "border-strong bg-surface text-ink hover:border-accent"
            }`}
          >
            This week
          </Link>
          <Link
            href={href({ w: shiftWeek(week, 1) })}
            aria-label="Next week"
            className="flex size-10 items-center justify-center rounded-control border border-strong bg-surface text-ink transition-colors hover:border-accent"
          >
            <ChevronRight size={16} strokeWidth={2.25} aria-hidden />
          </Link>
        </div>
      </div>

      {/* ===================== ZONE 1 · WEEK STRIP ===================== */}
      <section className="mb-4 rounded-card border border-subtle bg-surface p-4 lg:p-5">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-section font-semibold tracking-tight text-ink">The week</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-warning-wash px-2.5 py-1 text-label font-semibold text-warning">
            <Info size={11} strokeWidth={2.75} aria-hidden />
            Recorded meetings only
          </span>
        </div>
        <p className="mb-4 text-meta text-ink-2">
          What was captured, not what was scheduled. A forward-looking schedule needs calendar
          data, which this database does not hold yet.
        </p>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {weekDays(week).map((day) => {
            const items = byDay.get(day) ?? [];
            const isToday = day === today;
            return (
              <div
                key={day}
                className={`flex min-h-[132px] flex-col gap-2 rounded-control border p-2.5 ${
                  isToday ? "border-accent bg-accent-wash" : "border-subtle bg-canvas"
                }`}
              >
                <div className="flex items-baseline justify-between gap-1.5">
                  <span className={`text-meta font-semibold ${isToday ? "text-accent" : "text-ink"}`}>
                    {weekdayShort(day)}
                  </span>
                  <span className="num text-label text-ink-3">{dayMonth(day)}</span>
                </div>

                {items.length === 0 ? (
                  <p className="my-auto text-center text-label text-ink-3">—</p>
                ) : (
                  items.map((m) => (
                    <Link
                      key={m.id}
                      href={`/m/${m.id}`}
                      data-nav
                      className={`block border-l-2 pl-2 transition-colors hover:border-accent ${
                        m.briefed ? "border-success" : "border-warning"
                      }`}
                    >
                      <p className="num text-label text-ink-3">{timeLabel(m.recorded_at)}</p>
                      <p className="mt-0.5 line-clamp-2 text-meta font-medium leading-snug text-ink">
                        {m.title_en || m.title_original || "Untitled"}
                      </p>
                      <span
                        className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-label font-semibold ${
                          m.briefed ? "bg-success-wash text-success" : "bg-warning-wash text-warning"
                        }`}
                      >
                        {m.briefed ? "Brief ready" : "No brief"}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-subtle pt-3">
          <span className="flex items-center gap-1.5 text-meta text-ink-2">
            <span className="size-2.5 rounded-[2px] bg-success" aria-hidden />
            Brief ready
          </span>
          <span className="flex items-center gap-1.5 text-meta text-ink-2">
            <span className="size-2.5 rounded-[2px] bg-warning" aria-hidden />
            Recorded, brief pending
          </span>
        </div>
      </section>

      {/* ===================== ZONE 2 · TILES ===================== */}
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Meetings recorded" value={meetings.length} sub={weekLabel(week)} />
        <StatTile
          label="Briefs ready"
          value={meetings.length ? `${briefed.length}/${meetings.length}` : "—"}
          sub={
            meetings.length && briefed.length === meetings.length
              ? "full coverage"
              : `${meetings.length - briefed.length} still pending`
          }
          tone={meetings.length && briefed.length === meetings.length ? "success" : "warning"}
        />
        <StatTile label="Decisions taken" value={decisions.length} sub={`${issues.length} open issues raised`} />
        <StatTile
          label="Overdue, this week"
          value={overdue.length}
          sub={`of ${openActions.length} open`}
          tone={overdue.length ? "danger" : "success"}
          href={overdue.length ? href({ bucket: "overdue" }) : undefined}
        />
      </div>

      {/* ===================== ZONE 3 · BRIEF + TAKEAWAYS ===================== */}
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-card border border-subtle bg-surface p-4 lg:p-5">
          <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-section font-semibold tracking-tight text-ink">Latest brief</h2>
            {latest ? (
              <Link
                href={`/m/${latest.id}`}
                className="flex items-center gap-1 text-support font-medium text-accent underline underline-offset-2"
              >
                Open full brief
                <ArrowRight size={13} strokeWidth={2.5} aria-hidden />
              </Link>
            ) : null}
          </div>

          {!latest ? (
            <p className="mt-3 rounded-card border border-dashed border-strong px-4 py-10 text-center text-body text-ink-2">
              No brief landed this week yet.
            </p>
          ) : (
            <>
              <div className="num mb-2 flex flex-wrap items-center gap-2 text-meta text-ink-3">
                <span>
                  {weekdayShort(istDateKey(latest.recorded_at))} {dayMonth(istDateKey(latest.recorded_at))},{" "}
                  {timeLabel(latest.recorded_at)} IST
                </span>
                {mins(latest.duration_sec) ? <span>· {mins(latest.duration_sec)}</span> : null}
              </div>
              <p className="mb-3 text-body font-medium leading-snug text-ink">
                {latest.title_en || latest.title_original || "Untitled recording"}
              </p>
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <TypeBadge type={latest.meeting_type} />
                <StatusBadge status={latest.status} />
              </div>

              <div className="flex flex-col gap-2.5">
                <RecapBlock
                  title="Decided"
                  tone="success"
                  lines={latestLines.filter((l) => l.kind === "decision")}
                />
                <RecapBlock
                  title="Open issues"
                  tone="warning"
                  lines={latestLines.filter((l) => l.kind === "issue")}
                />
                <RecapBlock
                  title="Next agenda"
                  tone="neutral"
                  lines={latestLines.filter((l) => l.kind === "agenda")}
                />
              </div>
            </>
          )}
        </section>

        <section className="rounded-card border border-subtle bg-surface p-4 lg:p-5">
          <h2 className="text-section font-semibold tracking-tight text-ink">Key takeaways</h2>
          <p className="mt-1 mb-4 text-meta text-ink-2">
            Every decision and open issue across the week&apos;s briefs, newest first, each tied
            back to the meeting it came from.
          </p>

          {takeaways.length === 0 ? (
            <p className="rounded-card border border-dashed border-strong px-4 py-10 text-center text-body text-ink-2">
              Nothing recorded for this week.
            </p>
          ) : (
            <ul className="flex flex-col">
              {takeaways
                .filter((t) => t.kind !== "agenda")
                .slice(0, 12)
                .map((t, i) => (
                  <li
                    key={`${t.meeting_id}-${t.kind}-${i}`}
                    className="grid grid-cols-[18px_minmax(0,1fr)] gap-2.5 border-b border-subtle py-2.5 last:border-0"
                  >
                    <span
                      className={`mt-0.5 flex size-[18px] items-center justify-center rounded-[4px] ${
                        t.kind === "decision" ? "bg-success-wash" : "bg-warning-wash"
                      }`}
                      aria-hidden
                    >
                      {t.kind === "decision" ? (
                        <Check size={11} strokeWidth={3.5} className="text-success" />
                      ) : (
                        <CircleAlert size={11} strokeWidth={3} className="text-warning" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-support leading-snug text-ink">{t.text}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-label text-ink-3">
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-semibold ${
                            t.kind === "decision"
                              ? "bg-success-wash text-success"
                              : "bg-warning-wash text-warning"
                          }`}
                        >
                          {t.kind === "decision" ? "Decision" : "Open issue"}
                        </span>
                        <Link href={`/m/${t.meeting_id}`} className="font-medium text-accent">
                          {t.title_en || t.title_original || "Untitled"}
                        </Link>
                        <span className="num">
                          {weekdayShort(istDateKey(t.recorded_at))} {dayMonth(istDateKey(t.recorded_at))}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>

      {/* ===================== ZONE 4 · COMMITMENTS ===================== */}
      <section className="mb-4 rounded-card border border-subtle bg-surface p-4 lg:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-section font-semibold tracking-tight text-ink">
              Commitments from this week
            </h2>
            <p className="mt-1 text-meta text-ink-2">
              Owner is free text the pipeline wrote, so these are spellings rather than people —
              which is why <strong className="font-semibold text-ink">Unassigned</strong> is its own
              bucket.
            </p>
          </div>
          <div role="group" aria-label="Bucket" className="flex gap-1 rounded-full bg-sunken p-1">
            <BucketTab href={href({ bucket: "all" })} on={bucket === "all"} label="All" n={openActions.length} />
            <BucketTab
              href={href({ bucket: "unassigned" })}
              on={bucket === "unassigned"}
              label="Unassigned"
              n={unassigned.length}
            />
            <BucketTab
              href={href({ bucket: "overdue" })}
              on={bucket === "overdue"}
              label="Overdue"
              n={overdue.length}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="rounded-card border border-dashed border-success px-4 py-10 text-center text-body text-success">
            {bucket === "overdue"
              ? "Nothing from this week is overdue."
              : bucket === "unassigned"
                ? "Everything from this week has an owner."
                : "No open commitments from this week."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:items-start xl:grid-cols-3">
            {shown.map((a) => (
              <li key={a.id}>
                <ActionRow a={a} interactive stale={isStale(a.recorded_at)} type={a.meeting_type} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===================== ZONE 5 · CHARTS ===================== */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-card border border-subtle bg-surface p-4 lg:p-5">
          <h2 className="text-body font-semibold text-ink">Commitments opened vs closed</h2>
          <p className="mt-0.5 mb-4 text-meta text-ink-3">
            Per week, last 12. The gap is the backlog growing or shrinking — the one number that
            says whether the meetings are working.
          </p>
          <FlowBars
            data={flow.map((f) => ({ label: f.week.slice(5).replace("-", "/"), a: f.opened, b: f.closed }))}
            aLabel="Opened"
            bLabel="Closed"
          />
          <p className="mt-3 border-t border-subtle pt-3 text-meta leading-relaxed text-ink-2">
            Opened is dated from the meeting, not from a row timestamp — a commitment is made when
            it is said out loud. Closed is when someone ticked it.
          </p>
        </section>

        <section className="rounded-card border border-subtle bg-surface p-4 lg:p-5">
          <h2 className="text-body font-semibold text-ink">Who is carrying this week</h2>
          <p className="mt-0.5 mb-4 text-meta text-ink-3">
            Open commitments by owner spelling. Grey is unassigned.
          </p>

          {owners.length === 0 ? (
            <p className="text-body text-ink-2">Nothing open from this week.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {owners.map(([owner, n]) => {
                const none = owner === "Unassigned";
                return (
                  <li key={owner}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span
                        className={`flex min-w-0 items-center gap-1.5 truncate text-meta font-medium ${
                          none ? "text-ink-3" : "text-ink"
                        }`}
                      >
                        {none ? <UserX size={12} strokeWidth={2.5} aria-hidden /> : null}
                        {owner}
                      </span>
                      <span className="num shrink-0 text-meta text-ink-2">{n}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className={`h-1.5 rounded-full ${none ? "bg-series-0" : "bg-series-1"}`}
                        style={{ width: `${(n / ownerMax) * 100}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 border-t border-subtle pt-3 text-meta leading-relaxed text-ink-2">
            Grey is the error bar: until owner strings resolve to people, “Mahesh” and “Mahesh +
            team” count separately and this chart says so rather than quietly merging them.
          </p>
        </section>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------------ primitives */

const RECAP = {
  success: "border-success bg-success-wash",
  warning: "border-warning bg-warning-wash",
  neutral: "border-subtle bg-canvas",
} as const;

const RECAP_INK = {
  success: "text-success",
  warning: "text-warning",
  neutral: "text-ink-3",
} as const;

function RecapBlock({
  title,
  tone,
  lines,
}: {
  title: string;
  tone: keyof typeof RECAP;
  lines: Takeaway[];
}) {
  if (!lines.length) return null;
  return (
    <div className={`rounded-control border p-3 ${RECAP[tone]}`}>
      <h3 className={`eyebrow ${RECAP_INK[tone]}`}>
        {title} <span className="num">{lines.length}</span>
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {lines.map((l, i) => (
          <li key={i} className="text-support leading-snug text-ink">
            {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BucketTab({
  href,
  on,
  label,
  n,
}: {
  href: string;
  on: boolean;
  label: string;
  n: number;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-support transition-colors ${
        on
          ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
          : "text-ink-2 hover:text-ink"
      }`}
    >
      {label}
      <span className="num text-meta text-ink-3">{n}</span>
    </Link>
  );
}
