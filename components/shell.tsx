import Link from "next/link";
import type { Role } from "@/lib/auth";

export function Shell({
  role,
  active,
  children,
}: {
  role: Role | null;
  active: "meetings" | "actions" | "detail";
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
      <header className="sticky top-0 z-10 border-b border-black/8 bg-[#f6f6f5]/85 backdrop-blur-md dark:border-white/10 dark:bg-[#0d0d0c]/85">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-tight whitespace-nowrap">
            Baithak <span className="opacity-45">Briefs</span>
          </Link>
          <div className="flex items-center text-[12.5px]">
            <Tab href="/" label="Meetings" on={active !== "actions"} />
            <Tab href="/actions" label="Actions" on={active === "actions"} />
            {role === "admin" ? (
              <span className="ml-1 rounded-full bg-amber-500/18 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-300">
                admin
              </span>
            ) : null}
            <form action="/api/logout" method="post" className="ml-0.5">
              <button
                type="submit"
                className="rounded-md px-2 py-1 text-[13px] opacity-45 hover:opacity-100"
                title="Sign out"
              >
                Exit
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 pt-4 pb-16">{children}</main>
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
