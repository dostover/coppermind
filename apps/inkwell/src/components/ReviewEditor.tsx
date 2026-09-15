"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TranscriptSegment } from "@/lib/ai/types";
import type { FolderRow, NotePage, NoteTagView } from "@/lib/db";
import { StatusBadge, StatusDot } from "@/components/StatusBadge";

interface Props {
  noteId: string;
  pages: NotePage[];
  initialTitle: string | null;
  initialTitleSource: "ai" | "user";
  initialFolderId: string | null;
  initialTags: NoteTagView[];
  allFolders: FolderRow[];
  allTagNames: string[];
  googleConfigured: boolean;
  googleConnected: boolean;
  initialGoogleDocUrl: string | null;
}

// Multi-page notes: each page transcribes independently (see jobs.ts), so
// this component tracks per-page state - status, error, and editable
// segments - rather than one flat segment list for the whole note. A page's
// local segments come from the server exactly once, the moment that page's
// status first reaches 'ready_for_review' (seededPagesRef below); after
// that, polling refreshes never touch it again, so in-progress edits on an
// already-ready page are never clobbered by a later page's job finishing.
interface PageState {
  id: string;
  pageNumber: number;
  imagePath: string;
  status: NotePage["status"];
  errorMessage: string | null;
  segments: TranscriptSegment[];
  imageRemoved: boolean;
}

function toPageState(p: NotePage): PageState {
  return {
    id: p.id,
    pageNumber: p.page_number,
    imagePath: p.image_path,
    status: p.status,
    errorMessage: p.error_message,
    // Only a ready page has anything meaningful to edit; other statuses
    // render no editor at all, so an empty array here is never shown.
    segments: p.status === "ready_for_review" ? p.segmentsCurrent : [],
    imageRemoved: p.imageRemoved,
  };
}

export function ReviewEditor({
  noteId,
  pages,
  initialTitle,
  initialTitleSource,
  initialFolderId,
  initialTags,
  allFolders,
  allTagNames,
  googleConfigured,
  googleConnected,
  initialGoogleDocUrl,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [exportingToGoogle, setExportingToGoogle] = useState(false);
  const [googleDocUrl, setGoogleDocUrl] = useState(initialGoogleDocUrl);
  const [googleExportError, setGoogleExportError] = useState<string | null>(null);
  const [pageStates, setPageStates] = useState<PageState[]>(() => pages.map(toPageState));
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [retryingPageIds, setRetryingPageIds] = useState<Set<string>>(new Set());
  const [deletingImagePageIds, setDeletingImagePageIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI-trust visual language (03-ux-screens.md's cross-screen note), extended
  // from tags to the title: shows the same "AI suggested this" badge only
  // while the title is both server-recorded as AI-derived AND still exactly
  // what's on screen - the instant the user types something different, this
  // goes false immediately (same "the flag clears the moment you edit"
  // feedback the transcription segments already give), well before Save.
  const titleIsAiSuggested = initialTitleSource === "ai" && title.trim() === (initialTitle ?? "").trim();

  // Image-region highlighting (AC-6 last bullet / FR-5.5, best-effort): which
  // segment is currently focused, so its sourceRegion (if any) can be drawn
  // as an overlay box on the image above. Segment ids are globally unique
  // across every page, so one id -> at most one page's image ever shows a
  // highlight. See SourceRegion's doc comment in ai/types.ts for why 0-1
  // fractional coordinates need no image-size bookkeeping here.
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  // Every page's image lives in one shared carousel above the transcriptions
  // (rather than each page's image sitting inline next to its own text - see
  // the render below), so there's exactly one "which page's image is showing"
  // index instead of one ref per page.
  const [activePageIndex, setActivePageIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  function handleSegmentFocus(segmentId: string, pageId: string) {
    setActiveSegmentId(segmentId);
    const idx = pageStates.findIndex((p) => p.id === pageId);
    if (idx !== -1) setActivePageIndex(idx);
    // The transcriptions sit below the shared image carousel (see
    // 03-ux-screens.md §5's split-screen, approximated here as stacked
    // rather than side-by-side), so once you're editing a segment further
    // down the page that carousel is often scrolled out of view - "nearest"
    // is a no-op if it's already visible.
    carouselRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function handleSegmentBlur() {
    setActiveSegmentId(null);
  }

  // Segments render as <textarea> rather than <input> so long text can wrap
  // onto multiple visual lines instead of forcing horizontal scrolling. The
  // mock provider's segments are word/phrase-granular (see mockProvider.ts),
  // so this rarely mattered before, but the real ClaudeAIProvider often
  // returns a whole confident sentence as one segment - and a plain <input>
  // can never wrap its text internally, it just grows wider or overflows.
  // A <textarea> wraps naturally given a width, so it just needs its height
  // kept in sync with its (possibly multi-line) content - this measures and
  // sets that height directly on the element rather than through React
  // state, since it's pure presentation with no effect on the segment's
  // actual text.
  function autoGrow(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  const anyPageWorking = pageStates.some((p) => p.status === "uploaded" || p.status === "transcribing");
  const hasAnyReadyPage = pageStates.some((p) => p.status === "ready_for_review");
  const allSegments = pageStates.flatMap((p) => p.segments);
  const flaggedCount = allSegments.filter((s) => s.reviewRequired).length;
  const crossedOutCount = allSegments.filter((s) => s.crossedOut).length;
  const activePage = pageStates[activePageIndex] ?? pageStates[0];
  // Only show the highlight when the focused segment actually belongs to the
  // page currently showing in the carousel - handleSegmentFocus already
  // switches the carousel to match, so in practice this is always true while
  // a segment is focused, but it's a cheap guard against a stale index.
  const activeRegion = activePage?.segments.find((s) => s.id === activeSegmentId)?.sourceRegion;

  function goToPage(delta: -1 | 1) {
    setActivePageIndex((i) => Math.min(Math.max(i + delta, 0), pageStates.length - 1));
  }

  // Async processing (see src/lib/jobs.ts): upload/retry now enqueue a job
  // per page and return immediately, so this screen has to poll rather than
  // assume every page is done by the time it renders. Polling re-fetches the
  // server component via router.refresh(), which re-renders this component
  // with a fresh `pages` prop - the effect below re-runs on that prop change
  // and stops itself once no page is still uploaded/transcribing.
  useEffect(() => {
    if (!anyPageWorking) return;
    const interval = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(interval);
  }, [anyPageWorking, router]);

  // Per-page "seed once" sync: a page whose local status isn't yet
  // 'ready_for_review' adopts whatever the latest prop says (still working,
  // now ready, or now errored). The moment a page reaches 'ready_for_review'
  // locally, it's marked seeded and this effect stops touching it, so a
  // later poll (from some *other* page still working) can never overwrite
  // edits already in progress on this one.
  const seededPagesRef = useRef<Set<string>>(
    new Set(pages.filter((p) => p.status === "ready_for_review").map((p) => p.id))
  );
  useEffect(() => {
    setPageStates((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      let changed = false;
      for (const incoming of pages) {
        if (seededPagesRef.current.has(incoming.id)) continue;
        byId.set(incoming.id, toPageState(incoming));
        changed = true;
        if (incoming.status === "ready_for_review") seededPagesRef.current.add(incoming.id);
      }
      if (!changed) return prev;
      // Preserve page order (byId may have inserted in prop order already,
      // but pages is always sorted by page_number - safe to just re-derive).
      return pages.map((p) => byId.get(p.id) ?? toPageState(p));
    });
  }, [pages]);

  function updateSegment(pageId: string, segmentId: string, text: string) {
    setPageStates((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? { ...p, segments: p.segments.map((s) => (s.id === segmentId ? { ...s, text } : s)) }
          : p
      )
    );
    setSavedMessage(null);
  }

  // Local-only until Save - the tags/folder edits ride along with the same
  // PATCH as segments/title, so nothing is written to the server until the
  // user hits Save (matches how segment/title edits already behave).
  function addTag(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setTagInput("");
      return;
    }
    setTags((prev) => [
      ...prev,
      { id: `local-${trimmed}`, name: trimmed, source: "user", confidence: null },
    ]);
    setTagInput("");
    setSavedMessage(null);
  }

  function removeTag(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    setSavedMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setErrorMessage(null);

    const initialById = new Map(pages.flatMap((p) => p.segmentsCurrent.map((s) => [s.id, s.text])));
    const changedCount = allSegments.filter((s) => initialById.get(s.id) !== s.text).length;

    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          pages: pageStates
            .filter((p) => p.status === "ready_for_review")
            .map((p) => ({
              pageId: p.id,
              segments: p.segments.map((s) => ({ id: s.id, text: s.text })),
            })),
          folderId,
          tags: tags.map((t) => t.name),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed.");
      setSavedMessage(
        changedCount > 0
          ? `Saved - ${changedCount} correction${changedCount === 1 ? "" : "s"} recorded.`
          : "Saved."
      );
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRetryPage(pageId: string) {
    setRetryingPageIds((prev) => new Set(prev).add(pageId));
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Retry failed.");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingPageIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  }

  // "Delete original image only" (03-ux-screens.md §6) - distinct from
  // deleting the whole note below: this keeps the transcription and just
  // discards the source photo, irreversibly, so it asks first.
  async function handleDeleteImage(pageId: string) {
    const ok = window.confirm(
      "Delete this page's original photo? The transcription stays, but the photo itself can't be recovered afterward."
    );
    if (!ok) return;

    setDeletingImagePageIds((prev) => new Set(prev).add(pageId));
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/pages/${pageId}/delete-image`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't delete the image.");
      setPageStates((prev) => prev.map((p) => (p.id === pageId ? { ...p, imageRemoved: true } : p)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't delete the image.");
    } finally {
      setDeletingImagePageIds((prev) => {
        const next = new Set(prev);
        next.delete(pageId);
        return next;
      });
    }
  }

  // Exports (or re-exports, updating the same Doc in place - see
  // docsExport.ts) the note as it's currently saved on the server. Uses
  // last-saved content, not in-progress unsaved edits, same as how Save
  // itself works - this button doesn't implicitly save first, so an
  // unsaved edit isn't silently included.
  async function handleExportToGoogle() {
    setExportingToGoogle(true);
    setGoogleExportError(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/export-to-docs`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Export failed.");
      setGoogleDocUrl(data.url);
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setGoogleExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExportingToGoogle(false);
    }
  }

  async function handleDelete() {
    const ok = window.confirm("Move this note to Trash? You can restore it from Trash later.");
    if (!ok) return;

    setDeleting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed.");
      router.push("/library");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Delete failed.");
      setDeleting(false);
    }
  }

  // Render consecutive non-heading segments as one flowing "line" (a natural
  // reading paragraph made of individually-editable words/phrases), and
  // headings on their own line - rather than one full-width box per
  // segment, which reads badly once segments are word-granular (see
  // src/lib/ai/mockProvider.ts for why they're granular in the first place).
  function toLines(segments: TranscriptSegment[]): { type: "heading" | "flow"; segments: TranscriptSegment[] }[] {
    const lines: { type: "heading" | "flow"; segments: TranscriptSegment[] }[] = [];
    for (const segment of segments) {
      const isHeading = segment.structureType === "heading";
      const last = lines[lines.length - 1];
      if (isHeading) {
        lines.push({ type: "heading", segments: [segment] });
      } else if (last && last.type === "flow") {
        last.segments.push(segment);
      } else {
        lines.push({ type: "flow", segments: [segment] });
      }
    }
    return lines;
  }

  return (
    <div>
      {activePage && (
        <div className="note-image-carousel" ref={carouselRef}>
          <div className="note-image-wrap">
            {activePage.imageRemoved ? (
              // Original removed via "Delete original image" - the
              // transcription below is unaffected, this just replaces the
              // broken/missing <img> with an honest placeholder
              // (03-ux-screens.md §6's "clear ... state rather than a broken
              // image or blank area").
              <div className="image-removed-placeholder">
                <p className="muted" style={{ margin: 0 }}>
                  Original photo deleted. The transcription below is unaffected.
                </p>
              </div>
            ) : (
              <>
                <img
                  src={`/${activePage.imagePath}`}
                  alt="Uploaded handwritten page"
                  className="note-image"
                />
                {activeRegion && (
                  <div
                    className="region-highlight"
                    style={{
                      left: `${activeRegion.bbox[0] * 100}%`,
                      top: `${activeRegion.bbox[1] * 100}%`,
                      width: `${activeRegion.bbox[2] * 100}%`,
                      height: `${activeRegion.bbox[3] * 100}%`,
                    }}
                  />
                )}
              </>
            )}
          </div>

          {activePage.status === "ready_for_review" && !activePage.imageRemoved && (
            <button
              type="button"
              className="button secondary delete-image-button"
              onClick={() => handleDeleteImage(activePage.id)}
              disabled={deletingImagePageIds.has(activePage.id)}
            >
              {deletingImagePageIds.has(activePage.id) ? "Deleting…" : "Delete original image"}
            </button>
          )}

          {pageStates.length > 1 && (
            <>
              <div className="carousel-controls">
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => goToPage(-1)}
                  disabled={activePageIndex === 0}
                  aria-label="Previous page"
                >
                  ‹ Prev
                </button>
                <span className="muted">
                  Page {activePage.pageNumber} of {pageStates.length}
                </span>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => goToPage(1)}
                  disabled={activePageIndex === pageStates.length - 1}
                  aria-label="Next page"
                >
                  Next ›
                </button>
              </div>

              <div className="carousel-thumbs">
                {pageStates.map((p, i) => (
                  <button
                    type="button"
                    key={p.id}
                    className={`carousel-thumb${i === activePageIndex ? " active" : ""}`}
                    onClick={() => setActivePageIndex(i)}
                    aria-label={`Go to page ${p.pageNumber} (${p.status.replace(/_/g, " ")})`}
                    aria-current={i === activePageIndex}
                  >
                    {p.imageRemoved ? (
                      <span className="carousel-thumb-placeholder" aria-hidden="true">
                        ✕
                      </span>
                    ) : (
                      <img src={`/${p.imagePath}`} alt="" />
                    )}
                    {p.status !== "ready_for_review" && (
                      <StatusDot status={p.status} className="carousel-thumb-dot" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {pageStates.map((page) => {
        const lines = toLines(page.segments);
        const isRetrying = retryingPageIds.has(page.id);
        return (
          <div key={page.id} className="note-page-block">
            {pageStates.length > 1 && (
              <p className="muted note-page-label">
                Page {page.pageNumber} of {pageStates.length}
              </p>
            )}

            {(page.status === "uploaded" || page.status === "transcribing") && (
              <p className="muted" role="status" aria-live="polite">
                <StatusBadge status={page.status} /> - this updates automatically, no need to
                refresh.
              </p>
            )}

            {page.status === "error" && (
              <p className="toast error" role="alert">
                <StatusBadge status={page.status} />: {page.errorMessage ?? "Unknown error."} The
                original image is intact.{" "}
                <button
                  className="button"
                  onClick={() => handleRetryPage(page.id)}
                  disabled={isRetrying}
                >
                  {isRetrying ? "Retrying..." : "Retry this page"}
                </button>
              </p>
            )}

            {page.status === "ready_for_review" && (
              <div className="transcription">
                {lines.map((line, i) =>
                  line.type === "heading" ? (
                    <h2 key={line.segments[0].id} className="segment-heading">
                      <textarea
                        ref={autoGrow}
                        className="segment-input"
                        rows={1}
                        value={line.segments[0].text}
                        onChange={(e) => {
                          updateSegment(page.id, line.segments[0].id, e.target.value);
                          autoGrow(e.currentTarget);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        onFocus={() => handleSegmentFocus(line.segments[0].id, page.id)}
                        onBlur={handleSegmentBlur}
                      />
                    </h2>
                  ) : (
                    <p key={i} className="flow">
                      {line.segments.map((segment) => {
                        const titleParts = [
                          segment.crossedOut
                            ? "Crossed out in the original - kept here, delete if you don't want it"
                            : null,
                          segment.reviewRequired ? "Needs review - AI wasn't confident here" : null,
                        ].filter(Boolean);
                        return (
                          <textarea
                            key={segment.id}
                            ref={autoGrow}
                            rows={1}
                            className={[
                              "segment-input",
                              segment.reviewRequired ? "flagged" : "",
                              segment.crossedOut ? "crossed-out" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            title={titleParts.length ? titleParts.join(" — ") : undefined}
                            value={segment.text}
                            onChange={(e) => {
                              updateSegment(page.id, segment.id, e.target.value);
                              autoGrow(e.currentTarget);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.preventDefault();
                            }}
                            onFocus={() => handleSegmentFocus(segment.id, page.id)}
                            onBlur={handleSegmentBlur}
                          />
                        );
                      })}
                    </p>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}

      {hasAnyReadyPage && (
        <>
          <div className="title-row">
            <input
              className="field"
              placeholder="Untitled note"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {titleIsAiSuggested && title.trim() && (
              <span className="tag-ai-label title-ai-label" title="Suggested automatically - edit to make it yours">
                AI
              </span>
            )}
          </div>
          {titleIsAiSuggested && title.trim() && (
            <p className="muted">
              This title was suggested automatically - edit it above, or save to keep it.
            </p>
          )}

          <div className="organize-row">
            <label className="muted" htmlFor="folder-select">
              Folder:
            </label>
            <select
              id="folder-select"
              className="field folder-select"
              value={folderId ?? ""}
              onChange={(e) => {
                setFolderId(e.target.value || null);
                setSavedMessage(null);
              }}
            >
              <option value="">No folder</option>
              {allFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="tags-editor">
            {tags.map((t) => (
              <span key={t.id} className={`tag-chip${t.source === "ai" ? " ai-suggested" : ""}`}>
                {t.name}
                {t.source === "ai" && <span className="tag-ai-label">AI</span>}
                <button
                  type="button"
                  className="tag-remove"
                  aria-label={`Remove tag ${t.name}`}
                  onClick={() => removeTag(t.id)}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className="tag-input"
              list="tag-suggestions"
              placeholder="Add a tag…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag(tagInput);
                }
              }}
            />
            <datalist id="tag-suggestions">
              {allTagNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
          {tags.some((t) => t.source === "ai") && (
            <p className="muted">
              Tags marked <span className="tag-ai-label">AI</span> were suggested automatically -
              remove any that don&apos;t fit, or just save to keep them.
            </p>
          )}

          {flaggedCount > 0 && (
            <p className="muted">
              {flaggedCount} item{flaggedCount === 1 ? "" : "s"} still flagged for review - you
              can save without resolving them.
            </p>
          )}
          {crossedOutCount > 0 && (
            <p className="muted">
              <span className="crossed-out-sample">abc</span> {crossedOutCount} word
              {crossedOutCount === 1 ? "" : "s"} shown with a strikethrough were crossed out in the
              original - kept for reference, but feel free to delete them if you don&apos;t want them
              in the note.
            </p>
          )}

          <div className="note-actions">
            <button className="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            {googleConfigured &&
              (googleConnected ? (
                <button
                  className="button secondary"
                  onClick={handleExportToGoogle}
                  disabled={exportingToGoogle}
                >
                  {exportingToGoogle
                    ? "Exporting..."
                    : googleDocUrl
                      ? "Re-export to Google Docs"
                      : "Export to Google Docs"}
                </button>
              ) : (
                <a className="button secondary" href="/api/integrations/google/connect">
                  Connect Google Docs to export
                </a>
              ))}
            {googleDocUrl && (
              <a href={googleDocUrl} target="_blank" rel="noopener noreferrer">
                Open in Google Docs
              </a>
            )}
          </div>
          {googleExportError && (
            <p className="toast error" role="alert">
              ⚠ {googleExportError}
            </p>
          )}
        </>
      )}

      {savedMessage && (
        <p className="toast success" role="status">
          ✓ {savedMessage}
        </p>
      )}
      {errorMessage && (
        <p className="toast error" role="alert">
          ⚠ {errorMessage}
        </p>
      )}

      <div className="danger-zone">
        <button className="button danger" onClick={handleDelete} disabled={deleting}>
          {deleting ? "Moving to Trash…" : "Move to Trash"}
        </button>
        <span className="muted danger-zone-hint">Recoverable from Trash in the Library sidebar.</span>
      </div>
    </div>
  );
}
