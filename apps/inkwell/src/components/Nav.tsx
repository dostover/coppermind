"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

// Left-sidebar collapse (icon-only rail, not fully hidden - the user chose
// to keep icons visible/clickable while collapsed rather than hiding the
// sidebar entirely), persisted so the choice sticks across visits.
//
// Modeled as a tiny external store (useSyncExternalStore) rather than
// useState+useEffect: reading localStorage in an effect after mount means
// calling setState from inside that effect, which both causes an extra
// cascading render and trips the react-hooks/set-state-in-effect lint rule.
// useSyncExternalStore instead treats localStorage as the source of truth
// directly, with getServerSnapshot giving the server-rendered/pre-hydration
// value (always "expanded", since localStorage doesn't exist there) - no
// separate mount effect or hydration-mismatch risk. A same-tab toggle
// doesn't fire a native "storage" event (that only fires in *other* tabs),
// so this module keeps its own listener set and notifies it manually.
const STORAGE_KEY = "inkwell:sidebar-collapsed";
const listeners = new Set<() => void>();
let memoryFallback = false; // used only if localStorage itself is unavailable

function getSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return memoryFallback;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function setCollapsed(next: boolean) {
  memoryFallback = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Private-browsing/blocked storage - memoryFallback still makes the
    // toggle work for the rest of this tab's session.
  }
  listeners.forEach((listener) => listener());
}

function CaptureIcon() {
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.25" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19V6a1 1 0 0 1 1-1h5v15" />
      <path d="M14 19V5h5a1 1 0 0 1 1 1v13" />
      <path d="M4 19h16" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {collapsed ? <path d="M9 5l7 7-7 7" /> : <path d="M15 5l-7 7 7 7" />}
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function linkClass(href: string) {
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return isActive ? "active" : undefined;
  }

  const onUploadPage = pathname.startsWith("/upload");

  return (
    <>
      <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <Link href="/" className="brand">
          <span aria-hidden="true">🖋️</span>
          <span className="brand-label">Inkwell</span>
        </Link>
        <Link href="/upload" className={linkClass("/upload")}>
          <CaptureIcon />
          <span className="sidebar-label">Capture</span>
        </Link>
        <Link href="/library" className={linkClass("/library")}>
          <LibraryIcon />
          <span className="sidebar-label">Library</span>
        </Link>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-pressed={collapsed}
        >
          <CollapseIcon collapsed={collapsed} />
          <span className="sidebar-label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </nav>
      {!onUploadPage && (
        <Link href="/upload" className="fab-capture" aria-label="Capture a new page">
          +
        </Link>
      )}
    </>
  );
}
