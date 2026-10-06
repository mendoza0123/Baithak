import { Clock, Hourglass } from "lucide-react";
import { clock, dueLabel, isOverdue } from "@/lib/format";
import type { ActionItem, MeetingType } from "@/lib/queries";
import { ActionStatus } from "@/components/action-status";
import { TypeBadge } from "@/components/badges";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label";

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
  const overdue = !done && isOverdue(a.due_date);

  return (
    <div
      data-nav
      tabIndex={-1}
      data-open={`/m/${a.meeting_id}`}
      className={`rounded-card border bg-surface p-3 transition-colors lg:hover:border-strong ${
        done ? "border-subtle" : overdue ? "border-danger" : "border-subtle"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {toggleable ? (
          <div className="pt-0.5">
            <ActionStatus id={a.id} status={a.status as "open" | "done"} label={a.description} />
          </div>
        ) : null}
        <p
          className={`min-w-0 text-body ${done ? "text-ink-3 line-through" : "text-ink"}`}
        >
          {a.description}
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {type ? <TypeBadge type={type} /> : null}

        {a.owner ? (
          <span className={`${pill} bg-sunken font-medium text-ink`}>{a.owner}</span>
        ) : (
          <span className={`${pill} bg-sunken text-ink-3`}>unassigned</span>
        )}

        {a.priority === "high" ? (
          <span className={`${pill} bg-danger-wash font-semibold text-danger`}>High</span>
        ) : null}

        {due ? (
          <span
            className={`${pill} num ${
              overdue ? "bg-danger-wash font-semibold text-danger" : "bg-sunken text-ink-2"
            }`}
          >
            {overdue ? <Clock size={10} strokeWidth={3} aria-hidden /> : null}
            due {due}
          </span>
        ) : null}

        {!done && !due && stale ? (
          <span className={`${pill} bg-warning-wash font-semibold text-warning`}>
            <Hourglass size={10} strokeWidth={2.75} aria-hidden />
            Open 2+ weeks
          </span>
        ) : null}

        {a.status === "dropped" ? <span className="text-label text-ink-3">dropped</span> : null}

        {a.source_ms != null ? (
          <span className="num text-label text-ink-3">@{clock(a.source_ms)}</span>
        ) : null}
      </div>

      {a.status_note ? <p className="mt-1.5 text-label text-ink-3">{a.status_note}</p> : null}

      {footer}
    </div>
  );
}
