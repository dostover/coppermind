import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { SignOutButton } from "@/components/SignOutButton";
import { DemoPersonaSwitcher } from "@/components/DemoPersonaSwitcher";

export default async function Home() {
  const fan = await getFanFromCookies();

  return (
    <main className="page">
      <h1>Banana Cards</h1>
      <p>Digital trading card system and portal for Banana Ball.</p>

      {fan ? (
        <div className="welcome-card">
          <p>
            Signed in as <strong>{fan.display_name}</strong>
            {fan.email === null && " (quick join, no email yet)"}.
          </p>
          <nav className="nav-links">
            <Link href="/redeem">Get a card</Link>
            <Link href="/collection">My collection</Link>
            <Link href="/trade">Trade with a fan</Link>
          </nav>
          <SignOutButton />
        </div>
      ) : (
        <p>
          Got a token from the ballpark? Scan its QR code with your phone&apos;s camera to claim your card.
          Already collecting? <Link href="/sign-in">Sign in</Link>.
        </p>
      )}

      {/* Dev-only - hidden from a production build. Lets a demo jump
          straight between seeded personas without re-typing email/code each
          time, whether or not someone's currently signed in. */}
      {process.env.NODE_ENV !== "production" && (
        <>
          <DemoPersonaSwitcher />
          <p className="dev-hint">
            Demo: <Link href="/tokens">print or scan demo tokens</Link> to try claiming a card the way a fan
            would at the gate, or open the <Link href="/drops">drop console</Link> to run a live stream or a
            player&apos;s social drop.
          </p>
        </>
      )}
    </main>
  );
}
