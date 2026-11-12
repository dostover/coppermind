import { ANTHROPIC_CONFIGURED, GOOGLE_OAUTH_CONFIGURED } from "@/lib/config";
import { SEMANTIC_SEARCH_CONFIGURED } from "@/lib/embeddings";

// Read env-derived flags at request time, not once at build time - adding a
// key to .env.local and restarting must flip a service to On here.
export const dynamic = "force-dynamic";

interface Service {
  name: string;
  configured: boolean;
  sends: string;
  why: string;
  offNote: string;
}

// About (03-ux-screens.md §9): plain-language account of what leaves this
// machine and why. Only booleans reach this page - the keys themselves stay
// in server config and are never rendered or sent to the browser.
function services(): Service[] {
  return [
    {
      name: "Anthropic (Claude)",
      configured: ANTHROPIC_CONFIGURED,
      sends: "Page images and their text.",
      why: "Photos of your pages are sent to be transcribed, and the transcribed text is sent for titles, tags, corrections, summaries and answers to your questions.",
      offNote: "Without ANTHROPIC_API_KEY, Inkwell uses a built-in stand-in and nothing is sent to Anthropic.",
    },
    {
      name: "Voyage AI",
      configured: SEMANTIC_SEARCH_CONFIGURED,
      sends: "Passage text.",
      why: "Short passages of your notes' text (and your search queries) are sent to turn them into vectors for searching by idea. No images.",
      offNote: "Without VOYAGE_API_KEY, search matches on words locally and nothing is sent to Voyage AI.",
    },
    {
      name: "Google Docs",
      configured: GOOGLE_OAUTH_CONFIGURED,
      sends: "Only notes you export or sync.",
      why: "A note's text goes to your Google Drive only when you press Export to Google Docs on it, or sync a note you already exported. Nothing else is uploaded.",
      offNote: "Without a Google OAuth client set up, nothing is sent to Google.",
    },
  ];
}

export default function SettingsPage() {
  const list = services();
  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="card settings-section" aria-labelledby="about-heading">
        <h2 id="about-heading">About: what Inkwell sends to outside services</h2>
        <p className="muted">
          Inkwell runs on your own computer and keeps your notes, photos and database here. It only
          talks to an outside service when that service&apos;s key is set in .env.local - for any
          service whose key isn&apos;t set, nothing is sent to it at all.
        </p>
        <ul className="service-list">
          {list.map((s) => (
            <li key={s.name} className="service-row">
              <div className="service-head">
                <strong>{s.name}</strong>
                <span
                  className={`service-state ${s.configured ? "on" : "off"}`}
                  data-testid={`service-state-${s.name}`}
                >
                  <span className="status-dot" aria-hidden="true" />
                  {s.configured ? "On" : "Off"}
                </span>
              </div>
              <p className="service-sends">
                <span className="muted">Sends:</span> {s.sends}
              </p>
              <p className="muted service-why">{s.configured ? s.why : `${s.why} ${s.offNote}`}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
