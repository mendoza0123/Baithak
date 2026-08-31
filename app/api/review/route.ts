import { NextResponse, type NextRequest } from "next/server";
import { currentSession } from "@/lib/session";
import { reviewMeeting } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS = ["approve", "skip", "requeue"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAST: Record<(typeof DECISIONS)[number], string> = {
  approve: "approved",
  skip: "skipped",
  requeue: "requeued",
};

export async function POST(req: NextRequest) {
  // Hiding the buttons is not the check — this is.
  const session = await currentSession();
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const decision = String(body?.decision ?? "");

  if (!UUID.test(id)) return NextResponse.json({ error: "bad meeting id" }, { status: 400 });
  if (!DECISIONS.includes(decision as (typeof DECISIONS)[number])) {
    return NextResponse.json({ error: "bad decision" }, { status: 400 });
  }

  // The whole point of the Google step: status_reason names who did it, not just "in dashboard".
  const reason = `${PAST[decision as keyof typeof PAST]} in dashboard by ${session.email}`;

  try {
    return NextResponse.json({ status: await reviewMeeting(id, decision, reason) });
  } catch (e) {
    // review_meeting() raises on an illegal transition — that message is the useful one.
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
