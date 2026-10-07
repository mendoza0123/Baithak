import Link from "next/link";
import { Activity, CalendarRange, CheckSquare, FileText, LogOut } from "lucide-react";
import type { Session } from "@/lib/auth";
import { RefreshButton } from "@/components/refresh-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import { FreshnessBar } from "@/components/freshness-bar";
import { Keys } from "@/components/keys";
import { actionUrgentCounts, freshness } from "@/lib/queries";

export type Tab = "md" | "today" | "meetings" | "actions" | "detail";

type NavItem = { tab: Tab; href: string; label: string; hint: string; Icon: typeof Activity };

/**
 * /md is gated on the `admin` role, which already has its own password (ADMIN_CODE) — so
 * nothing here needs a list of people. The page itself re-checks and 404s, this just keeps
 * the link out of the nav for a member.
 */
const MD: NavItem = { tab: "md", href: "/md", label: "My week", hint: "G W", Icon: CalendarRange };

const BASE: NavItem[] = [
  { tab: "today", href: "/", label: "Today", hint: "G T", Icon: Activity },
  { tab: "meetings", href: "/meetings", label: "Meetings", hint: "G M", Icon: FileText },
  { tab: "actions", href: "/actions", label: "Actions", hint: "G A", Icon: CheckSquare },
];

/** A meeting page highlights Meetings — it's where you came from. */
const forTab = (active: Tab) => (active === "detail" ? "meetings" : active);

export async function Shell({
  session,
  active,
  children,
}: {
  session: Session | null;
  active: Tab;
  children: React.ReactNode;
}) {
  const [sync, urgent] = await Promise.all([freshness(), actionUrgentCounts()]);
  const current = forTab(active);
  const isAdmin = session?.role === "admin";
  const nav = isAdmin ? [MD, ...BASE] : BASE;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col lg:mx-0 lg:max-w-none lg:flex-row">
      {/* ===================== DESKTOP RAIL ===================== */}
      <aside className="sticky top-0 hidden h-dvh w-[224px] shrink-0 flex-col border-r border-subtle bg-surface px-3 py-4 lg:flex">
        <Link href="/" className="px-2 text-prose font-semibold tracking-tight text-ink">
          Baithak <span className="font-medium text-ink-3">Briefs</span>
        </Link>
        <p className="mt-0.5 px-2 text-label text-ink-3">Linkd Prints · internal</p>

        <div className="mt-4">
          <CommandPalette isAdmin={isAdmin} />
        </div>

        <nav aria-label="Main" className="mt-4 flex flex-col gap-0.5">
          {nav.map(({ tab, href, label, hint, Icon }) => {
            const on = current === tab;
            return (
              <Link
                key={tab}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`group flex min-h-10 items-center gap-2.5 rounded-control px-2 text-support transition-colors ${
                  on
                    ? "bg-accent font-medium text-accent-ink"
                    : "text-ink-2 hover:bg-sunken hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={2} aria-hidden />
                <span className="flex-1">{label}</span>
                {tab === "actions" && urgent.overdue > 0 ? (
                  <span
                    className={`num text-label font-semibold ${on ? "text-accent-ink-2" : "text-danger"}`}
                    title={`${urgent.overdue} overdue`}
                  >
                    {urgent.overdue}
                  </span>
                ) : (
                  <span
                    // opacity-0 → 100 here is a hover reveal, not hierarchy.
                    className={`num text-label ${on ? "text-accent-ink-2" : "text-ink-3 opacity-0 group-hover:opacity-100"}`}
                    aria-hidden
                  >
                    {hint}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <p className="px-2 text-label text-ink-3">
            Press <kbd>?</kbd> for shortcuts
          </p>
          <FreshnessBar
            s={sync}
            /* The run note can be a paragraph; three lines is enough to know something failed. */
            className="rounded-control px-2.5 leading-snug [&>span:last-child]:line-clamp-3"
          />
          <div className="flex items-center justify-between gap-1 px-1">
            <span className="min-w-0 truncate text-label text-ink-3" title={session?.email ?? ""}>
              {session?.email ?? "—"}
            </span>
            <span className="flex shrink-0 items-center">
              {isAdmin ? (
                <span className="mr-1 rounded-full bg-warning-wash px-1.5 py-0.5 text-label font-semibold text-warning">
                  admin
                </span>
              ) : null}
              <ThemeToggle />
              <RefreshButton />
              <form action="/api/logout" method="post">
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex size-11 items-center justify-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
                >
                  <LogOut size={15} strokeWidth={2.25} aria-hidden />
                </button>
              </form>
            </span>
          </div>
        </div>
      </aside>

      {/* ===================== MOBILE HEADER ===================== */}
      <header className="sticky top-0 z-10 border-b border-subtle bg-canvas/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-1.5">
          <Link href="/" className="shrink-0 text-prose font-semibold tracking-tight whitespace-nowrap text-ink">
            Baithak <span className="font-medium text-ink-3">Briefs</span>
          </Link>
          <div className="flex items-center">
            {isAdmin ? (
              <span className="mr-1 rounded-full bg-warning-wash px-1.5 py-0.5 text-label font-semibold text-warning">
                admin
              </span>
            ) : null}
            <CommandPalette variant="icon" isAdmin={isAdmin} />
            <ThemeToggle />
            <RefreshButton />
            <form action="/api/logout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title={session ? `Signed in as ${session.email} — sign out` : "Sign out"}
                className="flex size-11 items-center justify-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
              >
                <LogOut size={16} strokeWidth={2.25} aria-hidden />
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

      {/* pb-24 clears the bottom tab bar; the desktop padding is unchanged. */}
      <main className="flex-1 px-4 pt-4 pb-24 lg:min-w-0 lg:px-6 lg:pt-6 lg:pb-10">{children}</main>

      {/* ===================== MOBILE BOTTOM TABS ===================== */}
      {/* Navigation belongs within thumb reach. Three destinations, four for an admin —
          still under the five-item ceiling, each a 56px target. */}
      <nav
        aria-label="Main"
        className={`fixed inset-x-0 bottom-0 z-10 grid border-t border-subtle bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden ${
          nav.length === 4 ? "grid-cols-4" : "grid-cols-3"
        }`}
      >
        {nav.map(({ tab, href, label, Icon }) => {
          const on = current === tab;
          return (
            <Link
              key={tab}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 ${
                on ? "text-accent" : "text-ink-3"
              }`}
            >
              <Icon size={20} strokeWidth={2} aria-hidden />
              <span className={`text-label ${on ? "font-semibold" : ""}`}>{label}</span>
              {tab === "actions" && urgent.overdue > 0 ? (
                <span className="num absolute top-1.5 left-1/2 ml-2 rounded-full bg-danger px-1.5 text-label font-semibold text-accent-ink">
                  {urgent.overdue}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <Keys />
    </div>
  );
}
