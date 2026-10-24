import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { dropsRepo } from "@/lib/db";
import { DropClaim } from "@/components/DropClaim";
import { JoinToRedeem } from "@/components/JoinToRedeem";

// Where a stream overlay QR or a player's or team's social post links:
// getting a card beyond the ballpark (see "Beyond the ballpark" in
// claude/card-value-model.md). Like a token at the gate it ends in the
// face-down card and the reveal, and someone new joins with just a name.
//
// A stream card can only be claimed while the game is streaming live; a
// social drop stays open until the end date its poster set.
export default async function DropPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fan = await getFanFromCookies();
  const drop = dropsRepo.getByToken(token);

  if (!drop) {
    return (
      <main className="page">
        <h1>Card drop</h1>
        <p>That link doesn&apos;t match a card drop.</p>
        <p>
          <Link href="/">Banana Cards home</Link>
        </p>
      </main>
    );
  }

  const view = dropsRepo.toView(drop, new Date().toISOString());
  const isStream = view.kind === "stream";
  const closesOn = view.closesAt
    ? new Date(view.closesAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })
    : null;

  const heading = isStream ? (
    <>
      <span className={"drop-live-badge" + (view.isLive ? "" : " drop-live-badge-ended")}>
        {view.isLive ? "Live" : "Ended"}
      </span>
      <h1>{view.title}</h1>
      <p className="drop-subhead">A card for everyone watching live on the {view.sourceName}.</p>
    </>
  ) : (
    <>
      <h1>{view.sourceName} dropped a card</h1>
      <p className="drop-subhead">
        {view.title}
        {closesOn && view.open && ` · open until ${closesOn}`}
      </p>
    </>
  );

  if (!view.open) {
    return (
      <main className="page">
        {heading}
        <p className="drop-closed">
          {isStream
            ? "This stream isn't live anymore. Stream cards can only be claimed while the game is on, so catch the next one live."
            : "This drop has closed."}
        </p>
        <p>
          <Link href="/">Banana Cards home</Link>
        </p>
      </main>
    );
  }

  if (!fan) {
    return (
      <main className="page">
        {heading}
        <p>Pick a name and it&apos;s yours. Other fans see this name when you trade.</p>
        <JoinToRedeem />
        <p className="quick-join-alt">
          Already collecting? <Link href="/sign-in">Sign in</Link>, then open this link again.
        </p>
      </main>
    );
  }

  if (dropsRepo.hasClaimed(token, fan.id)) {
    return (
      <main className="page">
        {heading}
        <p>You already have this one. It&apos;s one card per fan.</p>
        <p>
          <Link href="/collection">See my collection</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      {heading}
      <DropClaim token={view.token} backLine={isStream ? "You were watching." : "You were following."} />
      <p>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
