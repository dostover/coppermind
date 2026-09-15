// Shared status pill: a colored dot + short label, reused everywhere a
// note's or page's processing state is shown - the Library grid, the review
// screen's per-page blocks, and the carousel thumbnails. One visual pattern
// learned once (03-ux-screens.md's cross-screen note), instead of each
// screen inventing its own "still working" copy. Pure presentation, no
// hooks, so it works from both server components (library/page.tsx) and
// client components (ReviewEditor.tsx) without a "use client" directive.
export type NoteOrPageStatus = "uploaded" | "transcribing" | "ready_for_review" | "reviewed" | "error";

const LABELS: Record<NoteOrPageStatus, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing…",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  error: "Needs attention",
};

export function StatusBadge({
  status,
  className,
}: {
  status: NoteOrPageStatus;
  className?: string;
}) {
  return (
    <span className={["status-badge", className].filter(Boolean).join(" ")}>
      <span className={`status-dot status-${status}`} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}

// Bare dot only, no label - for tight spaces like a carousel thumbnail
// corner, where the page number is already the label.
export function StatusDot({ status, className }: { status: NoteOrPageStatus; className?: string }) {
  return (
    <span
      className={["status-dot", `status-${status}`, className].filter(Boolean).join(" ")}
      aria-hidden="true"
    />
  );
}
