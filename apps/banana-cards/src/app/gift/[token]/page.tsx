import Link from "next/link";
import { getFanFromCookies } from "@/lib/authSession";
import { giftsRepo } from "@/lib/db";
import { GiftClaim } from "@/components/GiftClaim";
import { CardArt } from "@/components/CardArt";

// Where a pass-it-on QR lands. Usually opened by someone brand new, straight
// from their phone's camera app - so it works without an account (quick
// join is built in) and says plainly who's giving them what.
export default async function GiftPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const fan = await getFanFromCookies();
  const gift = giftsRepo.getView(token, new Date().toISOString());

  if (!gift) {
    return (
      <main className="page">
        <h1>Pass it on</h1>
        <p>That code doesn&apos;t match a card. Ask the fan who showed it to you for a fresh one.</p>
        <p>
          <Link href="/">Banana Cards home</Link>
        </p>
      </main>
    );
  }

  // Someone opening a code they already claimed (e.g. reloading after
  // claiming) sees their card, not an error.
  const claimedByMe = gift.status === "claimed" && fan !== null && gift.toFanId === fan.id;

  let unavailable: string | null = null;
  if (!claimedByMe) {
    if (gift.status === "claimed") unavailable = "Someone already claimed this card.";
    else if (gift.status === "cancelled") {
      unavailable = `${gift.fromFan.displayName} made a newer code for this card. Ask them to show it again.`;
    } else if (gift.expired) {
      unavailable = `This code expired. Ask ${gift.fromFan.displayName} for a fresh one.`;
    } else if (fan && fan.id === gift.fromFan.id) {
      unavailable = "This is your own pass-it-on code. Show it to someone new so they can scan it.";
    } else if (fan && !giftsRepo.canReceive(fan.id)) {
      unavailable =
        "Pass-it-on cards are for fans who are just getting started, and you're already collecting. " +
        "Trade with each other instead!";
    }
  }

  return (
    <main className="page">
      <h1>{gift.fromFan.displayName} is passing you a card</h1>
      <div className="card-tile gift-card">
        <CardArt src={gift.card.imagePath} />
        <span className="card-tile-type">{gift.card.type}</span>
        <h2>{gift.card.title}</h2>
        <p>{gift.card.description}</p>
      </div>
      <GiftClaim
        token={gift.token}
        fromFan={gift.fromFan}
        signedInAs={fan?.display_name ?? null}
        claimedByMe={claimedByMe}
        unavailable={unavailable}
      />
    </main>
  );
}
