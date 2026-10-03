// Canonical list of the four demo fan personas scripts/seed.ts creates.
// Shared by DemoPersonaSwitcher (client - one-click sign-in) and the trade
// page's dev-only trade-code list (server - reads their fan ids from the
// db) so the two can't drift the way two hand-duplicated copies could.
export const DEMO_PERSONAS = [
  {
    email: "peelmaster@example.com",
    displayName: "Peel Master Flex",
    blurb: "Broad collector, 9 cards",
  },
  {
    email: "rookienanas@example.com",
    displayName: "Rookie Nanas",
    blurb: "Brand-new fan, 2 cards",
  },
  {
    email: "sluggo@example.com",
    displayName: "Sluggo",
    blurb: "1 confirmed trade, 1 to confirm",
  },
  {
    email: "zesty@example.com",
    displayName: "Zesty",
    blurb: "Pending trade awaiting Sluggo",
  },
] as const;
