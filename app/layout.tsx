import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Noto_Sans_Devanagari, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/**
 * Three faces, self-hosted by next/font so there is no layout shift and no
 * request to Google at runtime.
 *
 * `deva` is not decoration: the Hindi note and transcript used to render in
 * whatever the device had, which changed weight and line box mid-page. It is
 * metrically compatible with Instrument Sans and applied via `.hi` / `:lang(hi)`.
 */
const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
});

const deva = Noto_Sans_Devanagari({
  subsets: ["devanagari", "latin"],
  display: "swap",
  variable: "--font-deva-raw",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Baithak Briefs",
  description: "Meeting briefs for Linkd Prints",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#141412" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning is required by next-themes: it writes the theme
    // class onto <html> before paint, which the server render cannot know about.
    <html
      lang="en"
      className={`h-full antialiased ${instrument.variable} ${deva.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
