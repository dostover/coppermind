import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { RedeemForm } from "@/components/RedeemForm";

export default async function RedeemPage() {
  const fan = await getFanFromCookies();

  if (!fan) {
    return (
      <main className="page">
        <h1>Redeem a code</h1>
        <p>
          <Link href="/sign-in">Sign in</Link> first to redeem a code.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>Redeem a code</h1>
      <p>Enter the code from your redemption token to add a card to your collection.</p>
      <RedeemForm />
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
