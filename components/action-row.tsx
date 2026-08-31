import { clock, dueLabel, isOverdue } from "@/lib/format";
import type { ActionItem } from "@/lib/queries";

export function ActionRow({ a, footer }: { a: ActionItem; footer?: React.ReactNode }) {
  const due = dueLabel(a.due_date);
  const done = a.status !== "open";

  return (
    <div
      className={`rounded-xl border border-black/8 bg-white p-3 dark:border-white/10 dark:bg-white/[0.035] ${
        done ? "opacity-50" : ""
      }`}
    >
      <p className={`text-[14px] leading-snug ${done ? "line-through" : ""}`}>{a.description}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
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
        {done ? <span className="opacity-50">{a.status}</span> : null}
        {a.source_ms != null ? <span className="font-mono opacity-30">@{clock(a.source_ms)}</span> : null}
      </div>

      {footer}
    </div>
  );
}
