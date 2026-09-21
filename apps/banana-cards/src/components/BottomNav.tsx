"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "./icons";

// Persistent mobile-app-style tab bar, replacing the old plain text
// nav-links list. Only rendered (see layout.tsx) when a fan is signed in -
// signed-out visitors just see the sign-in prompt, there's nowhere else for
// them to go yet.
const TABS = [
  { href: "/", label: "Home", icon: NAV_ICONS.home },
  { href: "/redeem", label: "Redeem", icon: NAV_ICONS.redeem },
  { href: "/collection", label: "Cards", icon: NAV_ICONS.collection },
  { href: "/trade", label: "Trade", icon: NAV_ICONS.trade },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={"bottom-nav-link" + (active ? " active" : "")}
            aria-current={active ? "page" : undefined}
          >
            <Icon strokeWidth={2.25} aria-hidden />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
