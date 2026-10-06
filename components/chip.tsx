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

export function Chip({
  href,
  on,
  label,
  count,
  block = false,
  swatch,
}: {
  href: string;
  on: boolean;
  label: string;
  count: number;
  /** Desktop only: become a full-width rail row with the count pushed right. No mobile effect. */
  block?: boolean;
  /** Background class for a leading identity square, where the chip names a charted series. */
  swatch?: string;
}) {
  return (
    <Link
      href={href}
      // min-h-9 keeps the tap target at 36px+ in the mobile strip; the desktop
      // rail row relaxes it since a pointer is driving.
      className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-support whitespace-nowrap transition-colors ${
        block ? "lg:flex lg:w-full lg:justify-between lg:rounded-control lg:px-2.5 lg:min-h-8 lg:text-meta" : ""
      } ${
        on
          ? "border-accent bg-accent text-accent-ink"
          : "border-subtle text-ink-2 hover:border-strong hover:text-ink lg:hover:bg-sunken"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {swatch ? <span className={`size-2 shrink-0 rounded-[2px] ${swatch}`} aria-hidden /> : null}
        {label}
      </span>
      <span className={`num text-meta ${on ? "text-accent-ink-2" : "text-ink-3"}`}>{count}</span>
    </Link>
  );
}
