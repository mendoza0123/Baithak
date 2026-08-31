export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const failed = Boolean((await searchParams).e);

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-xs">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Baithak <span className="opacity-45">Briefs</span>
        </h1>
        <p className="mt-1 text-[13.5px] opacity-50">Internal · Linkd Prints</p>

        <form action="/api/login" method="post" className="mt-6 flex flex-col gap-2.5">
          <input
            name="code"
            type="password"
            required
            autoFocus
            autoComplete="one-time-code"
            placeholder="Access code"
            aria-label="Access code"
            aria-invalid={failed}
            className="rounded-lg border border-black/12 bg-white px-3.5 py-3 text-[16px] outline-none placeholder:opacity-40 focus:border-black/35 dark:border-white/14 dark:bg-white/[0.05] dark:focus:border-white/40"
          />
          <button
            type="submit"
            className="rounded-lg bg-black py-3 text-[15px] font-medium text-white dark:bg-white dark:text-black"
          >
            Enter
          </button>
        </form>

        {failed ? (
          <p role="alert" className="mt-3 text-[13px] text-red-600 dark:text-red-400">
            That code is not right.
          </p>
        ) : null}
      </div>
    </main>
  );
}
