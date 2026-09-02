import Link from "next/link";

/** Toggle one query param on/off, preserving the rest — the filter-chip pattern used on both
 * the Meetings and Actions pages. */
export function chipHref(base: string, current: Record<string, string>, patch: Record<string, string | null>) {
  const p = new URLSearchParams(current);
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

export function Chip({ href, on, label, count }: { href: string; on: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
        on
          ? "border-transparent bg-black text-white dark:bg-white dark:text-black"
          : "border-black/10 hover:border-black/25 dark:border-white/12 dark:hover:border-white/30"
      }`}
    >
      {label} <span className="opacity-50 tabular-nums">{count}</span>
    </Link>
  );
}
