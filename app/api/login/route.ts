import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, SESSION_MAX_AGE, safeEqual, sign, verify, type Role } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function roleFor(code: string): Role | null {
  const admin = process.env.ADMIN_CODE;
  const member = process.env.ACCESS_CODE;
  if (admin && safeEqual(code, admin)) return "admin";
  if (member && safeEqual(code, member)) return "member";
  return null;
}

/** Step two of the gate. The Google step must already have happened — the code alone is not enough. */
export async function POST(req: NextRequest) {
  const pending = await verify(req.cookies.get(COOKIE)?.value);
  if (!pending) return NextResponse.redirect(new URL("/login?e=signin", req.url), 303);

  const form = await req.formData();
  const role = roleFor(String(form.get("code") ?? ""));
  if (!role) return NextResponse.redirect(new URL("/login?e=code", req.url), 303);

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE, await sign({ email: pending.email, role }, SESSION_MAX_AGE), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
