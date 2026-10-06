import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { agoLabel, ist, isOlderThanHours } from "@/lib/format";
import type { SyncState } from "@/lib/queries";

/** Older than this with no successful run and the sync is presumed stuck. */
const STUCK_AFTER_HOURS = 26;

/**
 * "Is what I'm looking at current?" — answerable without asking Aditya, which is the whole point.
 *
 * Prefers what the sync job reports about itself (sync_state), and falls back to when data last
 * actually landed. The fallback isn't a nicety: the job doesn't write sync_state yet, so without
 * it this bar would render nothing at all until that job is changed.
 */
export function FreshnessBar({ s, className = "" }: { s: SyncState | null; className?: string }) {
  if (!s) return null;

  const reported = Boolean(s.last_run_at);
  const at = s.last_run_at ?? s.newest_row_at;
  if (!at) return null;

  const stale = isOlderThanHours(at, STUCK_AFTER_HOURS);
  const failed = reported && s.last_run_status !== null && s.last_run_status !== "ok";

  // State is carried by an icon and a word as well as the tint — a red bar that
  // only differs by colour is invisible to a good share of the people reading it.
  const tone = stale
    ? "bg-danger-wash text-danger"
    : failed
      ? "bg-warning-wash text-warning"
      : "bg-sunken text-ink-2";

  const ago = agoLabel(at);

  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-1.5 text-meta ${tone} ${className}`}
    >
      <span className="flex items-center gap-1.5 self-center">
        {stale ? (
          <AlertTriangle size={12} strokeWidth={2.75} aria-hidden />
        ) : failed ? (
          <AlertTriangle size={12} strokeWidth={2.75} aria-hidden />
        ) : (
          <CheckCircle2 size={12} strokeWidth={2.5} aria-hidden />
        )}
        {stale ? <span className="font-semibold">Sync may be stuck —</span> : null}
      </span>

      <span>
        {reported ? "Last sync" : "Data last arrived"} {ago === "just now" ? ago : `${ago} ago`}
        <span className="num text-ink-3"> · {ist(at)}</span>
      </span>

      {s.recordings_new ? (
        <span className="font-semibold text-ink">
          {s.recordings_new} new meeting{s.recordings_new === 1 ? "" : "s"}
        </span>
      ) : null}

      {s.processing > 0 ? (
        <span className="flex items-center gap-1 self-center text-ink-3">
          <Loader2 size={11} strokeWidth={2.5} className="animate-spin" aria-hidden />
          {s.processing} processing
        </span>
      ) : null}

      {failed && s.last_run_note ? <span className="w-full">{s.last_run_note}</span> : null}
    </div>
  );
}
