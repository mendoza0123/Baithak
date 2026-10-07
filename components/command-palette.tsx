"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { useTheme } from "next-themes";
import {
  Activity,
  AlertTriangle,
  CalendarRange,
  CheckSquare,
  FileText,
  Hourglass,
  Moon,
  RotateCw,
  Search,
  Sun,
} from "lucide-react";

/**
 * ⌘K. Navigation and the handful of global actions — deliberately not a meeting
 * search index, because that would mean querying the meeting list on every page
 * render just to populate a palette most visits never open. Searching meetings
 * routes to /meetings?q=, which is a real page with real filters.
 *
 * keys.tsx keeps the j/k row navigation; this replaces the g-m / g-a jumps and
 * the hand-rolled "?" sheet for anyone who reaches for ⌘K first.
 */
export function CommandPalette({
  variant = "rail",
  isAdmin = false,
}: {
  variant?: "rail" | "icon";
  /** Keeps /md out of the palette for a member, matching the nav. The page re-checks anyway. */
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const trimmed = query.trim();

  return (
    <>
      {variant === "rail" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-10 w-full items-center gap-2 rounded-control border border-strong bg-surface px-2.5 text-left text-support text-ink-2 transition-colors hover:border-accent hover:text-ink"
        >
          <Search size={14} strokeWidth={2.25} aria-hidden />
          <span className="flex-1">Search or jump to…</span>
          <kbd aria-hidden>⌘K</kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Search or jump to"
          className="flex size-11 items-center justify-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
        >
          <Search size={17} strokeWidth={2.25} aria-hidden />
        </button>
      )}

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        className="fixed inset-0 z-50 flex items-start justify-center bg-ink/35 p-4 pt-[12vh] backdrop-blur-sm"
      >
        <div className="w-full max-w-lg overflow-hidden rounded-card border border-subtle bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-2 border-b border-subtle px-3.5">
            <Search size={15} strokeWidth={2.25} className="shrink-0 text-ink-3" aria-hidden />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search meetings, or jump to a view…"
              className="min-h-12 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3"
            />
          </div>

          <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
            <Command.Empty className="px-3 py-6 text-center text-support text-ink-3">
              Nothing matches that.
            </Command.Empty>

            {trimmed ? (
              <Command.Group heading="Search" className="px-1.5 pb-1 text-label text-ink-3">
                <Item onSelect={() => go(`/meetings?q=${encodeURIComponent(trimmed)}`)}>
                  <FileText size={15} strokeWidth={2} aria-hidden />
                  Meetings matching “{trimmed}”
                </Item>
                <Item onSelect={() => go(`/actions?q=${encodeURIComponent(trimmed)}`)}>
                  <CheckSquare size={15} strokeWidth={2} aria-hidden />
                  Actions matching “{trimmed}”
                </Item>
              </Command.Group>
            ) : null}

            <Command.Group heading="Go to" className="px-1.5 pb-1 text-label text-ink-3">
              {isAdmin ? (
                <Item onSelect={() => go("/md")}>
                  <CalendarRange size={15} strokeWidth={2} aria-hidden />
                  My week
                </Item>
              ) : null}
              <Item onSelect={() => go("/")}>
                <Activity size={15} strokeWidth={2} aria-hidden />
                Today
              </Item>
              <Item onSelect={() => go("/meetings")}>
                <FileText size={15} strokeWidth={2} aria-hidden />
                Meetings
              </Item>
              <Item onSelect={() => go("/actions")}>
                <CheckSquare size={15} strokeWidth={2} aria-hidden />
                Actions
              </Item>
            </Command.Group>

            <Command.Group heading="Filter" className="px-1.5 pb-1 text-label text-ink-3">
              <Item onSelect={() => go("/actions?urgent=overdue")}>
                <AlertTriangle size={15} strokeWidth={2} aria-hidden />
                Overdue actions
              </Item>
              <Item onSelect={() => go("/actions?urgent=high")}>
                <Hourglass size={15} strokeWidth={2} aria-hidden />
                High-priority actions
              </Item>
              <Item onSelect={() => go("/meetings?status=failed")}>
                <AlertTriangle size={15} strokeWidth={2} aria-hidden />
                Failed in the pipeline
              </Item>
            </Command.Group>

            <Command.Group heading="This app" className="px-1.5 pb-1 text-label text-ink-3">
              <Item
                onSelect={() => {
                  setOpen(false);
                  router.refresh();
                }}
              >
                <RotateCw size={15} strokeWidth={2} aria-hidden />
                Refresh data
              </Item>
              <Item
                onSelect={() => {
                  setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  setOpen(false);
                }}
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={15} strokeWidth={2} aria-hidden />
                ) : (
                  <Moon size={15} strokeWidth={2} aria-hidden />
                )}
                Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
              </Item>
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>
    </>
  );
}

function Item({ onSelect, children }: { onSelect: () => void; children: React.ReactNode }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-control px-2 text-body text-ink-2 data-[selected=true]:bg-accent-wash data-[selected=true]:text-ink"
    >
      {children}
    </Command.Item>
  );
}
