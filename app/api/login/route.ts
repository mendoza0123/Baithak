import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, MAX_AGE, safeEqual, sign, type Role } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function roleFor(code: string): Role | null {
  const admin = process.env.ADMIN_CODE;
  const member = process.env.ACCESS_CODE;
  if (admin && safeEqual(code, admin)) return "admin";
  if (member && safeEqual(code, member)) return "member";
  return null;
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const code = String(form.get("code") ?? "");
  const role = roleFor(code);

  if (!role) {
    return NextResponse.redirect(new URL("/login?e=1", req.url), 303);
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE, await sign(role), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}
