import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { SignOutButton } from "@/components/SignOutButton";

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
          </nav>
          <SignOutButton />
        </div>
      ) : (
        <p>
          <Link href="/sign-in">Sign in</Link> to get started.
        </p>
      )}
    </main>
  );
}
