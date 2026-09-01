import { NextResponse, type NextRequest } from "next/server";
import { currentSession } from "@/lib/session";
import { setActionStatus } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["open", "done"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Marking a task done is low-stakes team upkeep, not a distribution decision — any signed-in
// session qualifies (proxy.ts already guarantees one has a role by the time it reaches here).
export async function POST(req: NextRequest) {
  if (!(await currentSession())?.role) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const status = String(body?.status ?? "");

  if (!UUID.test(id)) return NextResponse.json({ error: "bad action item id" }, { status: 400 });
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: "status must be open or done" }, { status: 400 });
  }

  try {
    const row = await setActionStatus(id, status as "open" | "done");
    return NextResponse.json({ status: row?.status ?? null });
  } catch (e) {
    // set_action_status() raises if the item is missing or dropped — that message is the useful one.
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
