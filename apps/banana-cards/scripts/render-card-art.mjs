// One-time (re-run as needed) generator for the real PNG card-art files
// under public/card-art/. No AI image-generation tool is available in this
// environment, so these are original cartoon/stick-figure illustrations -
// plain SVG shapes rasterized to PNG with Playwright/Chromium - not photos
// and not per-card AI art. Every player figure is a faceless stick figure
// (head + thick rounded limb strokes, no identifying features), every team
// crest is an invented shield+monogram (not a reproduction of any real
// team's actual logo), and the mascot is an original dancing-banana design
// - all per the standing "no real player names or likeness" content rule.
//
// Usage: node scripts/render-card-art.mjs
// Requires Playwright + a Chromium install (see CHROMIUM_PATH below) - dev
// tooling only, not part of the app's runtime.

import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "public", "card-art");
const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SIZE = 480; // rendered pixel size; source is a 100x100 viewBox, so this is ~4.8x crisp

mkdirSync(OUT_DIR, { recursive: true });

// ---- Small helpers for a consistent "cartoon sticker" look: everything is
// white fill/stroke with a soft dark outline underneath, so shapes read
// clearly against any of the app's colored gradient panels. ----

function outlineLine(x1, y1, x2, y2, width) {
  return (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(0,0,0,0.28)" stroke-width="${width + 2.4}" stroke-linecap="round" />` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="${width}" stroke-linecap="round" />`
  );
}

function outlineCircle(cx, cy, r, { fill = "#ffffff" } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="rgba(0,0,0,0.28)" stroke-width="2.4" />`;
}

function outlinePath(d, { fill = "#ffffff", opacity = 1 } = {}) {
  return (
    `<path d="${d}" fill="rgba(0,0,0,0.28)" transform="translate(0,1.4)" opacity="${opacity}" />` +
    `<path d="${d}" fill="${fill}" opacity="${opacity}" stroke="rgba(0,0,0,0.28)" stroke-width="1.6" />`
  );
}

function svgDoc(inner) {
  return `<!doctype html><html><head><style>
    html,body{margin:0;background:transparent;}
    svg{display:block;}
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${SIZE}" height="${SIZE}">
    ${inner}
  </svg>
  </body></html>`;
}

// ---- Roster: four faceless stick-figure poses ----

const rosterBatter = svgDoc(`
  ${outlineCircle(50, 20, 9)}
  ${outlineLine(50, 29, 50, 55, 7)}
  ${outlineLine(50, 55, 37, 83, 6.5)}
  ${outlineLine(50, 55, 63, 83, 6.5)}
  ${outlineLine(50, 36, 27, 30, 6)}
  ${outlineLine(50, 43, 27, 30, 6)}
  ${outlineLine(27, 30, 10, 8, 5)}
`);

const rosterPitcher = svgDoc(`
  ${outlineCircle(50, 18, 9)}
  ${outlineLine(50, 27, 50, 52, 7)}
  ${outlineLine(50, 52, 35, 46, 6)}
  ${outlineLine(35, 46, 27, 61, 6)}
  ${outlineLine(50, 52, 61, 80, 6.5)}
  ${outlineLine(50, 33, 35, 29, 6)}
  ${outlineLine(50, 32, 73, 24, 6)}
  ${outlineCircle(76, 21, 4, { fill: "#ffffff" })}
`);

const rosterSlider = svgDoc(`
  ${outlineCircle(26, 54, 8)}
  ${outlineLine(26, 62, 60, 76, 7)}
  ${outlineLine(60, 76, 86, 68, 6.5)}
  ${outlineLine(60, 76, 78, 90, 6)}
  ${outlineLine(26, 58, 12, 48, 6)}
  ${outlineCircle(13, 40, 4, { fill: "#ffffff" })}
`);

const rosterDiver = svgDoc(`
  ${outlineCircle(24, 34, 8)}
  ${outlineLine(24, 41, 65, 55, 7)}
  ${outlineLine(65, 55, 86, 49, 6.5)}
  ${outlineLine(65, 55, 89, 63, 6)}
  ${outlineLine(24, 37, 7, 29, 6)}
  ${outlineCircle(5, 27, 6, { fill: "#ffffff" })}
`);

// ---- Team crests: shield + invented monogram (bake in per-team initials) ----

function teamCrest(initials) {
  return svgDoc(`
    ${outlinePath("M50 6l36 14v26c0 26-16 42-36 48C30 88 14 72 14 46V20z")}
    <path d="M50 14l28 11v21c0 21-12 33-28 38-16-5-28-17-28-38V25z" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.55" />
    <text x="50" y="60" text-anchor="middle" font-size="30" font-weight="800" fill="#ffffff" font-family="Arial, sans-serif" stroke="rgba(0,0,0,0.28)" stroke-width="1">${initials}</text>
  `);
}

// ---- Venue: stadium bowl skyline under a banana crescent moon ----

const venue = svgDoc(`
  ${outlinePath("M50 70c-24 0-40-13-40-13v-10c8 8 22 13 40 13s32-5 40-13v10s-16 13-40 13z")}
  ${outlineLine(14, 47, 32, 58, 0)}
  <path d="M14 47c8 9 22 15 36 15s28-6 36-15" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" />
  <path d="M14 47c8 9 22 15 36 15s28-6 36-15" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="8" stroke-linecap="round" transform="translate(0,1.6)" opacity="0.5"/>
  ${outlineLine(18, 18, 18, 42, 4)}
  ${outlineLine(82, 18, 82, 42, 4)}
  ${outlineCircle(18, 16, 4)}
  ${outlineCircle(82, 16, 4)}
  ${outlinePath("M62 20a10 10 0 1 1-4-18 13 13 0 1 0 4 18z", { opacity: 0.95 })}
`);

// ---- Character: original dancing-banana mascot, with a simple cartoon face ----

const character = svgDoc(`
  ${outlinePath("M50 18c10 0 16 8 16 20 0 16-8 26-16 34-8-8-16-18-16-34 0-12 6-20 16-20z")}
  <path d="M38 26c-4-6-4-14 2-18" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
  ${outlineLine(30, 58, 16, 68, 6)}
  ${outlineLine(70, 58, 84, 68, 6)}
  ${outlineLine(40, 82, 32, 94, 6)}
  ${outlineLine(60, 82, 68, 94, 6)}
  <circle cx="44" cy="40" r="2.6" fill="#17140f" />
  <circle cx="56" cy="40" r="2.6" fill="#17140f" />
  <path d="M42 47c3 3 13 3 16 0" stroke="#17140f" stroke-width="2.2" fill="none" stroke-linecap="round" />
`);

// ---- Moment: freeze-frame flash burst around a diving action figure ----

const flashLines = Array.from({ length: 10 })
  .map((_, i) => {
    const angle = (i / 10) * Math.PI * 2;
    const x2 = 50 + Math.cos(angle) * 47;
    const y2 = 50 + Math.sin(angle) * 47;
    const x1 = 50 + Math.cos(angle) * 33;
    const y1 = 50 + Math.sin(angle) * 33;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.8" />`;
  })
  .join("\n");

const moment = svgDoc(`
  ${flashLines}
  <circle cx="50" cy="50" r="27" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.55" />
  ${outlineCircle(38, 44, 7)}
  ${outlineLine(38, 50, 62, 58, 6)}
  ${outlineLine(62, 58, 78, 53, 5.5)}
  ${outlineLine(38, 47, 24, 40, 5.5)}
`);

// ---- Milestone: trophy with a celebratory ribbon burst ----

const milestone = svgDoc(`
  ${outlinePath("M38 18h24v14c0 9-5 16-12 16s-12-7-12-16z")}
  <path d="M38 22c-8 0-13 5-13 11s6 9 12 9" fill="none" stroke="#ffffff" stroke-width="3" />
  <path d="M62 22c8 0 13 5 13 11s-6 9-12 9" fill="none" stroke="#ffffff" stroke-width="3" />
  ${outlinePath("M46 48h8v10h-8z")}
  ${outlinePath("M32 82l14-16 4 6 4-6 14 16-18-6z", { opacity: 0.95 })}
`);

// ---- Trade-only: two exchanging arrows around a ticket motif ----

const tradeOnly = svgDoc(`
  ${outlinePath("M20 40h44l-10-10 6-6 20 20-20 20-6-6 10-10H20z", { opacity: 0.9 })}
  ${outlinePath("M80 60H36l10 10-6 6-20-20 20-20 6 6-10 10h44z", { opacity: 0.65 })}
`);

// ---- Special items: five specific props ----

const itemCape = svgDoc(`
  ${outlinePath("M50 14c-10 0-18 6-22 14l6 44c4-8 10-12 16-12s12 4 16 12l6-44c-4-8-12-14-22-14z")}
  <path d="M40 22h20v8H40z" fill="#ffffff" opacity="0.7" stroke="rgba(0,0,0,0.28)" stroke-width="1.4" />
`);

const itemHelmet = svgDoc(`
  ${outlineCircle(50, 46, 26)}
  <circle cx="50" cy="46" r="16" fill="rgba(23,20,15,0.32)" stroke="rgba(0,0,0,0.28)" stroke-width="1.6" />
  ${outlinePath("M30 66h40v10a5 5 0 0 1-5 5H35a5 5 0 0 1-5-5z", { opacity: 0.85 })}
  ${Array.from({ length: 5 })
    .map((_, i) => {
      const a = (i / 5) * Math.PI * 2;
      const x1 = 50 + Math.cos(a) * 30;
      const y1 = 20 + Math.sin(a) * 30;
      const x2 = 50 + Math.cos(a) * 39;
      const y2 = 20 + Math.sin(a) * 39;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7" />`;
    })
    .join("\n")}
`);

const itemStilts = svgDoc(`
  ${outlineLine(38, 14, 28, 88, 5.5)}
  ${outlineLine(62, 14, 72, 88, 5.5)}
  ${outlinePath("M29 52h13v9H29z")}
  ${outlinePath("M58 52h13v9H58z")}
  ${outlineLine(34, 14, 66, 14, 5.5)}
`);

const itemUnicycle = svgDoc(`
  <circle cx="50" cy="62" r="24" fill="none" stroke="#ffffff" stroke-width="4" />
  <circle cx="50" cy="62" r="24" fill="none" stroke="rgba(0,0,0,0.28)" stroke-width="1.6" />
  ${outlineCircle(50, 62, 4)}
  ${outlineLine(50, 38, 50, 22, 4.5)}
  ${outlinePath("M41 15h18v9H41z")}
  ${outlineLine(31, 46, 21, 42, 4)}
  ${outlineLine(69, 46, 79, 42, 4)}
`);

const itemCowboyHat = svgDoc(`
  ${outlinePath("M12 62c0-6 17-11 38-11s38 5 38 11-17 8-38 8-38-2-38-8z")}
  ${outlinePath("M32 60c0-16 8-28 18-28s18 12 18 28")}
  <path d="M32 58c8-6 28-6 36 0" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="2" />
`);

const assets = {
  "roster-batter.png": rosterBatter,
  "roster-pitcher.png": rosterPitcher,
  "roster-slider.png": rosterSlider,
  "roster-diver.png": rosterDiver,
  "team-savannah-bananas.png": teamCrest("SB"),
  "team-party-animals.png": teamCrest("PA"),
  "team-firefighters.png": teamCrest("F"),
  "team-texas-tailgaters.png": teamCrest("TT"),
  "team-loco-beach-coconuts.png": teamCrest("LB"),
  "team-indianapolis-clowns.png": teamCrest("IC"),
  "venue.png": venue,
  "character.png": character,
  "moment.png": moment,
  "milestone.png": milestone,
  "trade-only.png": tradeOnly,
  "item-cape.png": itemCape,
  "item-helmet.png": itemHelmet,
  "item-stilts.png": itemStilts,
  "item-unicycle.png": itemUnicycle,
  "item-cowboy-hat.png": itemCowboyHat,
};

async function main() {
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } });
    for (const [filename, html] of Object.entries(assets)) {
      await page.setContent(html);
      const svgHandle = await page.$("svg");
      const buffer = await svgHandle.screenshot({ omitBackground: true });
      writeFileSync(path.join(OUT_DIR, filename), buffer);
      console.log("wrote", filename);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
