"use client";

import { useMemo, useState } from "react";
import type { OwnedCardView } from "@/lib/db";

type SortKey = "newest" | "oldest" | "title" | "type";
type ViaFilter = "all" | "redemption" | "trade";

// Fixed display order for the card taxonomy (card_templates.type) - filter
// pills only show types the fan actually owns at least one of, in this
// order, so the row never has more options than there are cards to find.
const TYPE_ORDER: OwnedCardView["type"][] = [
  "team",
  "roster",
  "moment",
  "character",
  "venue",
  "special_item",
  "trade_only",
  "milestone",
];

const TYPE_LABELS: Record<OwnedCardView["type"], string> = {
  team: "Team",
  roster: "Roster",
  moment: "Moment",
  character: "Character",
  venue: "Venue",
  special_item: "Special item",
  trade_only: "Trade only",
  milestone: "Milestone",
};

export function CollectionBoard({ cards }: { cards: OwnedCardView[] }) {
  const [typeFilter, setTypeFilter] = useState<"all" | OwnedCardView["type"]>("all");
  const [viaFilter, setViaFilter] = useState<ViaFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const stats = useMemo(() => {
    const byType = new Map<OwnedCardView["type"], number>();
    let redemption = 0;
    let trade = 0;
    for (const card of cards) {
      byType.set(card.type, (byType.get(card.type) ?? 0) + 1);
      if (card.acquired_via === "redemption") redemption++;
      else trade++;
    }
    return { total: cards.length, byType, redemption, trade };
  }, [cards]);

  const availableTypes = TYPE_ORDER.filter((t) => stats.byType.has(t));

  const visible = useMemo(() => {
    let list = cards;
    if (typeFilter !== "all") list = list.filter((c) => c.type === typeFilter);
    if (viaFilter !== "all") list = list.filter((c) => c.acquired_via === viaFilter);

    const sorted = [...list];
    switch (sortBy) {
      case "newest":
        sorted.sort((a, b) => b.acquired_at.localeCompare(a.acquired_at));
        break;
      case "oldest":
        sorted.sort((a, b) => a.acquired_at.localeCompare(b.acquired_at));
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "type":
        sorted.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
        break;
    }
    return sorted;
  }, [cards, typeFilter, viaFilter, sortBy]);

  return (
    <div className="collection-board">
      <div className="collection-stats">
        <span className="collection-stat-total">{stats.total} card{stats.total === 1 ? "" : "s"}</span>
        {availableTypes.map((t) => (
          <span key={t} className="collection-stat-pill">
            {stats.byType.get(t)} {TYPE_LABELS[t]}
          </span>
        ))}
        <span className="collection-stat-pill">{stats.redemption} redeemed</span>
        <span className="collection-stat-pill">{stats.trade} traded</span>
      </div>

      <div className="collection-controls">
        <div className="collection-filter-group">
          <button
            type="button"
            className={"filter-pill" + (typeFilter === "all" ? " filter-pill-selected" : "")}
            onClick={() => setTypeFilter("all")}
          >
            All types
          </button>
          {availableTypes.map((t) => (
            <button
              type="button"
              key={t}
              className={"filter-pill" + (typeFilter === t ? " filter-pill-selected" : "")}
              onClick={() => setTypeFilter(t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="collection-filter-group">
          {(["all", "redemption", "trade"] as ViaFilter[]).map((v) => (
            <button
              type="button"
              key={v}
              className={"filter-pill" + (viaFilter === v ? " filter-pill-selected" : "")}
              onClick={() => setViaFilter(v)}
            >
              {v === "all" ? "Any source" : v === "redemption" ? "Redeemed" : "Traded"}
            </button>
          ))}
        </div>

        <label className="collection-sort">
          Sort by{" "}
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title (A&ndash;Z)</option>
            <option value="type">Type</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <p>No cards match these filters.</p>
      ) : (
        <div className="card-grid">
          {visible.map((card) => (
            <div key={card.instance_id} className="card-tile">
              <span className="card-tile-type">{card.type}</span>
              <h2>{card.title}</h2>
              {card.player_name && <p className="card-tile-player">{card.player_name}</p>}
              {card.description && <p>{card.description}</p>}
              {card.stats && (
                <p className="card-tile-stats">
                  {Object.entries(card.stats)
                    .map(([label, value]) => `${label} ${value}`)
                    .join(" · ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
