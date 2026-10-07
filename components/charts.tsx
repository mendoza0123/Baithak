import Link from "next/link";
import type { MeetingType } from "@/lib/queries";

/**
 * Charts as plain SVG, rendered on the server.
 *
 * No chart library and no client JavaScript: every mark here is a rect or a path,
 * which a server component can emit directly. That keeps the page consistent with
 * how the rest of this app works (force-dynamic, almost nothing shipped to the
 * browser) and costs nothing in capability for bars, coverage and heatmaps.
 *
 * Colour comes from the CSS tokens, so each chart follows the theme without a
 * second dark-mode code path. Every series is also directly labelled — the light
 * orange and aqua steps sit just under 3:1 against the surface, and a visible
 * label is what makes that legitimate rather than decorative.
 */

/* --------------------------------------------------------------------- helpers */

/** Horizontal bar: square where it meets the baseline, rounded at the data end. */
function hbar(x0: number, y: number, len: number, h: number, r = 4) {
  const x1 = x0 + Math.max(len, r + 1);
  return `M${x0},${y}H${x1 - r}Q${x1},${y} ${x1},${y + r}V${y + h - r}Q${x1},${y + h} ${x1 - r},${y + h}H${x0}Z`;
}

/** Vertical bar: square on the baseline, rounded at the top. */
function vbar(x: number, base: number, h: number, w: number, r = 4) {
  const top = base - Math.max(h, r + 1);
  return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`;
}

const SERIES: Record<MeetingType, string> = {
  mis: "var(--series-1)",
  sales: "var(--series-2)",
  other: "var(--series-3)",
  unclassified: "var(--series-0)",
};

const TYPE_LABEL: Record<MeetingType, string> = {
  mis: "MIS",
  sales: "Sales",
  other: "Other",
  unclassified: "Unclassified",
};

/* ------------------------------------------------------------------ stat tile */

/**
 * A single number is a tile, not a chart. Angle and area are the hardest
 * encodings to read; a big tabular figure is the easiest.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "danger" | "warning" | "success";
  href?: string;
}) {
  const border =
    tone === "danger"
      ? "border-danger"
      : tone === "warning"
        ? "border-warning"
        : tone === "success"
          ? "border-success"
          : "border-subtle";
  const ink =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-ink";
  const eyebrow =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-ink-3";

  const body = (
    <>
      <span className={`eyebrow block ${eyebrow}`}>{label}</span>
      <span className={`num mt-2 block text-stat font-medium tracking-tight ${ink}`}>{value}</span>
      {sub ? <span className="mt-1.5 block text-meta text-ink-2">{sub}</span> : null}
    </>
  );

  const cls = `block rounded-card border bg-surface p-4 transition-colors ${border}`;
  return href ? (
    <Link href={href} className={`${cls} hover:border-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* ---------------------------------------------------------- bars by meeting type */

/** Magnitude by identity → horizontal bars, direct-labelled, no legend needed. */
export function TypeBars({ data }: { data: { type: MeetingType; n: number }[] }) {
  const rows = data.filter((d) => d.n > 0);
  if (!rows.length) return null;

  const max = Math.max(...rows.map((r) => r.n));
  const x0 = 76;
  const full = 300;
  const h = 20;
  const step = 30;
  const height = rows.length * step + 4;

  return (
    <svg
      viewBox={`0 0 440 ${height}`}
      width="100%"
      height="auto"
      role="img"
      aria-label={`Open items by meeting type: ${rows.map((r) => `${TYPE_LABEL[r.type]} ${r.n}`).join(", ")}`}
      className="block overflow-visible"
    >
      {rows.map((r, i) => {
        const y = 2 + i * step;
        const len = Math.round((r.n / max) * full);
        return (
          <g key={r.type}>
            <text x={0} y={y + h / 2 + 4} className="fill-ink-2" fontSize="12" fontWeight="500">
              {TYPE_LABEL[r.type]}
            </text>
            <path d={hbar(x0, y, len, h)} fill={SERIES[r.type]} />
            <text
              x={x0 + Math.max(len, 5) + 8}
              y={y + h / 2 + 4}
              className="fill-ink num"
              fontSize="12"
              fontWeight="500"
            >
              {r.n}
            </text>
          </g>
        );
      })}
      <line x1={x0} y1={0} x2={x0} y2={height - 2} className="stroke-subtle" strokeWidth="1" />
    </svg>
  );
}

/* ------------------------------------------------------------- deadline coverage */

/** Two parts of one whole, each labelled with its own count. */
export function CoverageBar({ dated, undated }: { dated: number; undated: number }) {
  const total = dated + undated;
  if (!total) return null;
  const w = 440;
  const gap = 2;
  const datedW = Math.max(Math.round((dated / total) * (w - gap)), dated > 0 ? 4 : 0);
  const undatedW = w - gap - datedW;
  const pct = Math.round((undated / total) * 100);

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} 26`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`Deadline coverage: ${dated} of ${total} open items have a due date, ${undated} do not`}
        className="block"
      >
        {datedW > 0 ? <rect x={0} y={0} width={datedW} height={26} rx={4} fill="var(--series-1)" /> : null}
        {undatedW > 0 ? (
          <rect x={datedW + gap} y={0} width={undatedW} height={26} rx={4} fill="var(--series-0)" />
        ) : null}
      </svg>
      <div className="mt-2 flex items-baseline justify-between gap-3 text-meta">
        <span className="num font-medium text-ink">{dated} dated</span>
        <span className="num font-medium text-ink">{undated} undated</span>
      </div>
      <p className="mt-3 text-meta leading-relaxed text-ink-2">
        <strong className="font-semibold text-ink">{pct}% carry no deadline</strong>, so “overdue”
        can only ever describe a fraction of the backlog. Age since the meeting is the signal that
        covers the rest.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- age buckets */

const AGE_STEPS = ["var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)", "var(--seq-5)"];

/**
 * Age is a magnitude across ordered buckets, so it gets one hue stepped light to
 * dark — never five unrelated colours pretending to be a scale.
 */
export function AgeBars({
  buckets,
}: {
  buckets: { label: string; n: number }[];
}) {
  const max = Math.max(...buckets.map((b) => b.n), 1);
  const w = 112;
  const gap = 18;
  const base = 56;
  const total = buckets.length * w + (buckets.length - 1) * gap;

  return (
    <svg
      viewBox={`0 0 ${total} 98`}
      width="100%"
      height="auto"
      role="img"
      aria-label={`Open backlog by age since the meeting: ${buckets.map((b) => `${b.label} ${b.n}`).join(", ")}`}
      className="block overflow-visible"
    >
      {buckets.map((b, i) => {
        const x = i * (w + gap);
        const h = Math.round((b.n / max) * 44);
        return (
          <g key={b.label}>
            {b.n > 0 ? <path d={vbar(x, base, h, w)} fill={AGE_STEPS[i] ?? AGE_STEPS[4]} /> : null}
            <text
              x={x + w / 2}
              y={74}
              textAnchor="middle"
              className="fill-ink num"
              fontSize="13"
              fontWeight="500"
            >
              {b.n}
            </text>
            <text x={x + w / 2} y={91} textAnchor="middle" className="fill-ink-3" fontSize="11">
              {b.label}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={base} x2={total} y2={base} className="stroke-subtle" strokeWidth="1" />
    </svg>
  );
}

/* ------------------------------------------------------------------ flow bars */

/**
 * Two series per period → grouped bars, not stacked: the question is "which is
 * bigger", and a stack makes the second series impossible to compare because it
 * no longer shares a baseline.
 *
 * Two series means a legend is mandatory, so identity is never colour-alone.
 * A 2px gap separates the pair so the boundary reads without an outline.
 */
export function FlowBars({
  data,
  aLabel,
  bLabel,
}: {
  data: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
}) {
  if (!data.length) return null;

  const max = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  const bw = 15;
  const pairGap = 2;
  const slot = bw * 2 + pairGap + 16;
  const base = 104;
  const plot = 86;
  const left = 26;
  const width = left + data.length * slot;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} 126`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`${aLabel} versus ${bLabel} per week: ${data.map((d) => `${d.label} ${d.a} and ${d.b}`).join(", ")}`}
        className="block overflow-visible"
      >
        <line x1={left} y1={base} x2={width} y2={base} className="stroke-subtle" strokeWidth="1" />
        <line x1={left} y1={base - plot / 2} x2={width} y2={base - plot / 2} className="stroke-subtle" strokeWidth="1" strokeOpacity="0.5" />
        <text x={0} y={base + 4} className="fill-ink-3 num" fontSize="10">
          0
        </text>
        <text x={0} y={base - plot + 4} className="fill-ink-3 num" fontSize="10">
          {max}
        </text>

        {data.map((d, i) => {
          const x = left + 8 + i * slot;
          return (
            <g key={d.label}>
              <path d={vbar(x, base, Math.round((d.a / max) * plot), bw)} fill="var(--series-1)" />
              <path
                d={vbar(x + bw + pairGap, base, Math.round((d.b / max) * plot), bw)}
                fill="var(--series-3)"
              />
              <text
                x={x + bw + pairGap / 2}
                y={base + 18}
                textAnchor="middle"
                className="fill-ink-3"
                fontSize="10"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-meta text-ink-2">
          <span className="size-2.5 rounded-[2px] bg-series-1" aria-hidden />
          {aLabel}
        </span>
        <span className="flex items-center gap-1.5 text-meta text-ink-2">
          <span className="size-2.5 rounded-[2px] bg-series-3" aria-hidden />
          {bLabel}
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- cadence heatmap */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Density over time → one hue, light to dark. Weeks across, weekdays down. */
export function CadenceHeatmap({ cells }: { cells: { week: string; dow: number; n: number }[] }) {
  if (!cells.length) return null;

  const weeks = [...new Set(cells.map((c) => c.week))].sort();
  const max = Math.max(...cells.map((c) => c.n), 1);
  const byKey = new Map(cells.map((c) => [`${c.week}:${c.dow}`, c.n]));

  const cell = 15;
  const gapPx = 3;
  const labelW = 30;
  const width = labelW + weeks.length * (cell + gapPx);
  const height = 7 * (cell + gapPx) + 4;

  /** Five steps plus "nothing". Zero reads as the surface, not as the palest step. */
  const step = (n: number) => {
    if (n <= 0) return "var(--sunken)";
    const i = Math.min(Math.ceil((n / max) * 5), 5);
    return AGE_STEPS[i - 1];
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`Meetings per weekday across the last ${weeks.length} weeks`}
        className="block"
      >
        {DOW.map((d, row) => (
          <text
            key={d}
            x={0}
            y={row * (cell + gapPx) + cell - 3}
            className="fill-ink-3"
            fontSize="9.5"
          >
            {d}
          </text>
        ))}
        {weeks.map((week, col) =>
          DOW.map((_, row) => {
            const n = byKey.get(`${week}:${row + 1}`) ?? 0;
            return (
              <rect
                key={`${week}-${row}`}
                x={labelW + col * (cell + gapPx)}
                y={row * (cell + gapPx)}
                width={cell}
                height={cell}
                rx={3}
                fill={step(n)}
              />
            );
          }),
        )}
      </svg>
      <div className="mt-3 flex items-center gap-2 text-label text-ink-3">
        <span>Fewer</span>
        <span className="flex gap-[3px]" aria-hidden>
          <span className="size-3 rounded-[3px] bg-sunken" />
          {AGE_STEPS.map((c) => (
            <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />
          ))}
        </span>
        <span>More</span>
      </div>
    </div>
  );
}
