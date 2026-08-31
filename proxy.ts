import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verify } from "@/lib/auth";

// Everything except /login, /api/login and static assets requires a valid signed cookie.
export default async function proxy(req: NextRequest) {
  if (await verify(req.cookies.get(COOKIE)?.value)) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
