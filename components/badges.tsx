import type { MeetingType, Status } from "@/lib/queries";

const STATUS: Record<Status, { label: string; cls: string; inProgress?: boolean }> = {
  discovered: { label: "Discovered", cls: "bg-slate-500/12 text-slate-600 dark:text-slate-300" },
  pending_transcript: {
    label: "Waiting for transcript",
    cls: "bg-slate-500/12 text-slate-500 dark:text-slate-400",
    inProgress: true,
  },
  summarising: {
    label: "Summarising",
    cls: "bg-slate-500/12 text-slate-500 dark:text-slate-400",
    inProgress: true,
  },
  awaiting_approval: {
    label: "Awaiting approval",
    cls: "bg-amber-500/18 text-amber-700 dark:text-amber-300",
  },
  ready: { label: "Ready", cls: "bg-emerald-500/16 text-emerald-700 dark:text-emerald-300" },
  emailed: { label: "Emailed", cls: "bg-emerald-500/16 text-emerald-700 dark:text-emerald-300" },
  skipped: { label: "Skipped", cls: "bg-zinc-500/12 text-zinc-500 dark:text-zinc-400" },
  failed: { label: "Failed", cls: "bg-red-500/16 text-red-700 dark:text-red-400" },
};

export const statusLabel = (s: Status) => STATUS[s]?.label ?? s;
export const isInProgress = (s: Status) => Boolean(STATUS[s]?.inProgress);

const TYPE: Record<MeetingType, { label: string; cls: string }> = {
  mis: { label: "MIS", cls: "bg-indigo-500/14 text-indigo-700 dark:text-indigo-300" },
  sales: { label: "Sales", cls: "bg-teal-500/14 text-teal-700 dark:text-teal-300" },
  other: { label: "Other", cls: "bg-zinc-500/12 text-zinc-600 dark:text-zinc-400" },
  unclassified: { label: "Unclassified", cls: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-500" },
};

export const typeLabel = (t: MeetingType) => TYPE[t]?.label ?? t;

const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium";

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-zinc-500/12 text-zinc-500" };
  return (
    <span className={`${base} ${s.cls}`}>
      {"inProgress" in s && s.inProgress ? (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      ) : null}
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: MeetingType }) {
  const t = TYPE[type] ?? { label: type, cls: "bg-zinc-500/12 text-zinc-500" };
  return <span className={`${base} ${t.cls}`}>{t.label}</span>;
}
