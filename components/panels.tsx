import Link from "next/link";
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
        <Link href="/" className="text-[12px] font-semibold opacity-60 hover:opacity-100">
          &larr; All meetings
        </Link>
        <span className="text-[11px] tabular-nums opacity-35">{meetings.length}</span>
      </div>
      <ol className="flex flex-col gap-0.5 pb-2">
        {meetings.map((m) => {
          const on = m.id === currentId;
          return (
            <li key={m.id}>
              <Link
                href={`/m/${m.id}`}
                data-nav
                className={`block rounded-lg px-2 py-1.5 transition-colors ${
                  on ? "bg-black text-white" : "hover:bg-black/[0.05]"
                }`}
              >
                <span className={`block truncate text-[12.5px] leading-snug ${on ? "" : "opacity-80"}`}>
                  {m.title_en || m.title_original || "Untitled recording"}
                </span>
                <span
                  className={`mt-0.5 flex items-center gap-1.5 text-[10.5px] tabular-nums ${
                    on ? "opacity-55" : "opacity-40"
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

/* ---------------------------------------------------------------- command deck (/) */

const BAR: Partial<Record<Status, string>> = {
  awaiting_approval: "bg-amber-500",
  ready: "bg-emerald-500",
  emailed: "bg-emerald-600",
  failed: "bg-red-500",
  summarising: "bg-slate-400",
  pending_transcript: "bg-slate-300",
  discovered: "bg-slate-500",
  skipped: "bg-zinc-300",
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
          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-black/5">
            {segments.map(([s, n]) => (
              <span
                key={s}
                title={`${statusLabel(s)} — ${n}`}
                className={BAR[s] ?? "bg-zinc-400"}
                style={{ width: `${(n / total) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
        <ul className="mt-2.5 flex flex-col gap-1 text-[12px]">
          <DeckRow label="Still processing" value={inFlight} href="/?status=summarising" />
          <DeckRow
            label="Awaiting approval"
            value={awaiting}
            href="/?status=awaiting_approval"
            tone={awaiting ? "amber" : undefined}
          />
          <DeckRow label="Failed" value={failed} href="/?status=failed" tone={failed ? "red" : undefined} />
        </ul>
      </Panel>

      {overdueItems.length > 0 ? (
        <Panel title="Most overdue">
          <ul className="mt-2 flex flex-col gap-2">
            {overdueItems.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/m/${a.meeting_id}`}
                  className="block rounded-lg px-1.5 py-1 transition-colors hover:bg-black/[0.04]"
                >
                  <span className="line-clamp-2 block text-[12px] leading-snug">{a.description}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10.5px]">
                    <span className="font-medium tabular-nums text-red-700">due {dueLabel(a.due_date)}</span>
                    <span className="truncate opacity-40">{a.owner || "unassigned"}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/actions?urgent=overdue"
            className="mt-2 block text-[11.5px] underline underline-offset-2 opacity-50 hover:opacity-100"
          >
            All overdue &rarr;
          </Link>
        </Panel>
      ) : null}
    </aside>
  );
}

/* ------------------------------------------------------------- owner panel (/actions) */

/** Who is carrying what, straight off the list already on screen — no extra query, and it
 * re-counts under whatever filter is active, which is the useful behaviour. */
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
      <Panel title={`Owners · ${view === "open" ? "open" : "completed"}`}>
        <ul className="mt-2 flex flex-col gap-1.5">
          {owners.map(([owner, row]) => (
            <li key={owner}>
              <Link
                href={hrefFor(owner === "Unassigned" ? "" : owner)}
                className="block rounded-md px-1 py-0.5 transition-colors hover:bg-black/[0.04]"
              >
                <span className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className={`truncate ${owner === "Unassigned" ? "opacity-45" : ""}`}>{owner}</span>
                  <span className="shrink-0 tabular-nums opacity-45">
                    {row.overdue ? <span className="mr-1 text-red-700">{row.overdue} late</span> : null}
                    {row.n}
                  </span>
                </span>
                {/* One bar, two parts: how much of this owner's pile is already late. */}
                <span className="mt-1 flex h-1 w-full overflow-hidden rounded-full bg-black/5">
                  <span className="bg-red-500/75" style={{ width: `${(row.overdue / top) * 100}%` }} />
                  <span
                    className="bg-black/30"
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
          <ul className="mt-2 flex flex-col gap-1 text-[12px]">
            <DeckRow label="Past due" value={overdue} tone={overdue ? "red" : undefined} />
            <DeckRow label="No due date" value={noDate} />
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
    <section className="rounded-xl border border-black/8 bg-white p-3">
      <h2 className="text-[11px] font-semibold tracking-wide uppercase opacity-40">{title}</h2>
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
      <span className="block text-[10.5px] font-semibold tracking-wide uppercase opacity-40">{label}</span>
      <span
        className={`mt-0.5 block text-[24px] leading-none font-semibold tabular-nums ${alarm ? "text-red-700" : ""}`}
      >
        {value}
      </span>
      <span className="mt-1 block truncate text-[10.5px] opacity-40">{sub}</span>
    </>
  );
  const cls = "block rounded-xl border border-black/8 bg-white p-2.5 transition-colors";
  return href ? (
    <Link href={href} className={`${cls} hover:border-black/25`}>
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
  tone?: "amber" | "red";
}) {
  const colour = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "";
  const inner = (
    <>
      <span className={value ? "" : "opacity-40"}>{label}</span>
      <span className={`tabular-nums ${value ? `font-medium ${colour}` : "opacity-35"}`}>{value}</span>
    </>
  );
  return (
    <li>
      {href && value ? (
        <Link
          href={href}
          className="flex items-baseline justify-between rounded-md px-1 py-0.5 hover:bg-black/[0.04]"
        >
          {inner}
        </Link>
      ) : (
        <span className="flex items-baseline justify-between px-1 py-0.5">{inner}</span>
      )}
    </li>
  );
}
