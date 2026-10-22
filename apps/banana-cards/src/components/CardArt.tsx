import Image from "next/image";

// A card's illustration (card_templates.image_path, an SVG under
// public/cards/). Decorative: the card's title always sits right next to it,
// so the image itself carries no alt text. Renders nothing for a card with
// no art, so every caller can drop it in unconditionally.
export function CardArt({
  src,
  variant = "tile",
}: {
  src: string | null | undefined;
  variant?: "tile" | "thumb" | "reveal";
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      alt=""
      width={220}
      height={150}
      unoptimized
      className={`card-art card-art-${variant}`}
    />
  );
}
