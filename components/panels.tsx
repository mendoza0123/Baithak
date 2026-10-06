import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock } from "lucide-react";
import { statusLabel } from "@/components/badges";
import { dueLabel, ist, istDateKey } from "@/lib/format";
import type { ActionWithMeeting, MeetingRow, Status } from "@/lib/queries";

/**
 * The desktop-only side columns. Every one of these renders `hidden` below lg/xl, so the phone
 * build never sees them — they exist purely to spend the width a monitor has and a phone hasn't.
 *
 * None of them adds a query: each takes data the page already fetched for the mobile layout, or
 * reshapes the list that is on screen anyway.
 */

/* ------------------------------------------------------------- meeting rail (/m/[id]) */

/** The list you came from, kept on screen. Clicking is a normal navigation, so deep links,
 * back/forward and the lang toggle all behave exactly as before. */
export function MeetingRail({ meetings, currentId }: { meetings: MeetingRow[]; currentId: string }) {
  return (
    <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[250px] shrink-0 flex-col overflow-y-auto lg:flex">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <Link
          href="/meetings"
          className="flex items-center gap-1 text-meta font-semibold text-ink-2 hover:text-ink"
        >
          <ArrowLeft size={12} strokeWidth={2.5} aria-hidden />
          All meetings
        </Link>
        <span className="num text-label text-ink-3">{meetings.length}</span>
      </div>
      <ol className="flex flex-col gap-0.5 pb-2">
        {meetings.map((m) => {
          const on = m.id === currentId;
          return (
            <li key={m.id}>
              <Link
                href={`/m/${m.id}`}
                data-nav
                aria-current={on ? "page" : undefined}
                className={`block rounded-control px-2 py-1.5 transition-colors ${
                  on ? "bg-accent text-accent-ink" : "hover:bg-sunken"
                }`}
              >
                <span className={`block truncate text-meta leading-snug ${on ? "" : "text-ink"}`}>
                  {m.title_en || m.title_original || "Untitled recording"}
                </span>
                <span
                  className={`num mt-0.5 flex items-center gap-1.5 text-label ${
                    on ? "text-accent-ink-2" : "text-ink-3"
                  }`}
                >
                  {ist(m.recorded_at)}
                  {m.open_actions > 0 ? <span>· {m.open_actions} open</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/* ---------------------------------------------------------------- command deck (/meetings) */

/**
 * Pipeline segment colours. Status tokens only — these are states, so they never
 * borrow a categorical series hue, and everything that isn't good/warning/bad
 * stays neutral rather than inventing a colour for it.
 */
const BAR: Partial<Record<Status, string>> = {
  awaiting_approval: "bg-warning",
  ready: "bg-success",
  emailed: "bg-success",
  failed: "bg-danger",
  summarising: "bg-strong",
  pending_transcript: "bg-strong",
  discovered: "bg-strong",
  skipped: "bg-subtle",
};

export function CommandDeck({
  byStatus,
  total,
  meetings,
  overdue,
  high,
  overdueItems,
}: {
  byStatus: Map<Status, number>;
  total: number;
  meetings: MeetingRow[];
  overdue: number;
  high: number;
  overdueItems: ActionWithMeeting[];
}) {
  const inFlight =
    (byStatus.get("pending_transcript") ?? 0) +
    (byStatus.get("summarising") ?? 0) +
    (byStatus.get("discovered") ?? 0);
  const failed = byStatus.get("failed") ?? 0;
  const awaiting = byStatus.get("awaiting_approval") ?? 0;

  const today = istDateKey(new Date());
  const todayCount = meetings.filter((m) => istDateKey(m.recorded_at) === today).length;
  const openHere = meetings.reduce((n, m) => n + m.open_actions, 0);
  const segments = [...byStatus.entries()].filter(([, n]) => n > 0);

  return (
    <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[292px] shrink-0 flex-col gap-3 overflow-y-auto xl:flex">
      <div className="grid grid-cols-2 gap-2">
        <Stat label="On screen" value={meetings.length} sub={`of ${total} recorded`} />
        <Stat label="Recorded today" value={todayCount} sub="IST" />
        <Stat label="Open actions" value={openHere} sub="in this view" href="/actions" />
        <Stat
          label="Overdue"
          value={overdue}
          sub={high ? `${high} high priority` : "across all meetings"}
          href="/actions?urgent=overdue"
          alarm={overdue > 0}
        />
      </div>

      <Panel title="Pipeline">
        {segments.length > 0 && total > 0 ? (
          <div className="mt-2 flex h-1.5 w-full gap-[2px] overflow-hidden rounded-full bg-sunken">
            {segments.map(([s, n]) => (
              <span
                key={s}
                title={`${statusLabel(s)} — ${n}`}
                className={`${BAR[s] ?? "bg-strong"} first:rounded-l-full last:rounded-r-full`}
                style={{ width: `${(n / total) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        <ul className="mt-2.5 flex flex-col gap-1 text-meta">
          <DeckRow label="Still processing" value={inFlight} href="/meetings?status=summarising" />
          <DeckRow
            label="Awaiting approval"
            value={awaiting}
            href="/meetings?status=awaiting_approval"
            tone={awaiting ? "warning" : undefined}
          />
          <DeckRow
            label="Failed"
            value={failed}
            href="/meetings?status=failed"
            tone={failed ? "danger" : undefined}
          />
        </ul>
      </Panel>

      {overdueItems.length > 0 ? (
        <Panel title="Most overdue">
          <ul className="mt-2 flex flex-col gap-2">
            {overdueItems.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/m/${a.meeting_id}`}
                  className="block rounded-control px-1.5 py-1 transition-colors hover:bg-sunken"
                >
                  <span className="line-clamp-2 block text-meta leading-snug text-ink">
                    {a.description}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-label">
                    <span className="num flex items-center gap-1 font-semibold text-danger">
                      <Clock size={10} strokeWidth={3} aria-hidden />
                      due {dueLabel(a.due_date)}
                    </span>
                    <span className="truncate text-ink-3">{a.owner || "unassigned"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/actions?urgent=overdue"
            className="mt-2 flex items-center gap-1 text-label text-accent underline underline-offset-2"
          >
            All overdue
            <ArrowRight size={11} strokeWidth={2.5} aria-hidden />
          </Link>
        </Panel>
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------- owner panel (/actions) */

/** Who is carrying what, straight off the list already on screen — no extra query, and it
 * re-counts under whatever filter is active, which is the useful behaviour.
 *
 * `owner` is free text the pipeline writes from what it heard, so the names here are spellings,
 * not people — see the note this panel renders above itself on /actions. */
export function OwnerPanel({
  items,
  hrefFor,
  view,
}: {
  items: ActionWithMeeting[];
  hrefFor: (owner: string) => string;
  view: "open" | "done";
}) {
  const tally = new Map<string, { n: number; overdue: number }>();
  const today = istDateKey(new Date());
  for (const a of items) {
    const key = a.owner || "Unassigned";
    const row = tally.get(key) ?? { n: 0, overdue: 0 };
    row.n++;
    if (view === "open" && a.due_date && a.due_date < today) row.overdue++;
    tally.set(key, row);
  }
  const owners = [...tally.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 12);
  if (!owners.length) return null;
  const top = owners[0][1].n;

  const noDate = items.filter((a) => !a.due_date).length;
  const overdue = items.filter((a) => a.due_date && a.due_date < today).length;

  return (
    <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] w-[268px] shrink-0 flex-col gap-3 overflow-y-auto xl:flex">
      <Panel title={`Owner spellings · ${view === "open" ? "open" : "completed"}`}>
        <p className="mt-1 text-label leading-snug text-ink-3">
          {tally.size} distinct values across {items.length} items — free text, so one person can
          appear several times.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {owners.map(([owner, row]) => (
            <li key={owner}>
              <Link
                href={hrefFor(owner === "Unassigned" ? "" : owner)}
                className="block rounded-control px-1 py-0.5 transition-colors hover:bg-sunken"
              >
                <span className="flex items-baseline justify-between gap-2 text-meta">
                  <span className={`truncate ${owner === "Unassigned" ? "text-ink-3" : "text-ink"}`}>
                    {owner}
                  </span>
                  <span className="num shrink-0 text-ink-2">
                    {row.overdue ? (
                      <span className="mr-1 font-semibold text-danger">{row.overdue} late</span>
                    ) : null}
                    {row.n}
                  </span>
                </span>
                {/* One bar, two parts: how much of this owner's pile is already late. */}
                <span className="mt-1 flex h-1 w-full gap-[2px] overflow-hidden rounded-full bg-sunken">
                  <span
                    className="rounded-l-full bg-danger"
                    style={{ width: `${(row.overdue / top) * 100}%` }}
                  />
                  <span
                    className="rounded-r-full bg-strong"
                    style={{ width: `${((row.n - row.overdue) / top) * 100}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      {view === "open" ? (
        <Panel title="Dates">
          <ul className="mt-2 flex flex-col gap-1 text-meta">
            <DeckRow label="Past due" value={overdue} tone={overdue ? "danger" : undefined} />
            <DeckRow label="No due date" value={noDate} tone={noDate ? "warning" : undefined} />
            <DeckRow label="Dated, still in time" value={items.length - overdue - noDate} />
          </ul>
        </Panel>
      ) : null}
    </aside>
  );
}

/* ----------------------------------------------------------------------- primitives */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-subtle bg-surface p-3">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
  alarm = false,
}: {
  label: string;
  value: number;
  sub: string;
  href?: string;
  alarm?: boolean;
}) {
  const body = (
    <>
      <span className="eyebrow block">{label}</span>
      <span
        className={`num mt-1 block text-section leading-none font-medium ${alarm ? "text-danger" : "text-ink"}`}
      >
        {value}
      </span>
      <span className="mt-1 block truncate text-label text-ink-3">{sub}</span>
    </>
  );
  const cls = "block rounded-card border border-subtle bg-surface p-2.5 transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:border-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function DeckRow({
  label,
  value,
  href,
  tone,
}: {
  label: string;
  value: number;
  href?: string;
  tone?: "warning" | "danger";
}) {
  const colour = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink";
  const inner = (
    <>
      <span className={value ? "text-ink-2" : "text-ink-3"}>{label}</span>
      <span className={`num ${value ? `font-semibold ${colour}` : "text-ink-3"}`}>{value}</span>
    </>
  );
  return (
    <li>
      {href && value ? (
        <Link
          href={href}
          className="flex items-baseline justify-between rounded-control px-1 py-0.5 hover:bg-sunken"
        >
          {inner}
        </Link>
      ) : (
        <span className="flex items-baseline justify-between px-1 py-0.5">{inner}</span>
      )}
    </li>
  );
}
