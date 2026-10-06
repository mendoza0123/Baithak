"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";

/**
 * Every page already re-queries the database on every request (force-dynamic, no caching) — a
 * plain browser refresh shows current data with zero delay. This is just a visible, one-tap way
 * to do that soft-refresh without losing scroll position or filter state, for whoever's watching
 * a sync land and doesn't want to guess whether what's on screen is current.
 */
export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      title="Refresh"
      aria-label="Refresh"
      className="flex size-11 items-center justify-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink disabled:text-ink"
    >
      <RotateCw size={15} strokeWidth={2.25} className={pending ? "animate-spin" : ""} aria-hidden />
    </button>
  );
}
