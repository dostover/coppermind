import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getFanFromCookies } from "@/lib/authSession";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "Banana Cards",
  description: "Digital trading card system and portal for Banana Ball",
};

// Locked to device width / no pinch-zoom and a matching theme-color, so a
// phone browser (or "Add to Home Screen") reads as an app, not a web page -
// see claude/technical-decisions.md: the intended real client is native
// mobile, and this is now the visual/UX prototype for that, not just a
// plain reference surface.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#17140f",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read once here rather than duplicating the sign-in check that already
  // runs per-page - only used to decide whether the tab bar has anywhere to
  // point to. Every route was already forced dynamic by its own
  // getFanFromCookies() call, so doing it again here isn't a new cost.
  const fan = await getFanFromCookies();

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <div className="app-screen">
            <div className="app-content">{children}</div>
            {fan && <BottomNav />}
          </div>
        </div>
      </body>
    </html>
  );
}
