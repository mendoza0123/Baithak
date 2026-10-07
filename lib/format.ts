const TZ = "Asia/Kolkata";

const day = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayWithYear = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }); // YYYY-MM-DD, sorts lexically = chronologically
const time = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "Wed 26 Aug, 12:50" — always IST, whatever the server's timezone is. */
export function ist(d: Date | string | null) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return `${day.format(date)}, ${time.format(date)}`;
}

export function mins(sec: number | null) {
  if (!sec) return null;
  return sec < 60 ? `${sec} sec` : `${Math.round(sec / 60)} min`;
}

/**
 * How long between two pipeline stages — "32 min", "1 hr 26 min", "4d 3h". Coarser as it grows,
 * because at two weeks nobody cares about the minutes.
 */
export function gap(from: Date | string | null, to: Date | string | null) {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!(ms >= 0)) return null;

  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 1) return "under a min";
  if (totalMin < 60) return `${totalMin} min`;

  const totalHr = Math.floor(totalMin / 60);
  if (totalHr < 24) {
    const m = totalMin % 60;
    return m ? `${totalHr} hr ${m} min` : `${totalHr} hr`;
  }

  const days = Math.floor(totalHr / 24);
  const h = totalHr % 24;
  return h ? `${days}d ${h}h` : `${days}d`;
}

/** "12:34" from transcript start_ms. */
export function clock(ms: number | null | undefined) {
  if (ms == null) return "--:--";
  const t = Math.floor(ms / 1000);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/** due_date arrives as a 'YYYY-MM-DD' string (cast in SQL) so no timezone can shift it. */
export function dueLabel(d: string | null) {
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(Date.UTC(y, m - 1, day)),
  );
}

export function isOverdue(d: string | null) {
  if (!d) return false;
  return d < isoDate.format(new Date());
}

/** IST calendar day as a sort/group key — "which day did this happen, in the timezone the
 * team is actually in," not whatever the server's UTC day happens to be. */
export function istDateKey(d: Date | string) {
  return isoDate.format(typeof d === "string" ? new Date(d) : d);
}

/**
 * Monday of the IST week containing `d`, as 'YYYY-MM-DD'.
 *
 * The arithmetic runs on a date-only UTC value rather than the original instant: once
 * istDateKey() has told us which IST calendar day this is, stepping back to Monday must not
 * be able to cross a day boundary again, which local-time maths on a Date can do.
 */
export function istWeekStart(d: Date | string = new Date()) {
  const [y, m, day] = istDateKey(d).split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, day));
  at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7)); // getUTCDay: 0 = Sunday
  return at.toISOString().slice(0, 10);
}

/** Step a 'YYYY-MM-DD' week start by whole weeks. Negative goes back. */
export function shiftWeek(weekStart: string, weeks: number) {
  const [y, m, d] = weekStart.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() + weeks * 7);
  return at.toISOString().slice(0, 10);
}

/** The seven IST days of a week, as 'YYYY-MM-DD' keys, Monday first. */
export function weekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function addDays(from: string, days: number) {
  const [y, m, d] = from.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/** "5 — 11 Oct 2026", collapsing the month and year when both ends share them. */
export function weekLabel(weekStart: string) {
  const end = addDays(weekStart, 6);
  const [sy, sm, sd] = weekStart.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const mon = (mm: number, yy: number) =>
    new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(yy, mm - 1, 1)),
    );
  if (sy === ey && sm === em) return `${sd} — ${ed} ${mon(em, ey)}`;
  if (sy === ey) return `${sd} ${mon(sm, sy).split(" ")[0]} — ${ed} ${mon(em, ey)}`;
  return `${sd} ${mon(sm, sy)} — ${ed} ${mon(em, ey)}`;
}

/** "Mon", for a 'YYYY-MM-DD' key. */
export function weekdayShort(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "5 Oct", for a 'YYYY-MM-DD' key. */
export function dayMonth(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** "Wed 26 Aug 2026" — a date-only version of ist(), for grouping headers. */
export function dayLabel(d: Date | string) {
  return dayWithYear.format(typeof d === "string" ? new Date(d) : d);
}

/** "12:50" — the time-only counterpart, for a label that already shows the date separately. */
export function timeLabel(d: Date | string) {
  return time.format(typeof d === "string" ? new Date(d) : d);
}

/**
 * Most action items never get a due_date (35 of 279 today), so it can't be the only staleness
 * signal — age since the meeting is the one proxy that covers everything.
 */
export function isStale(recordedAt: Date, days = 14) {
  return Date.now() - new Date(recordedAt).getTime() > days * 86_400_000;
}

/** Nothing heard for this long and the sync is presumed stuck. Lives here, not in the component,
 * because reading the clock during render trips react-hooks/purity. */
export function isOlderThanHours(d: Date | string, hours: number) {
  return Date.now() - new Date(d).getTime() > hours * 3_600_000;
}

/** How long ago, as a phrase: "2 hrs ago", "just now". */
export function agoLabel(d: Date | string) {
  return gap(d, new Date()) ?? "just now";
}

/**
 * The pipeline's brief opens with its own `# title` plus italic meta/participant lines, which the
 * meeting page header already shows. Drop them so the page does not say everything twice.
 * ponytail: a regex on a known generator's output — worst case the title shows twice again.
 */
export function stripBriefHeader(md: string) {
  return md.replace(/^#\s+[^\n]*\n(?:\s*\*[^\n]*\*\s*\n)*/, "").trimStart();
}
