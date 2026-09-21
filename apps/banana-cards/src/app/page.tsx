import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { SignOutButton } from "@/components/SignOutButton";
import { DemoPersonaSwitcher } from "@/components/DemoPersonaSwitcher";

export default async function Home() {
  const fan = await getFanFromCookies();

  return (
    <main className="page">
      <div className="brand-mark">
        <span className="brand-mark-dot" aria-hidden />
        Banana Ball
      </div>
      <h1>Banana Cards</h1>
      <p>Your digital trading card collection - redeemed at the game, traded in person.</p>

      {fan ? (
        <div className="welcome-card">
          <p>
            Signed in as <strong>{fan.display_name}</strong>. Use the tabs below to redeem,
            browse, or trade.
          </p>
          <SignOutButton />
        </div>
      ) : (
        <p className="cta-row">
          <Link href="/sign-in" className="cta-button">
            Sign in to get started
          </Link>
        </p>
      )}

      {/* Dev-only - hidden from a production build. Lets a demo jump
          straight between seeded personas without re-typing email/code each
          time, whether or not someone's currently signed in. */}
      {process.env.NODE_ENV !== "production" && <DemoPersonaSwitcher />}
    </main>
  );
}
