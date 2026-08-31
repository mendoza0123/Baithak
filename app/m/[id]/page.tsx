import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { StatusBadge, TypeBadge } from "@/components/badges";
import { Markdown } from "@/components/markdown";
import { ActionRow } from "@/components/action-row";
import { ReviewButtons } from "@/components/review-buttons";
import { currentSession } from "@/lib/session";
import { clock, ist, mins, stripBriefHeader } from "@/lib/format";
import { getMeeting, meetingActions } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MeetingPage({ params }: PageProps<"/m/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [session, m, actions] = await Promise.all([
    currentSession(),
    getMeeting(id),
    meetingActions(id),
  ]);
  if (!m) notFound();

  const isAdmin = session?.role === "admin";
  const transcript = Array.isArray(m.transcript) ? m.transcript : null;
  const participants = m.brief?.participants ?? [];

  // Which transitions review_meeting() will accept from here. The database has the final say.
  const decisions: ("approve" | "skip" | "requeue")[] = !isAdmin
    ? []
    : m.status === "awaiting_approval"
      ? ["approve", "skip"]
      : m.status === "ready"
        ? ["skip"]
        : m.status === "skipped" || m.status === "failed"
          ? ["requeue"]
          : [];

  const showReviewPanel = m.status === "awaiting_approval" || decisions.length > 0;

  return (
    <Shell session={session} active="detail">
      <Link href="/" className="text-[13px] opacity-45 hover:opacity-100">
        ← Meetings
      </Link>

      <h1 className="mt-2 text-[19px] leading-snug font-semibold">
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
          <span className="rounded-full bg-amber-500/18 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            sensitive
          </span>
        ) : null}
      </div>

      {m.status_reason ? (
        <p className="mt-3 rounded-lg bg-black/4 px-3 py-2 text-[13px] opacity-70 dark:bg-white/6">
          {m.status_reason}
        </p>
      ) : null}

      {/* The buttons are a convenience; /api/review re-checks the admin cookie server-side. */}
      {showReviewPanel ? (
        <section className="mt-4 rounded-xl border border-amber-500/35 bg-amber-500/8 p-3.5">
          <h2 className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
            {m.status === "awaiting_approval" ? "Needs review" : "Admin actions"}
          </h2>
          {m.sensitivity_reason ? (
            <p className="mt-1 text-[13px] opacity-75">{m.sensitivity_reason}</p>
          ) : null}
          {decisions.length > 0 ? (
            <div className="mt-3">
              <ReviewButtons id={m.id} decisions={decisions} email={session!.email} />
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] opacity-60">
              An admin has to approve or skip this brief before it is distributed.
            </p>
          )}
        </section>
      ) : null}

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

      {actions.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-[13px] font-semibold opacity-55">Action items</h2>
          <ul className="flex flex-col gap-2">
            {actions.map((a) => (
              <li key={a.id}>
                <ActionRow a={a} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {m.brief?.quality_notes ? (
        <p className="mt-4 text-[12.5px] opacity-45">Quality notes: {m.brief.quality_notes}</p>
      ) : null}

      {m.plaud_summary_md ? (
        <Disclosure title="Plaud's original note (Hindi)" className="mt-4">
          <Card className="mt-2">
            <Markdown>{m.plaud_summary_md}</Markdown>
          </Card>
        </Disclosure>
      ) : null}

      {transcript && transcript.length > 0 ? (
        <Disclosure title={`Transcript — ${transcript.length} segments, Hindi`} className="mt-3">
          <Card className="mt-2 max-h-[70vh] overflow-y-auto">
            <ol className="flex flex-col gap-2.5 text-[13.5px] leading-relaxed">
              {transcript.map((seg, i) => (
                <li key={i} className="grid grid-cols-[auto_1fr] gap-x-2">
                  <span className="pt-0.5 font-mono text-[11px] tabular-nums opacity-40">
                    {clock(seg.start_ms)}
                  </span>
                  <span className="min-w-0 break-words">
                    {seg.speaker ? <span className="font-medium opacity-70">{seg.speaker} — </span> : null}
                    {seg.text}
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
    </Shell>
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

function Disclosure({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <details className={className}>
      <summary className="flex items-center gap-1.5 rounded-lg border border-black/8 bg-white px-3.5 py-2.5 text-[13.5px] font-medium select-none dark:border-white/10 dark:bg-white/[0.035]">
        <span className="opacity-40">▸</span>
        {title}
      </summary>
      {children}
    </details>
  );
}
