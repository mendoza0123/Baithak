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
export function FreshnessBar({ s }: { s: SyncState | null }) {
  if (!s) return null;

  const reported = Boolean(s.last_run_at);
  const at = s.last_run_at ?? s.newest_row_at;
  if (!at) return null;

  const stale = isOlderThanHours(at, STUCK_AFTER_HOURS);
  const failed = reported && s.last_run_status !== null && s.last_run_status !== "ok";

  const tone = stale
    ? "bg-red-500/10 text-red-800"
    : failed
      ? "bg-amber-500/14 text-amber-800"
      : "bg-black/[0.04]";

  const ago = agoLabel(at);

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-4 py-1.5 text-[12px] ${tone}`}>
      {stale ? <span className="font-semibold">Sync may be stuck —</span> : null}

      <span className={stale || failed ? "" : "opacity-55"}>
        {reported ? "Last sync" : "Data last arrived"} {ago === "just now" ? ago : `${ago} ago`}
        <span className="opacity-60"> · {ist(at)}</span>
      </span>

      {s.recordings_new ? (
        <span className="font-medium">
          {s.recordings_new} new meeting{s.recordings_new === 1 ? "" : "s"}
        </span>
      ) : null}

      {s.processing > 0 ? (
        <span className="opacity-55">
          · {s.processing} processing
        </span>
      ) : null}

      {failed && s.last_run_note ? (
        <span className="w-full opacity-80">{s.last_run_note}</span>
      ) : null}
    </div>
  );
}
