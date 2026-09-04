import Link from "next/link";
import type { Session } from "@/lib/auth";
import { RefreshButton } from "@/components/refresh-button";
import { FreshnessBar } from "@/components/freshness-bar";
import { Keys } from "@/components/keys";
import { freshness } from "@/lib/queries";

export async function Shell({
  session,
  active,
  children,
}: {
  session: Session | null;
  active: "meetings" | "actions" | "detail";
  children: React.ReactNode;
}) {
  const sync = await freshness();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col lg:mx-0 lg:max-w-none lg:flex-row">
      {/* Desktop only. Hidden on a phone, so its position in the DOM costs the mobile build
          nothing — the sticky header below is still what a phone renders. */}
      <aside className="sticky top-0 hidden h-dvh w-[212px] shrink-0 flex-col border-r border-black/8 bg-white/60 px-3 py-4 lg:flex">
        <Link href="/" className="px-2 text-[15px] font-semibold tracking-tight">
          Baithak <span className="opacity-45">Briefs</span>
        </Link>
        <p className="mt-0.5 px-2 text-[11px] opacity-40">Linkd Prints · internal</p>

        <nav className="mt-5 flex flex-col gap-0.5">
          <RailLink href="/" label="Meetings" hint="G M" on={active !== "actions"} />
          <RailLink href="/actions" label="Actions" hint="G A" on={active === "actions"} />
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <p className="px-2 text-[11px] opacity-35">
            Press <kbd>?</kbd> for shortcuts
          </p>
          <FreshnessBar
            s={sync}
            /* The run note can be a paragraph; three lines is enough to know something failed. */
            className="rounded-lg px-2.5 !text-[11px] leading-snug [&>span:last-child]:line-clamp-3"
          />
          <div className="flex items-center justify-between px-1">
            <span className="min-w-0 truncate text-[11px] opacity-40" title={session?.email ?? ""}>
              {session?.email ?? "—"}
            </span>
            <span className="flex shrink-0 items-center">
              {session?.role === "admin" ? (
                <span className="mr-1 rounded-full bg-amber-500/18 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  admin
                </span>
              ) : null}
              <RefreshButton />
              <form action="/api/logout" method="post">
                <button
                  type="submit"
                  className="rounded-md px-1.5 py-1 text-[12px] opacity-45 hover:opacity-100"
                  title="Sign out"
                >
                  Exit
                </button>
              </form>
            </span>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-10 border-b border-black/8 bg-[#f6f6f5]/85 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-tight whitespace-nowrap">
            Baithak <span className="opacity-45">Briefs</span>
          </Link>
          <div className="flex items-center text-[12.5px]">
            <Tab href="/" label="Meetings" on={active !== "actions"} />
            <Tab href="/actions" label="Actions" on={active === "actions"} />
            {session?.role === "admin" ? (
              <span className="ml-1 rounded-full bg-amber-500/18 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700">
                admin
              </span>
            ) : null}
            <RefreshButton />
            <form action="/api/logout" method="post" className="ml-0.5">
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-[13px] opacity-45 hover:opacity-100"
                title={session ? `Signed in as ${session.email} — sign out` : "Sign out"}
              >
                Exit
              </button>
            </form>
          </div>
        </div>
      </header>
      {/* Outside the sticky header on purpose — it's a status line you read once, not a control
          worth pinning to the top of every screen while you scroll. On desktop it lives in the
          rail instead, where there is room for it to sit permanently. */}
      <div className="lg:hidden">
        <FreshnessBar s={sync} />
      </div>
      <main className="flex-1 px-4 pt-4 pb-16 lg:min-w-0 lg:px-6 lg:pt-6 lg:pb-10">{children}</main>
      <Keys />
    </div>
  );
}

function Tab({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1 ${on ? "font-medium" : "opacity-45 hover:opacity-100"}`}
    >
      {label}
    </Link>
  );
}

function RailLink({ href, label, hint, on }: { href: string; label: string; hint: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
        on ? "bg-black text-white" : "opacity-60 hover:bg-black/[0.05] hover:opacity-100"
      }`}
    >
      {label}
      <span className={`text-[10px] tabular-nums ${on ? "opacity-45" : "opacity-0 group-hover:opacity-35"}`}>
        {hint}
      </span>
    </Link>
  );
}
