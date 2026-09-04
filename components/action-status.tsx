"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "open" | "done";

/** Marks an action item done or reopens it. Any signed-in team member can use it — checking off
 * a task isn't a distribution decision, it doesn't need the admin gate review used to have. */
export function ActionStatus({ id, status }: { id: string; status: Status }) {
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
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        data-toggle
        aria-pressed={done}
        title={done ? "Mark open again" : "Mark done"}
        className={`flex size-[18px] shrink-0 items-center justify-center rounded-md border text-[11px] leading-none disabled:opacity-50 ${
          done
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-black/25 hover:border-black/45"
        }`}
      >
        {done ? "✓" : ""}
      </button>
      {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
    </span>
  );
}
