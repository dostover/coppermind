import Link from "next/link";
import { notesRepo } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";

// Forces dynamic rendering (like /library and /notes/[id]) rather than the
// static prerender this page would otherwise get - it now reads the live
// notes table for the "pick up where you left off" teaser below, and
// without this a production build would bake in whatever that query
// returned once at build time (almost always "no notes yet") and never
// update again.
export const dynamic = "force-dynamic";

// Small line icons matching Nav.tsx's style (24x24 viewBox, stroke
// currentColor, no fill) rather than emoji, so the homepage reads as the
// same product as the sidebar rather than a separate marketing page bolted
// on top of it.
function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.25" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 20l1-4.2L15.6 5.2a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L8.2 19l-4.2 1z" />
      <path d="M14 6.5l3.5 3.5" />
    </svg>
  );
}

function OrganizeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M4 7a2 2 0 0 1 2-2h3.4l1.6 2H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    </svg>
  );
}

const STEPS = [
  {
    icon: <CameraIcon />,
    title: "Capture a page",
    body: "Snap or upload a photo of a handwritten page - single sheets, multi-page notes, and PDFs all work.",
  },
  {
    icon: <EditIcon />,
    title: "Review & edit",
    body: "Inkwell transcribes it and flags anything it wasn't sure about, ready for you to fix up.",
  },
  {
    icon: <OrganizeIcon />,
    title: "Organize & export",
    body: "Tag it, file it in a folder, and send it to Google Docs whenever you're ready to share it.",
  },
];

export default async function HomePage() {
  const recentNotes = notesRepo.listAll().slice(0, 3);

  return (
    <div className="home">
      <div className="card hero">
        <h1>Inkwell</h1>
        <div className="hero-rule" />
        <p>
          Upload a photo of a handwritten page. Inkwell transcribes it, flags anything
          it&apos;s unsure about, and learns from every correction you make - so the next
          page in your handwriting comes back cleaner than the last.
        </p>
        <p>
          <Link href="/upload" className="button">
            {recentNotes.length > 0 ? "Capture a new page" : "Capture your first note"}
          </Link>
        </p>
      </div>

      <div className="home-steps">
        {STEPS.map((step, i) => (
          <div key={step.title} className="home-step card">
            <div className="home-step-icon">{step.icon}</div>
            <p className="home-step-number">Step {i + 1}</p>
            <strong>{step.title}</strong>
            <p className="muted">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="card home-tips">
        <h2>Editing tips</h2>
        <p className="muted">Once a page comes back transcribed, the review screen is a light editor:</p>
        <ul className="home-tip-list">
          <li>
            <span className="home-tip-sample flagged-sample">unsvre</span>
            <span>
              Words highlighted like this are ones Inkwell wasn&apos;t confident about - click in and
              fix them, and the highlight clears on its own.
            </span>
          </li>
          <li>
            <span className="home-tip-sample crossed-out-sample">scribble</span>
            <span>
              Crossed-out handwriting is kept with a strikethrough rather than dropped - delete it
              yourself if you don&apos;t want it in the note.
            </span>
          </li>
          <li>
            <span className="home-tip-sample line-type-select-sample">Paragraph ▾</span>
            <span>
              Use the dropdown beside any line to turn it into a heading, a paragraph, or a list
              item.
            </span>
          </li>
          <li>
            <span className="home-tip-sample">
              <kbd>Enter</kbd> / <kbd>Backspace</kbd>
            </span>
            <span>
              Press Enter inside a line to split it in two, or Backspace at the start of a line to
              merge it back into the one above.
            </span>
          </li>
        </ul>
      </div>

      {recentNotes.length > 0 && (
        <div className="home-recent">
          <div className="home-recent-header">
            <h2>Pick up where you left off</h2>
            <Link href="/library">View your library →</Link>
          </div>
          <div className="home-recent-grid">
            {recentNotes.map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`} className="note-card card">
                <strong>{note.title ?? "Untitled note"}</strong>
                <p className="muted note-card-meta">
                  <StatusBadge status={note.status} />
                  {note.pages.length > 1 ? ` · ${note.pages.length} pages` : ""}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
