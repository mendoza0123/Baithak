"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

type Status = "open" | "done";

/** Marks an action item done or reopens it. Any signed-in team member can use it — checking off
 * a task isn't a distribution decision, it doesn't need the admin gate review used to have. */
export function ActionStatus({ id, status, label }: { id: string; status: Status; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = status === "done";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/actions/status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: done ? "open" : "done" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {/* The 20px box sits inside a 44px hit area via the negative-margin padding,
          so the tap target clears the touch minimum without changing the layout. */}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        data-toggle
        aria-pressed={done}
        aria-label={
          label ? `${done ? "Reopen" : "Mark done"}: ${label}` : done ? "Mark open again" : "Mark done"
        }
        className="-m-3 flex size-11 items-center justify-center p-3 disabled:cursor-progress"
      >
        <span
          className={`flex size-5 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
            done
              ? "border-success bg-success text-accent-ink"
              : "border-strong hover:border-accent hover:bg-accent-wash"
          } ${busy ? "opacity-60" : ""}`}
        >
          {busy ? (
            <Loader2 size={12} strokeWidth={3} className="animate-spin" aria-hidden />
          ) : done ? (
            <Check size={13} strokeWidth={3.5} aria-hidden />
          ) : null}
        </span>
      </button>
      {error ? (
        <span role="status" className="text-label text-danger">
          {error}
        </span>
      ) : null}
    </span>
  );
}
