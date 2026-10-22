import Link from "next/link";
import type { SetProgressView } from "@/lib/db";

// The collection page's Sets section: completion value and access value
// from claude/card-value-model.md, side by side. Each set shows how far
// along the fan is, which cards are still missing (so they know what to ask
// a friend for in a trade), and the perk it unlocks.
//
// Deliberately absent, per the fan-first guardrails: no deadlines, no
// "X% of fans finished this," no rarity, and no way to buy a missing card.
// Sets the fan has started come first, so the page leads with what's in reach.
export function SetsBoard({ sets }: { sets: SetProgressView[] }) {
  const ordered = [...sets].sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    return b.owned / b.total - a.owned / a.total;
  });

  return (
    <section className="sets-board" aria-labelledby="sets-heading">
      <h2 id="sets-heading">Sets</h2>
      <p className="sets-intro">
        Finish a set to unlock something small and real. Sets never expire, and every card can be
        redeemed at a game or traded for.
      </p>
      <div className="sets-grid">
        {ordered.map((set) => {
          const missing = set.total - set.owned;
          return (
            <article key={set.id} className={"set-card" + (set.complete ? " set-card-complete" : "")}>
              <header className="set-card-header">
                <h3>{set.title}</h3>
                <span className="set-card-count">
                  {set.owned} of {set.total}
                </span>
              </header>
              <p className="set-card-description">{set.description}</p>
              <div
                className="set-progress"
                role="progressbar"
                aria-label={`${set.title} progress`}
                aria-valuemin={0}
                aria-valuemax={set.total}
                aria-valuenow={set.owned}
              >
                <div className="set-progress-fill" style={{ width: `${(set.owned / set.total) * 100}%` }} />
              </div>
              <ul className="set-checklist">
                {set.items.map((item) => (
                  <li key={item.templateId} className={item.owned ? "set-item-owned" : "set-item-missing"}>
                    <span aria-hidden="true">{item.owned ? "✓" : "○"}</span>
                    <span>
                      {item.title}
                      <span className="visually-hidden">{item.owned ? " (collected)" : " (missing)"}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {set.complete ? (
                <div className="set-perk set-perk-unlocked">
                  <p>
                    <strong>Unlocked: {set.perk.title}</strong>
                  </p>
                  <p>{set.perk.description}</p>
                </div>
              ) : (
                <div className="set-perk">
                  <p>
                    <strong>Finish to unlock:</strong> {set.perk.title}
                  </p>
                  {missing === 1 && (
                    <p className="set-perk-hint">
                      One card to go. <Link href="/trade">Trade for it</Link> or watch for it at a game.
                    </p>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
