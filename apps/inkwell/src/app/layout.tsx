import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inkwell",
  description: "Turn handwritten pages into a searchable, corrected knowledge library.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Nav />
          <main>
            <div className="main-inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
