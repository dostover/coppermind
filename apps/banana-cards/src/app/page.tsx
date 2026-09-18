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
            Signed in as <strong>{fan.display_name}</strong>.
          </p>
          <nav className="nav-links">
            <Link href="/redeem">Redeem a code</Link>
            <Link href="/collection">My collection</Link>
            <Link href="/trade">Trade with a fan</Link>
          </nav>
          <SignOutButton />
        </div>
      ) : (
        <p>
          <Link href="/sign-in">Sign in</Link> to get started.
        </p>
      )}

      {/* Dev-only - hidden from a production build. Lets a demo jump
          straight between seeded personas without re-typing email/code each
          time, whether or not someone's currently signed in. */}
      {process.env.NODE_ENV !== "production" && <DemoPersonaSwitcher />}
    </main>
  );
}
