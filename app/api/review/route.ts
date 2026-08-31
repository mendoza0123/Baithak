import { NextResponse, type NextRequest } from "next/server";
import { currentRole } from "@/lib/session";
import { reviewMeeting } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DECISIONS = ["approve", "skip", "requeue"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  // Hiding the buttons is not the check — this is.
  if ((await currentRole()) !== "admin") {
    return NextResponse.json({ error: "admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const decision = String(body?.decision ?? "");
  const reason = body?.reason ? String(body.reason).slice(0, 500) : null;

  if (!UUID.test(id)) return NextResponse.json({ error: "bad meeting id" }, { status: 400 });
  if (!DECISIONS.includes(decision)) {
    return NextResponse.json({ error: "bad decision" }, { status: 400 });
  }

  try {
    return NextResponse.json({ status: await reviewMeeting(id, decision, reason) });
  } catch (e) {
    // review_meeting() raises on an illegal transition — that message is the useful one.
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
