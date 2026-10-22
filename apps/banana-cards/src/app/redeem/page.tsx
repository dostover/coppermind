import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { RedeemForm } from "@/components/RedeemForm";
import { JoinToRedeem } from "@/components/JoinToRedeem";

// ?code=<code> is what a token's QR points at (see /tokens and
// src/lib/origin.ts's redeemLinkFor), so a phone's own camera app opens the
// card directly - no app to install, no code to type. A signed-in fan lands
// on the face-down card, one tap from the reveal. Someone without an account
// joins with just a name first, the same quick join trade links use.
export default async function RedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const fan = await getFanFromCookies();
  const { code: codeParam } = await searchParams;
  const code = typeof codeParam === "string" && codeParam.trim() ? codeParam.trim() : undefined;

  if (!fan) {
    if (code) {
      return (
        <main className="page">
          <h1>You&apos;ve got a card waiting</h1>
          <p>Pick a name and it&apos;s yours. Other fans see this name when you trade.</p>
          <JoinToRedeem />
          <p className="quick-join-alt">
            Already collecting? <Link href={`/sign-in`}>Sign in</Link>, then scan your token again.
          </p>
        </main>
      );
    }
    return (
      <main className="page">
        <h1>Get a card</h1>
        <p>
          Scan the QR code on your token with your phone&apos;s camera, or <Link href="/sign-in">sign in</Link>{" "}
          to type a code.
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <h1>{code ? "Your card" : "Get a card"}</h1>
      {!code && (
        <p>
          Scan the QR code on your token with your phone&apos;s camera, or type the code printed under it.
        </p>
      )}
      <RedeemForm key={code ?? "entry"} initialCode={code} />
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
