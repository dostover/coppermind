import { cardTemplatesRepo, parseCardStats, setsRepo } from "./db";

// What every "you got a card" response carries, however the card arrived
// (token, live stream, social drop): the card face for the reveal, and the
// fan's set progress after getting it. Shared so the reveal looks and
// behaves the same on every path.

export interface RevealCard {
  instanceId: string;
  title: string;
  description: string;
  type: string | null;
  imagePath: string | null;
  perk: string | null;
  stats: Record<string, string | number> | null;
  keepsake: boolean;
}

export function cardForReveal(instanceId: string, templateId: string): RevealCard {
  const template = cardTemplatesRepo.getById(templateId);
  return {
    instanceId,
    title: template?.title ?? "Unknown card",
    description: template?.description ?? "",
    type: template?.type ?? null,
    imagePath: template?.image_path ?? null,
    perk: template?.perk ?? null,
    stats: parseCardStats(template?.stats ?? null),
    keepsake: template?.keepsake === 1,
  };
}

export interface SetStep {
  title: string;
  owned: number;
  total: number;
  complete: boolean;
  newlyCompleted: boolean;
  perkTitle: string;
}

// After a fan gets a card - from a token, a stream or a social drop - every
// set that card belongs to, with their progress now. newlyCompleted is true
// only when this card was the last one missing (the moment the set's perk
// unlocks), which is why the caller says whether the fan already held a copy
// before getting this one.
export function setStepsForNewCard(fanId: string, templateId: string, alreadyOwned: boolean): SetStep[] {
  return setsRepo
    .listProgressForFan(fanId)
    .filter((set) => set.items.some((item) => item.templateId === templateId))
    .map((set) => ({
      title: set.title,
      owned: set.owned,
      total: set.total,
      complete: set.complete,
      newlyCompleted: set.complete && !alreadyOwned,
      perkTitle: set.perk.title,
    }));
}
