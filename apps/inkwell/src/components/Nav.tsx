"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Left sidebar (switched from a top bar - user asked for a more modern,
// app-like feel and picked this layout over a refined top nav when shown
// both side by side). Client component only because usePathname needs to
// run in the browser to highlight the active section; the sidebar's actual
// content is otherwise completely static.
export function Nav() {
  const pathname = usePathname();

  function linkClass(href: string) {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return isActive ? "active" : undefined;
  }

  const onUploadPage = pathname.startsWith("/upload");

  return (
    <>
      <nav className="sidebar">
        <Link href="/" className="brand">
          Inkwell
        </Link>
        <Link href="/upload" className={linkClass("/upload")}>
          Capture
        </Link>
        <Link href="/library" className={linkClass("/library")}>
          Library
        </Link>
      </nav>
      {/* Mobile-only floating capture action (03-ux-screens.md §2: "a
          persistent '+' capture action - floating button on mobile"). The
          sidebar collapses to a horizontal top bar under 720px, and its
          Capture link can scroll out of view there - this keeps capture one
          tap away regardless. Hidden on /upload itself, since the page the
          button leads to is already open. */}
      {!onUploadPage && (
        <Link href="/upload" className="fab-capture" aria-label="Capture a new page">
          +
        </Link>
      )}
    </>
  );
}
