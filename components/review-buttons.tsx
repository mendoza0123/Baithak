"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Decision = "approve" | "skip" | "requeue";

const CONFIRM: Record<Decision, string> = {
  approve: "Approve this brief? It becomes ready for distribution.",
  skip: "Skip this meeting? Its brief will not be distributed.",
  requeue: "Requeue this meeting? The pipeline will retry it from the transcript step.",
};

export function ReviewButtons({ id, decisions }: { id: string; decisions: Decision[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(decision: Decision) {
    if (!window.confirm(CONFIRM[decision])) return;
    setError(null);
    setBusy(decision);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const label: Record<Decision, string> = {
    approve: "Approve",
    skip: "Skip",
    requeue: "Requeue",
  };
  const style: Record<Decision, string> = {
    approve: "bg-emerald-600 text-white hover:bg-emerald-700",
    skip: "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
    requeue: "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => run(d)}
            disabled={busy !== null || pending}
            className={`rounded-lg px-4 py-2 text-[14px] font-medium disabled:opacity-50 ${style[d]}`}
          >
            {busy === d ? "Working…" : label[d]}
          </button>
        ))}
      </div>
      {error ? <p className="mt-2 text-[13px] text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
