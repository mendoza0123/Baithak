"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
      className="rounded-md px-1.5 py-1 text-[15px] leading-none opacity-45 hover:opacity-100 disabled:opacity-100"
    >
      <span className={pending ? "inline-block animate-spin" : "inline-block"}>↻</span>
    </button>
  );
}
