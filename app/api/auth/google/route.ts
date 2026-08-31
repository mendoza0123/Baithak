import { NextResponse, type NextRequest } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { COOKIE, PENDING_MAX_AGE, sign } from "@/lib/auth";
import { emailAllowed, googleClientId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Step one of the gate. Google's button hands us an ID token; we verify it against Google's keys
 * (google-auth-library fetches and caches the JWKS) and issue a short-lived cookie carrying only
 * the email. That cookie is not enough to see anything — /login still asks for the access code.
 */
export async function POST(req: NextRequest) {
  const clientId = googleClientId();
  if (!clientId) {
    return NextResponse.json({ error: "Google sign-in is not configured" }, { status: 500 });
  }

  const credential = String((await req.json().catch(() => null))?.credential ?? "");
  if (!credential) return NextResponse.json({ error: "missing credential" }, { status: 400 });

  let payload;
  try {
    const ticket = await new OAuth2Client(clientId).verifyIdToken({
      idToken: credential,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    return NextResponse.json({ error: "Could not verify that Google sign-in" }, { status: 401 });
  }

  const email = payload?.email;
  if (!email || !payload?.email_verified) {
    return NextResponse.json({ error: "Google account has no verified email" }, { status: 401 });
  }
  if (!emailAllowed(email)) {
    return NextResponse.json({ error: `${email} is not on the access list` }, { status: 403 });
  }

  const res = NextResponse.json({ email });
  res.cookies.set(COOKIE, await sign({ email }, PENDING_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_MAX_AGE,
  });
  return res;
}
