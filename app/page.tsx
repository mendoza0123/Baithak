import Link from "next/link";
import { Shell } from "@/components/shell";
import { StatusBadge, TypeBadge, statusLabel } from "@/components/badges";
import { currentRole } from "@/lib/session";
import { ist, mins } from "@/lib/format";
import { listMeetings, statusCounts, typeCounts, type MeetingRow, type Status } from "@/lib/queries";

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

function href(current: Record<string, string>, patch: Record<string, string | null>) {
  const p = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export default async function MeetingsPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
  const filter = { status: one(sp.status), type: one(sp.type), search: one(sp.q) };
  const active = { ...(filter.status && { status: filter.status }), ...(filter.type && { type: filter.type }), ...(filter.search && { q: filter.search }) };

  const [role, meetings, counts, types] = await Promise.all([
    currentRole(),
    listMeetings(filter),
    statusCounts(),
    typeCounts(),
  ]);

  const byStatus = new Map(counts.map((c) => [c.status, c.count]));
  const byType = new Map(types.map((t) => [t.meeting_type, t.count]));
  const total = counts.reduce((n, c) => n + c.count, 0);
  const filtered = Boolean(filter.status || filter.type || filter.search);

  return (
    <Shell role={role} active="meetings">
      {/* Status strip — horizontally scrollable on a phone rather than wrapping into a wall */}
      <div className="-mx-4 mb-3 overflow-x-auto px-4">
        <div className="flex w-max gap-1.5">
          <Chip href={href(active, { status: null })} on={!filter.status} label="All" count={total} />
          {STATUS_ORDER.filter((s) => byStatus.has(s)).map((s) => (
            <Chip
              key={s}
              href={href(active, { status: filter.status === s ? null : s })}
              on={filter.status === s}
              label={statusLabel(s)}
              count={byStatus.get(s) ?? 0}
            />
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {TYPES.filter((t) => byType.has(t)).map((t) => (
          <Chip
            key={t}
            href={href(active, { type: filter.type === t ? null : t })}
            on={filter.type === t}
            label={t === "mis" ? "MIS" : t[0].toUpperCase() + t.slice(1)}
            count={byType.get(t) ?? 0}
          />
        ))}
      </div>

      <form className="mb-4 flex gap-2">
        {filter.status ? <input type="hidden" name="status" value={filter.status} /> : null}
        {filter.type ? <input type="hidden" name="type" value={filter.type} /> : null}
        <input
          name="q"
          defaultValue={filter.search}
          placeholder="Search titles…"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-[15px] outline-none placeholder:opacity-40 focus:border-black/25 dark:border-white/12 dark:bg-white/[0.04] dark:focus:border-white/30"
        />
        <button
          type="submit"
          className="rounded-lg border border-black/10 px-3 py-2 text-[14px] font-medium dark:border-white/12"
        >
          Search
        </button>
      </form>

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
        <ul className="flex flex-col gap-2">
          {meetings.map((m) => (
            <li key={m.id}>
              <MeetingCard m={m} />
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

function Chip({ href, on, label, count }: { href: string; on: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
        on
          ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
          : "border-black/10 hover:border-black/25 dark:border-white/12 dark:hover:border-white/30"
      }`}
    >
      {label} <span className="opacity-50 tabular-nums">{count}</span>
    </Link>
  );
}

function MeetingCard({ m }: { m: MeetingRow }) {
  const duration = mins(m.duration_sec);
  const summarised = Boolean(m.title_en);

  return (
    <Link
      href={`/m/${m.id}`}
      className="block rounded-xl border border-black/8 bg-white p-3.5 transition-colors hover:border-black/20 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/25"
    >
      <div className="flex items-center gap-2 text-[12px] opacity-50">
        <span className="tabular-nums">{ist(m.recorded_at)}</span>
        {duration ? <span className="tabular-nums">· {duration}</span> : null}
        {m.sensitive ? <span className="text-amber-600 dark:text-amber-400">· sensitive</span> : null}
      </div>

      <h2 className="mt-1 text-[15px] leading-snug font-medium">
        {m.title_en || m.title_original || "Untitled recording"}
      </h2>

      {!summarised && m.title_original ? (
        <p className="mt-0.5 text-[12px] opacity-40">Original title — not yet summarised</p>
      ) : null}

      {m.gist ? <p className="mt-1.5 line-clamp-2 text-[13.5px] opacity-65">{m.gist}</p> : null}

      {m.status_reason ? (
        <p className="mt-1.5 text-[12.5px] opacity-45">{m.status_reason}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
