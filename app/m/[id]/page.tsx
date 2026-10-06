import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronRight, CircleAlert } from "lucide-react";
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

  // Devanagari needs its own face and a 1.75 line box; Hinglish is Roman script
  // and must NOT get them, or the transliteration renders in the wrong font.
  const scriptClass = lang === "hinglish" ? "" : "hi";
  const scriptLang = lang === "hinglish" ? undefined : "hi";

  const openCount = actions.filter((a) => a.status === "open").length;

  return (
    <Shell session={session} active="detail">
      {/* Three columns on a monitor: the meeting list you came from, the brief, and the Hindi
          source material beside it instead of buried under it. Every wrapper below is a plain
          block until `lg`, so a phone renders the same document in the same order as before. */}
      <div className="lg:flex lg:items-start lg:gap-6">
        <MeetingRail meetings={siblings} currentId={m.id} />

        <div className="lg:min-w-0 lg:flex-1 2xl:max-w-[920px]">
          <Link
            href="/meetings"
            className="inline-flex min-h-9 items-center gap-1.5 text-support text-ink-2 hover:text-ink lg:hidden"
          >
            <ArrowLeft size={14} strokeWidth={2.25} aria-hidden />
            Meetings
          </Link>

          <h1 className="mt-1 text-page font-semibold tracking-tight text-ink lg:mt-0">
            {m.title_en || m.title_original || "Untitled recording"}
          </h1>
          {m.title_en && m.title_original ? (
            <p className="hi mt-1.5 text-support text-ink-2" lang="hi">
              {m.title_original}
            </p>
          ) : null}

          <div className="num mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-meta text-ink-2">
            <span>{ist(m.recorded_at)} IST</span>
            {mins(m.duration_sec) ? <span>· {mins(m.duration_sec)}</span> : null}
            {m.version ? <span>· brief v{m.version}</span> : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={m.meeting_type} />
            <StatusBadge status={m.status} />
            {m.sensitive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-wash px-2 py-0.5 text-label font-semibold text-warning">
                <AlertTriangle size={11} strokeWidth={2.75} aria-hidden />
                Sensitive
              </span>
            ) : null}
          </div>

          {m.status_reason ? (
            <p className="mt-3 rounded-control bg-sunken px-3 py-2 text-support text-ink-2">
              {m.status_reason}
            </p>
          ) : null}
          {m.sensitivity_reason ? (
            <p className="mt-1.5 text-meta text-ink-3">{m.sensitivity_reason}</p>
          ) : null}

          <Timeline m={m} />

          {participants.length > 0 && !m.summary_md ? (
            <p className="mt-4 text-support text-ink-2">
              <span className="text-ink">Participants: </span>
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
                <p className="text-body text-ink-2">
                  No English brief yet. The pipeline writes one once the transcript arrives.
                </p>
                {m.brief?.executive_summary ? (
                  <p className="mt-2 text-prose text-ink">{m.brief.executive_summary}</p>
                ) : null}
              </>
            )}

            {m.model ? (
              <p className="num mt-5 border-t border-subtle pt-3.5 text-label text-ink-3">
                Written by {m.model} · prompt {m.prompt_version} · {ist(m.summarised_at)}
              </p>
            ) : null}
          </Card>

          {/* Structured recap — the same material the prose brief covers, but scannable rather than
              read start to finish. Straight from brief jsonb, no schema change involved. */}
          {brief?.decisions?.length || brief?.open_issues?.length || brief?.next_meeting_agenda?.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <RecapList title="Decided" items={brief?.decisions} tone="success" />
              <RecapList title="Open issues" items={brief?.open_issues} tone="warning" />
              <RecapList title="Next agenda" items={brief?.next_meeting_agenda} tone="neutral" />
            </div>
          ) : null}

          {actions.length > 0 ? (
            <section className="mt-4">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-section font-semibold tracking-tight text-ink">
                  Action items{" "}
                  <span className="num text-body font-medium text-ink-3">
                    {openCount} open of {actions.length}
                  </span>
                </h2>
                <p className="text-meta text-ink-3">Tick to close · @time marks where it was said</p>
              </div>
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
            <p className="mt-4 text-meta text-ink-3">Quality notes: {m.brief.quality_notes}</p>
          ) : null}
        </div>

        {/* The Hindi source: last on a phone, beside the brief on a desktop. Scrolls in its own
            column so the brief stays put while you read down the transcript. */}
        <div className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-3rem)] lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:pr-1 lg:[&>*:first-child]:mt-0 2xl:w-[520px]">
          {/* One control for both Hindi sections. Script only — the words are identical either way. */}
          {m.plaud_summary_md || transcript?.length ? (
            <div id="hindi" className="mt-5">
              <p className="eyebrow mb-1.5">Hindi source</p>
              <p className="mb-2 text-meta text-ink-3">
                Same words, your choice of script — transliteration, not translation.
              </p>
              <div role="group" aria-label="Script" className="inline-flex gap-1 rounded-full bg-sunken p-1">
                <ScriptTab id={m.id} to="hi" on={lang === "hi"} label="हिन्दी" deva />
                <ScriptTab id={m.id} to="hinglish" on={lang === "hinglish"} label="Hinglish" />
              </div>
            </div>
          ) : null}

          {m.plaud_summary_md ? (
            <Disclosure title="Plaud's original note" className="mt-3" open={opened} desktopOpen>
              <Card className="mt-2">
                <div className={scriptClass} lang={scriptLang}>
                  <Markdown>{render(m.plaud_summary_md, lang)}</Markdown>
                </div>
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
                <ol className="flex flex-col gap-3">
                  {transcript.map((seg, i) => (
                    <li key={i} className="grid grid-cols-[46px_1fr] gap-x-2.5">
                      <span className="num pt-0.5 text-label text-ink-3">{clock(seg.start_ms)}</span>
                      <span className="min-w-0 break-words">
                        {seg.speaker ? (
                          <span className="block text-label font-semibold text-ink-2">{seg.speaker}</span>
                        ) : null}
                        <span className={`block text-support text-ink ${scriptClass}`} lang={scriptLang}>
                          {render(seg.text ?? "", lang)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </Card>
            </Disclosure>
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
    <dl className="mt-3 grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 rounded-card border border-subtle bg-surface px-3 py-2.5 lg:grid-cols-4 lg:gap-x-4 lg:px-4 lg:py-3">
      {steps.map((s, i) => {
        const waited = gap(s.from, s.at);
        const done = Boolean(s.at);
        return (
          <div
            key={s.label}
            className="col-span-3 grid grid-cols-subgrid items-baseline lg:col-span-1 lg:block lg:border-l lg:border-subtle lg:pl-2.5"
          >
            <dt className="flex items-center gap-1.5 whitespace-nowrap text-meta text-ink-3">
              <span
                className={`size-2 shrink-0 rounded-full ${
                  done ? (i === steps.length - 1 ? "bg-success" : "bg-accent") : "bg-subtle"
                }`}
                aria-hidden
              />
              {s.label}
            </dt>
            {/* No "IST" per row — the meta line above already says it, and repeating it four
                times wraps every row onto two lines at 360px. */}
            <dd className="num whitespace-nowrap text-meta text-ink lg:mt-1 lg:font-medium">
              {s.at ? ist(s.at) : "—"}
            </dd>
            <dd className="num text-right whitespace-nowrap text-label text-ink-3 lg:mt-0.5 lg:text-left">
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
    <div className={`rounded-card border border-subtle bg-surface p-4 ${className}`}>{children}</div>
  );
}

const RECAP = {
  success: { cls: "border-success bg-success-wash", ink: "text-success", Icon: Check },
  warning: { cls: "border-warning bg-warning-wash", ink: "text-warning", Icon: CircleAlert },
  neutral: { cls: "border-subtle bg-surface", ink: "text-ink-3", Icon: ArrowRight },
} as const;

function RecapList({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[];
  tone: keyof typeof RECAP;
}) {
  if (!items?.length) return null;
  const { cls, ink, Icon } = RECAP[tone];
  return (
    <div className={`rounded-card border p-3.5 ${cls}`}>
      <h3 className={`eyebrow flex items-center gap-1.5 ${ink}`}>
        <Icon size={12} strokeWidth={2.75} aria-hidden />
        {title}
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5 text-support leading-snug text-ink">
            <span className="text-ink-3" aria-hidden>
              ·
            </span>
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScriptTab({
  id,
  to,
  on,
  label,
  deva = false,
}: {
  id: string;
  to: Lang;
  on: boolean;
  label: string;
  deva?: boolean;
}) {
  return (
    <Link
      href={`/m/${id}?lang=${to}#hindi`}
      aria-current={on ? "true" : undefined}
      className={`flex min-h-9 items-center rounded-full px-3.5 text-support transition-colors ${
        deva ? "hi" : ""
      } ${on ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-ink-2 hover:text-ink"}`}
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
      <summary className="flex min-h-11 items-center gap-2 rounded-control border border-subtle bg-surface px-3.5 text-support font-medium text-ink select-none lg:hover:border-strong">
        <ChevronRight size={13} strokeWidth={3} className="twist text-ink-3" aria-hidden />
        {title}
      </summary>
      {children}
    </details>
  );
}
