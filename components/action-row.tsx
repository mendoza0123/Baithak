import { clock, dueLabel, isOverdue } from "@/lib/format";
import type { ActionItem, MeetingType } from "@/lib/queries";
import { ActionStatus } from "@/components/action-status";
import { TypeBadge } from "@/components/badges";

export function ActionRow({
  a,
  footer,
  interactive = false,
  stale = false,
  type,
}: {
  a: ActionItem;
  footer?: React.ReactNode;
  /** Show the done/open checkbox. Off by default so read-only contexts don't get one. */
  interactive?: boolean;
  /** Caller-computed (needs recorded_at, which plain ActionItem doesn't carry) — see isStale(). */
  stale?: boolean;
  /** Shown when a list mixes types together — pointless on a single meeting's own page. */
  type?: MeetingType;
}) {
  const due = dueLabel(a.due_date);
  const done = a.status !== "open";
  const toggleable = interactive && (a.status === "open" || a.status === "done");

  return (
    <div
      className={`rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035] ${
        done ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        {toggleable ? (
          <div className="pt-0.5">
            <ActionStatus id={a.id} status={a.status as "open" | "done"} />
          </div>
        ) : null}
        <p className={`min-w-0 text-[14px] leading-snug ${done ? "line-through" : ""}`}>
          {a.description}
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        {type ? <TypeBadge type={type} /> : null}
        {a.owner ? (
          <span className="rounded-full bg-black/6 px-2 py-0.5 font-medium dark:bg-white/10">
            {a.owner}
          </span>
        ) : (
          <span className="rounded-full bg-black/6 px-2 py-0.5 opacity-50 dark:bg-white/10">
            unassigned
          </span>
        )}
        {a.priority === "high" ? (
          <span className="rounded-full bg-red-500/14 px-2 py-0.5 font-medium text-red-700 dark:text-red-400">
            high
          </span>
        ) : null}
        {due ? (
          <span
            className={`rounded-full px-2 py-0.5 tabular-nums ${
              !done && isOverdue(a.due_date)
                ? "bg-red-500/14 font-medium text-red-700 dark:text-red-400"
                : "bg-black/6 opacity-60 dark:bg-white/10"
            }`}
          >
            due {due}
          </span>
        ) : null}
        {!done && !due && stale ? (
          <span className="rounded-full bg-amber-500/14 px-2 py-0.5 font-medium text-amber-700 dark:text-amber-400">
            open 2+ weeks
          </span>
        ) : null}
        {a.status === "dropped" ? <span className="opacity-50">dropped</span> : null}
        {a.source_ms != null ? <span className="font-mono opacity-30">@{clock(a.source_ms)}</span> : null}
      </div>

      {a.status_note ? <p className="mt-1.5 text-[11px] opacity-40">{a.status_note}</p> : null}

      {footer}
    </div>
  );
}
