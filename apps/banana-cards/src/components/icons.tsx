import {
  Camera,
  Gift,
  Home,
  LayoutGrid,
  Landmark,
  Repeat2,
  Shield,
  Sparkles,
  Ticket,
  Trophy,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { OwnedCardView } from "@/lib/db";

// One icon + one-line style label per card_templates.type, shared by
// CardFace (the card visual) and anywhere else that needs to describe a
// type generically. Centralized here so CardFace and any future caller stay
// in sync automatically instead of duplicating this switch.
export const TYPE_ICONS: Record<OwnedCardView["type"], LucideIcon> = {
  team: Shield,
  roster: UserRound,
  moment: Camera,
  character: Sparkles,
  venue: Landmark,
  special_item: Gift,
  trade_only: Repeat2,
  milestone: Trophy,
};

// Bottom nav icons - kept in the same file as the card-type icons purely
// because both are "small set of lucide icons used as a lookup," not
// because they're conceptually related.
export const NAV_ICONS = {
  home: Home,
  redeem: Ticket,
  collection: LayoutGrid,
  trade: Repeat2,
};
