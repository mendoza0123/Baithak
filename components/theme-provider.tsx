"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/**
 * Dark mode. The `dark:` custom-variant in globals.css keys off `.dark` on
 * <html>, which is exactly what next-themes writes with attribute="class" —
 * so nothing in the markup needs a `dark:` twin. The colour tokens themselves
 * flip, and every component that uses them follows.
 *
 * `enableSystem` means the OS preference is the default; the toggle in the
 * shell overrides it and persists to localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
