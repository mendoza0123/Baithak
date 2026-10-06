"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

/**
 * Light / dark.
 *
 * Which icon shows is decided in CSS off the `.dark` class on <html>, not from
 * React state — next-themes writes that class before paint, so the correct icon
 * is right on the very first frame and there is no mount flag, no hydration
 * mismatch and no flash of the wrong glyph. The accessible name swaps the same
 * way, with two sr-only spans.
 *
 * `resolvedTheme` is read only inside the click handler, where the browser has
 * already resolved it.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-11 items-center justify-center rounded-control text-ink-3 transition-colors hover:bg-sunken hover:text-ink"
    >
      <Moon size={15} strokeWidth={2.25} className="dark:hidden" aria-hidden />
      <Sun size={15} strokeWidth={2.25} className="hidden dark:block" aria-hidden />
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:inline">Switch to light theme</span>
    </button>
  );
}
