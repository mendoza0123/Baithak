import { redirect } from "next/navigation";
import { GoogleSignIn } from "@/components/google-signin";
import { currentSession, googleClientId } from "@/lib/session";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  code: "That access code is not right.",
  signin: "Your sign-in expired. Start again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [sp, session] = await Promise.all([searchParams, currentSession()]);
  if (session?.role) redirect("/");

  const e = Array.isArray(sp.e) ? sp.e[0] : sp.e;
  const error = e ? (ERRORS[e] ?? "Something went wrong.") : null;
  const clientId = googleClientId();

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-xs">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Baithak <span className="opacity-45">Briefs</span>
        </h1>
        <p className="mt-1 text-[13.5px] opacity-50">Internal · Linkd Prints</p>

        {!session ? (
          // Step 1. A broken GOOGLE_CLIENT_ID must fail loudly here, never fall through to the code.
          !clientId ? (
            <p role="alert" className="mt-6 rounded-lg bg-red-500/10 px-3.5 py-3 text-[13px] text-red-700">
              Google sign-in is not configured. Set <code>GOOGLE_CLIENT_ID</code> and redeploy.
            </p>
          ) : (
            <>
              <p className="mt-6 mb-3 text-[13.5px] opacity-60">
                Step 1 of 2 — sign in so we know who is reading.
              </p>
              <GoogleSignIn clientId={clientId} />
            </>
          )
        ) : (
          <>
            <p className="mt-6 text-[13.5px] opacity-60">Step 2 of 2 — enter the team access code.</p>
            <p className="mt-1 truncate text-[13px] font-medium">{session.email}</p>

            <form action="/api/login" method="post" className="mt-3 flex flex-col gap-2.5">
              <input
                name="code"
                type="password"
                required
                autoFocus
                autoComplete="one-time-code"
                placeholder="Access code"
                aria-label="Access code"
                aria-invalid={Boolean(error)}
                className="rounded-lg border border-black/12 bg-white px-3.5 py-3 text-[16px] outline-none placeholder:opacity-40 focus:border-black/35"
              />
              <button
                type="submit"
                className="rounded-lg bg-black py-3 text-[15px] font-medium text-white"
              >
                Enter
              </button>
            </form>

            <form action="/api/logout" method="post" className="mt-3 text-center">
              <button type="submit" className="text-[12.5px] opacity-45 underline underline-offset-2">
                Use a different Google account
              </button>
            </form>
          </>
        )}

        {error ? (
          <p role="alert" className="mt-3 text-[13px] text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
