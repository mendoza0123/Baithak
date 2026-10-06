import { AlertTriangle, Check, CircleSlash, Mail, Search } from "lucide-react";
import type { MeetingType, Status } from "@/lib/queries";

/**
 * Status is icon + label + colour, never colour alone — so it still reads in
 * greyscale, in forced-colours mode, and for anyone who can't separate the
 * amber from the green.
 */
const STATUS: Record<
  Status,
  { label: string; cls: string; Icon?: typeof Check; inProgress?: boolean }
> = {
  discovered: { label: "Discovered", cls: "bg-sunken text-ink-2", Icon: Search },
  pending_transcript: {
    label: "Waiting for transcript",
    cls: "bg-sunken text-ink-2",
    inProgress: true,
  },
  summarising: { label: "Summarising", cls: "bg-sunken text-ink-2", inProgress: true },
  awaiting_approval: {
    label: "Awaiting approval",
    cls: "bg-warning-wash text-warning",
    Icon: AlertTriangle,
  },
  ready: { label: "Ready", cls: "bg-success-wash text-success", Icon: Check },
  emailed: { label: "Emailed", cls: "bg-success-wash text-success", Icon: Mail },
  skipped: { label: "Skipped", cls: "bg-sunken text-ink-3", Icon: CircleSlash },
  failed: { label: "Failed", cls: "bg-danger-wash text-danger", Icon: AlertTriangle },
};

export const statusLabel = (s: Status) => STATUS[s]?.label ?? s;
export const isInProgress = (s: Status) => Boolean(STATUS[s]?.inProgress);

/**
 * The type badge's colour lives in the square, not the text — identity is
 * carried by a mark beside the label, and the label itself wears an ink token.
 * These are the same three validated series hues the charts use, so a chip and
 * a bar for "MIS" are always the same colour.
 */
const TYPE: Record<MeetingType, { label: string; swatch: string }> = {
  mis: { label: "MIS", swatch: "bg-series-1" },
  sales: { label: "Sales", swatch: "bg-series-2" },
  other: { label: "Other", swatch: "bg-series-3" },
  unclassified: { label: "Unclassified", swatch: "bg-series-0" },
};

export const typeLabel = (t: MeetingType) => TYPE[t]?.label ?? t;

const base = "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-label font-medium";

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-sunken text-ink-3" };
  const Icon = s.Icon;
  return (
    <span className={`${base} ${s.cls}`}>
      {s.inProgress ? (
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      ) : Icon ? (
        <Icon size={11} strokeWidth={2.75} aria-hidden />
      ) : null}
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: MeetingType }) {
  const t = TYPE[type] ?? { label: type, swatch: "bg-series-0" };
  return (
    <span className={`${base} bg-sunken text-ink-2`}>
      <span className={`size-2 shrink-0 rounded-[2px] ${t.swatch}`} aria-hidden />
      {t.label}
    </span>
  );
}
