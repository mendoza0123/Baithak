import Link from "next/link";
import { Shell } from "@/components/shell";
import { ActionRow } from "@/components/action-row";
import { currentSession } from "@/lib/session";
import { ist } from "@/lib/format";
import { openActions } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UNASSIGNED = "Unassigned";

export default async function ActionsPage() {
  const [session, items] = await Promise.all([currentSession(), openActions()]);

  // Group by owner, unassigned last.
  const groups = new Map<string, typeof items>();
  for (const a of items) {
    const key = a.owner?.trim() || UNASSIGNED;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b),
  );

  return (
    <Shell session={session} active="actions">
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="text-[17px] font-semibold">Open actions</h1>
        <span className="text-[13px] opacity-45 tabular-nums">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/12 px-4 py-10 text-center text-[14px] opacity-50 dark:border-white/12">
          Nothing open.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {ordered.map(([owner, list]) => (
            <section key={owner}>
              <h2 className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold opacity-55">
                {owner}
                <span className="font-normal opacity-60 tabular-nums">{list.length}</span>
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((a) => (
                  <li key={a.id}>
                    <ActionRow
                      a={a}
                      interactive
                      footer={
                        <Link
                          href={`/m/${a.meeting_id}`}
                          className="mt-2 block truncate text-[12px] opacity-45 underline underline-offset-2 hover:opacity-100"
                        >
                          {a.title_en || a.title_original || "Untitled"} · {ist(a.recorded_at)}
                        </Link>
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Shell>
  );
}
