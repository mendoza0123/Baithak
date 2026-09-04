"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Desktop keyboard layer. Listeners only attach above the lg breakpoint, so the phone build
 * behaves exactly as it did — nothing here runs, and the help sheet is never rendered.
 *
 * Row navigation reuses native focus rather than tracking a selected index: j/k just move focus
 * between [data-nav] elements, which makes Enter-to-open, the focus ring and screen-reader
 * announcement free. Anything DOM-hidden (a collapsed day group) is skipped.
 */
const KEYS: [string, string][] = [
  ["j / ↓", "Next row"],
  ["k / ↑", "Previous row"],
  ["Enter", "Open the focused row"],
  ["x", "Toggle the focused action done"],
  ["/", "Jump to search"],
  ["g then m", "Meetings"],
  ["g then a", "Actions"],
  ["r", "Refresh data"],
  ["Esc", "Close / leave the search box"],
  ["?", "This list"],
];

export function Keys() {
  const router = useRouter();
  const [help, setHelp] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    // A collapsed panel is the right default on a phone, where the transcript would bury the
    // brief. In the desktop side column it has its own space, so open it — still collapsible.
    for (const d of document.querySelectorAll<HTMLDetailsElement>("[data-desktop-open]")) d.open = true;

    // Only rows the user can actually see — a collapsed <details> group has none.
    const rows = () =>
      [...document.querySelectorAll<HTMLElement>("[data-nav]")].filter((el) => el.offsetParent !== null);

    const move = (step: number) => {
      const list = rows();
      if (!list.length) return;
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = list[at < 0 ? (step > 0 ? 0 : list.length - 1) : Math.min(Math.max(at + step, 0), list.length - 1)];
      next?.focus();
      next?.scrollIntoView({ block: "nearest" });
    };

    let pendingG = false;

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el?.isContentEditable;

      if (e.key === "Escape") {
        setHelp(false);
        if (typing) el?.blur();
        return;
      }
      if (typing) return; // the search box owns every other key while it has focus

      if (pendingG) {
        pendingG = false;
        if (e.key === "m") return router.push("/");
        if (e.key === "a") return router.push("/actions");
        return;
      }

      switch (e.key) {
        case "g":
          pendingG = true;
          return;
        case "j":
        case "ArrowDown":
          e.preventDefault();
          return move(1);
        case "k":
        case "ArrowUp":
          e.preventDefault();
          return move(-1);
        case "Enter": {
          // Anchors open themselves; an action row carries its meeting as data-open.
          const to = el?.getAttribute("data-open");
          if (to) {
            e.preventDefault();
            router.push(to);
          }
          return;
        }
        case "x": {
          const toggle = el?.querySelector<HTMLButtonElement>("[data-toggle]");
          if (toggle) {
            e.preventDefault();
            toggle.click();
          }
          return;
        }
        case "/":
          e.preventDefault();
          document.querySelector<HTMLInputElement>("input[name='q']")?.focus();
          return;
        case "r":
          e.preventDefault();
          return router.refresh();
        case "?":
          return setHelp((v) => !v);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!help) return null;

  return (
    <div
      className="fixed inset-0 z-50 hidden items-center justify-center bg-black/25 backdrop-blur-[2px] lg:flex"
      onClick={() => setHelp(false)}
    >
      <div
        className="w-[420px] rounded-2xl border border-black/10 bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[14px] font-semibold">Keyboard</h2>
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {KEYS.map(([k, what]) => (
            <div key={k} className="col-span-2 grid grid-cols-subgrid items-baseline">
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd className="opacity-65">{what}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => setHelp(false)}
          className="mt-4 w-full rounded-lg bg-black py-2 text-[13px] font-medium text-white"
        >
          Close
        </button>
      </div>
    </div>
  );
}
