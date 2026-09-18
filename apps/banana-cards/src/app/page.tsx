import Link from "next/link";
import { cookies } from "next/headers";
import { fansRepo, sessionsRepo } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/authSession";
import { SignOutButton } from "@/components/SignOutButton";

// Server component: reads the session cookie directly (no round trip to
// /api/auth/me needed since this runs in the same process against the same
// db) to decide which state to render. Mirrors apps/inkwell's plain
// server-rendered page pattern.
export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? sessionsRepo.getValidByToken(token, new Date().toISOString()) : undefined;
  const fan = session ? fansRepo.getById(session.fan_id) : undefined;

  return (
    <main className="page">
      <h1>Banana Cards</h1>
      <p>Digital trading card system and portal for Banana Ball.</p>

      {fan ? (
        <div className="welcome-card">
          <p>
            Signed in as <strong>{fan.display_name}</strong>.
          </p>
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
