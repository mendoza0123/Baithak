import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verify } from "@/lib/auth";

// A session only counts once both steps are done: Google sign-in AND the access code.
// A Google-only cookie carries no role and gets bounced back to /login for the code.
export default async function proxy(req: NextRequest) {
  const session = await verify(req.cookies.get(COOKIE)?.value);
  if (session?.role) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!login|api/login|api/auth/google|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
