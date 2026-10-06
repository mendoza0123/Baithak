import { redirect } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
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
  const step = session ? 2 : 1;

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-page font-semibold tracking-tight text-ink">
          Baithak <span className="font-medium text-ink-3">Briefs</span>
        </h1>
        <p className="mt-1 text-support text-ink-2">Internal · Linkd Prints</p>

        {/* Two locks, and which one you are at. Neither half works alone. */}
        <ol className="mt-6 flex items-center gap-2" aria-label={`Step ${step} of 2`}>
          <Step n={1} label="Google" state={step > 1 ? "done" : "current"} />
          <span className="h-px flex-1 bg-subtle" aria-hidden />
          <Step n={2} label="Access code" state={step === 2 ? "current" : "todo"} />
        </ol>

        <div className="mt-5 rounded-card border border-subtle bg-surface p-5">
          {!session ? (
            // Step 1. A broken GOOGLE_CLIENT_ID must fail loudly here, never fall through to the code.
            !clientId ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-control bg-danger-wash px-3.5 py-3 text-support text-danger"
              >
                <AlertTriangle size={15} strokeWidth={2.5} className="mt-px shrink-0" aria-hidden />
                <span>
                  Google sign-in is not configured. Set <code className="num">GOOGLE_CLIENT_ID</code> and
                  redeploy.
                </span>
              </p>
            ) : (
              <>
                <p className="mb-4 text-support text-ink-2">
                  Sign in so we know who is reading. This alone does not open anything.
                </p>
                <GoogleSignIn clientId={clientId} />
              </>
            )
          ) : (
            <>
              <p className="text-support text-ink-2">Enter the team access code.</p>
              <p className="mt-1 truncate text-support font-medium text-ink">{session.email}</p>

              <form action="/api/login" method="post" className="mt-4 flex flex-col gap-2.5">
                <label htmlFor="code" className="sr-only">
                  Access code
                </label>
                <input
                  id="code"
                  name="code"
                  type="password"
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  placeholder="Access code"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "code-error" : undefined}
                  // 16px keeps iOS from zooming the viewport on focus.
                  className={`min-h-12 rounded-control border bg-surface px-3.5 text-prose text-ink outline-none placeholder:text-ink-3 ${
                    error ? "border-danger" : "border-strong focus:border-accent"
                  }`}
                />
                <button
                  type="submit"
                  className="min-h-12 rounded-control bg-accent text-prose font-medium text-accent-ink transition-colors hover:bg-accent-hover"
                >
                  Enter
                </button>
              </form>

              <form action="/api/logout" method="post" className="mt-4 text-center">
                <button
                  type="submit"
                  className="min-h-9 text-meta text-ink-3 underline underline-offset-2 hover:text-ink"
                >
                  Use a different Google account
                </button>
              </form>
            </>
          )}

          {error ? (
            <p
              id="code-error"
              role="alert"
              className="mt-3 flex items-center gap-1.5 text-support text-danger"
            >
              <AlertTriangle size={14} strokeWidth={2.5} className="shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Step({
  n,
  label,
  state,
}: {
  n: number;
  label: string;
  state: "done" | "current" | "todo";
}) {
  const ring =
    state === "done"
      ? "border-success bg-success text-accent-ink"
      : state === "current"
        ? "border-accent bg-accent text-accent-ink"
        : "border-strong text-ink-3";
  const ink = state === "todo" ? "text-ink-3" : "text-ink";

  return (
    <li className="flex items-center gap-2">
      <span
        className={`num flex size-6 shrink-0 items-center justify-center rounded-full border text-label font-semibold ${ring}`}
        aria-hidden
      >
        {state === "done" ? <Check size={13} strokeWidth={3.5} /> : n}
      </span>
      <span className={`text-meta font-medium whitespace-nowrap ${ink}`}>{label}</span>
    </li>
  );
}
