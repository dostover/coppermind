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

  return (
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
  );
}
