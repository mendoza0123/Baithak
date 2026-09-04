import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { Markdown } from "@/components/markdown";
import { ActionRow } from "@/components/action-row";
import { MeetingRail } from "@/components/panels";
import { currentSession } from "@/lib/session";
import { clock, gap, ist, mins, stripBriefHeader } from "@/lib/format";
import { getMeeting, listMeetings, meetingActions, type MeetingDetail } from "@/lib/queries";
import { asLang, render, type Lang } from "@/lib/hinglish";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MeetingPage({ params, searchParams }: PageProps<"/m/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();

  const [session, m, actions, siblings] = await Promise.all([
    currentSession(),
    getMeeting(id),
    meetingActions(id),
    // Feeds the desktop rail only. One indexed read on a page that is force-dynamic anyway.
    listMeetings({}),
  ]);
  if (!m) notFound();

  const transcript = Array.isArray(m.transcript) ? m.transcript : null;
  const lang = asLang(sp.lang);
  // Switching script is a navigation, so keep the sections open across it.
  const opened = Boolean(sp.lang);
  const participants = m.brief?.participants ?? [];
  const brief = m.brief;

  return (
    <Shell session={session} active="detail">
      {/* Three columns on a monitor: the meeting list you came from, the brief, and the Hindi
          source material beside it instead of buried under it. Every wrapper below is a plain
          block until `lg`, so a phone renders the same document in the same order as before. */}
      <div className="lg:flex lg:items-start lg:gap-6">
        <MeetingRail meetings={siblings} currentId={m.id} />

        <div className="lg:min-w-0 lg:flex-1 2xl:max-w-[920px]">
          <Link href="/" className="text-[13px] opacity-45 hover:opacity-100 lg:hidden">
            ← Meetings
          </Link>

          <h1 className="mt-2 text-[19px] leading-snug font-semibold lg:mt-0 lg:text-[22px]">
            {m.title_en || m.title_original || "Untitled recording"}
          </h1>
          {m.title_en && m.title_original ? (
            <p className="mt-1 text-[13px] opacity-45">{m.title_original}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] opacity-55">
            <span className="tabular-nums">{ist(m.recorded_at)} IST</span>
            {mins(m.duration_sec) ? <span className="tabular-nums">· {mins(m.duration_sec)}</span> : null}
            {m.version ? <span>· brief v{m.version}</span> : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={m.meeting_type} />
            <StatusBadge status={m.status} />
            {m.sensitive ? (
              <span className="rounded-full bg-amber-500/18 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                sensitive
              </span>
            ) : null}
          </div>

          {m.status_reason ? (
            <p className="mt-3 rounded-lg bg-black/4 px-3 py-2 text-[13px] opacity-70">{m.status_reason}</p>
          ) : null}
          {m.sensitivity_reason ? (
            <p className="mt-1.5 text-[12px] opacity-45">{m.sensitivity_reason}</p>
          ) : null}

          <Timeline m={m} />

          {participants.length > 0 && !m.summary_md ? (
            <p className="mt-4 text-[13px] opacity-60">
              <span className="opacity-70">Participants: </span>
              {participants
                .map((p) => [p.inferred_name || p.label, p.role && `(${p.role})`].filter(Boolean).join(" "))
                .join(", ")}
            </p>
          ) : null}

          <Card className="mt-4">
            {m.summary_md ? (
              <Markdown>{stripBriefHeader(m.summary_md)}</Markdown>
            ) : (
              <>
                <p className="text-[14px] opacity-55">
                  No English brief yet. The pipeline writes one once the transcript arrives.
                </p>
                {m.brief?.executive_summary ? (
                  <p className="mt-2 text-[14px]">{m.brief.executive_summary}</p>
                ) : null}
              </>
            )}
          </Card>

          {/* Structured recap — the same material the prose brief covers, but scannable rather than
              read start to finish. Straight from brief jsonb, no schema change involved. */}
          {brief?.decisions?.length || brief?.open_issues?.length || brief?.next_meeting_agenda?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <RecapList title="Decided" items={brief?.decisions} tone="emerald" />
              <RecapList title="Open issues" items={brief?.open_issues} tone="amber" />
              <RecapList title="Next agenda" items={brief?.next_meeting_agenda} tone="slate" />
            </div>
          ) : null}

          {actions.length > 0 ? (
            <section className="mt-4">
              <h2 className="mb-2 text-[13px] font-semibold opacity-55">Action items from this meeting</h2>
              <ul className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:items-start">
                {actions.map((a) => (
                  <li key={a.id}>
                    <ActionRow a={a} interactive />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {m.brief?.quality_notes ? (
            <p className="mt-4 text-[12.5px] opacity-45">Quality notes: {m.brief.quality_notes}</p>
          ) : null}
        </div>

        {/* The Hindi source: last on a phone, beside the brief on a desktop. Scrolls in its own
            column so the brief stays put while you read down the transcript. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:pr-1 lg:[&>*:first-child]:mt-0 2xl:w-[520px]">
          {/* One control for both Hindi sections. Script only — the words are identical either way. */}
          {m.plaud_summary_md || transcript?.length ? (
            <div id="hindi" className="mt-5 flex items-center gap-2 text-[12px]">
              <span className="opacity-45">Hindi text:</span>
              <ScriptTab id={m.id} to="hi" on={lang === "hi"} label="हिन्दी" />
              <ScriptTab id={m.id} to="hinglish" on={lang === "hinglish"} label="Hinglish" />
            </div>
          ) : null}

          {m.plaud_summary_md ? (
            <Disclosure title="Plaud's original note" className="mt-2" open={opened} desktopOpen>
              <Card className="mt-2">
                <Markdown>{render(m.plaud_summary_md, lang)}</Markdown>
              </Card>
            </Disclosure>
          ) : null}

          {transcript && transcript.length > 0 ? (
            <Disclosure
              title={`Transcript — ${transcript.length} segments`}
              className="mt-3"
              open={opened}
              desktopOpen
            >
              {/* The inner scroller is a phone affordance; in the desktop column the whole side
                  panel already scrolls, and two nested scrollbars are worse than one. */}
              <Card className="mt-2 max-h-[70vh] overflow-y-auto lg:max-h-none lg:overflow-visible">
                <ol className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed">
                  {transcript.map((seg, i) => (
                    <li key={i} className="grid grid-cols-[auto_1fr] gap-x-2">
                      <span className="pt-0.5 font-mono text-[11px] tabular-nums opacity-40">
                        {clock(seg.start_ms)}
                      </span>
                      <span className="min-w-0 break-words">
                        {seg.speaker ? <span className="font-medium opacity-70">{seg.speaker} — </span> : null}
                        {render(seg.text ?? "", lang)}
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            </Disclosure>
          ) : null}

          {m.model ? (
            <p className="mt-6 text-[11.5px] opacity-30">
              {m.model} · prompt {m.prompt_version} · {ist(m.summarised_at)}
            </p>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

/**
 * Where this recording has been: on the device, in Plaud's cloud, in this database, summarised.
 * The gaps are the point — a meeting can sit in Plaud for days before anything here can see it,
 * which is the usual answer to "why isn't my meeting showing up yet".
 *
 * Four stacked rows on a phone; four side-by-side steps once there's width for them.
 */
function Timeline({ m }: { m: MeetingDetail }) {
  const steps: { label: string; at: Date | null; from: Date | null }[] = [
    { label: "Recorded", at: m.recorded_at, from: null },
    { label: "In Plaud's cloud", at: m.synced_at, from: m.recorded_at },
    { label: "Picked up by Baithak", at: m.discovered_at, from: m.synced_at },
    { label: "Brief written", at: m.summarised_at, from: m.discovered_at },
  ];

  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1 rounded-lg bg-black/[0.03] px-3 py-2.5 text-[12px] lg:grid-cols-4 lg:gap-x-4 lg:px-4 lg:py-3">
      {steps.map((s) => {
        const waited = gap(s.from, s.at);
        return (
          <div
            key={s.label}
            className="col-span-3 grid grid-cols-subgrid items-baseline lg:col-span-1 lg:block lg:border-l lg:border-black/10 lg:pl-2.5"
          >
            <dt className="whitespace-nowrap opacity-50">{s.label}</dt>
            {/* No "IST" per row — the meta line above already says it, and repeating it four
                times wraps every row onto two lines at 360px. */}
            <dd className="whitespace-nowrap tabular-nums lg:mt-0.5 lg:font-medium">{s.at ? ist(s.at) : "—"}</dd>
            <dd className="text-right whitespace-nowrap tabular-nums opacity-40 lg:text-left">
              {waited ? `+${waited}` : ""}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-black/8 bg-white p-4 dark:border-white/10 dark:bg-white/[0.035] ${className}`}
    >
      {children}
    </div>
  );
}

const RECAP_TONE = {
  emerald: "border-emerald-500/25 bg-emerald-500/6",
  amber: "border-amber-500/25 bg-amber-500/6",
  slate: "border-black/10 bg-black/[0.02]",
} as const;

function RecapList({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[];
  tone: keyof typeof RECAP_TONE;
}) {
  if (!items?.length) return null;
  return (
    <div className={`rounded-xl border p-3.5 ${RECAP_TONE[tone]}`}>
      <h3 className="text-[12px] font-semibold opacity-60">{title}</h3>
      <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px] leading-snug">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="opacity-35">·</span>
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScriptTab({ id, to, on, label }: { id: string; to: Lang; on: boolean; label: string }) {
  return (
    <Link
      href={`/m/${id}?lang=${to}#hindi`}
      className={`rounded-full border px-2.5 py-1 transition-colors ${
        on ? "border-transparent bg-black text-white" : "border-black/12 hover:border-black/30"
      }`}
    >
      {label}
    </Link>
  );
}

function Disclosure({
  title,
  className = "",
  open = false,
  desktopOpen = false,
  children,
}: {
  title: string;
  className?: string;
  open?: boolean;
  /** Opened by the desktop key layer on mount — see components/keys.tsx. No mobile effect. */
  desktopOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className={className} open={open} {...(desktopOpen ? { "data-desktop-open": "" } : {})}>
      <summary className="flex items-center gap-1.5 rounded-lg border border-black/8 bg-white px-3.5 py-2.5 text-[13.5px] font-medium select-none lg:hover:border-black/25 dark:border-white/10 dark:bg-white/[0.035]">
        <span className="opacity-40">▸</span>
        {title}
      </summary>
      {children}
    </details>
  );
}
