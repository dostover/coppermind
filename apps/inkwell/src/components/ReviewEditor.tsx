"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GRID_ROWS } from "@/lib/ai/gridConstants";
import type { SourceRegion, StructureType, TranscriptSegment } from "@/lib/ai/types";
import type { FolderRow, NotePage, NoteTagView } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";

// How many extra lines of context to show above and below the focused line
// in the pop-out zoom's close-up (see verticalCrop() and popoutVisible
// below). 2026-09-16: this constant, and verticalCrop() itself, originally
// belonged to an in-page "zoom the review columns" feature (PRs #32-#34 -
// see git history to revive that approach if it's ever wanted again); this
// file dropped that approach in favor of the pop-out overlay below, but
// kept both, since the pop-out's close-up needs exactly the same "focused
// line plus N lines of context" crop.
const ZOOM_CONTEXT_LINES = 2;

// Turns a segment's already-computed source region (see gridOverlay.ts's
// regionFromCells - this reuses the exact geometry the .region-highlight box
// already draws, so this needs no new AI call, no schema change, and no
// added per-transcription cost) into a vertical crop for the pop-out's
// close-up: the focused line plus ZOOM_CONTEXT_LINES lines of context above
// and below, expressed as a fraction of the photo's height ("line height" is
// approximated as one gridOverlay.ts grid row, GRID_ROWS - the grid was
// already sized so its rows roughly track handwriting lines).
//
// Deliberately never crops horizontally - full line width, every time - so
// a full-width line is never cut off at the edges. The pop-out's own width
// (see .zoom-popout in globals.css) is what actually makes the close-up
// look "zoomed": the cropped photo is rendered at up to 1100px wide,
// however narrow the original in-page column is, with no distortion since
// the <img> stays at width: 100%/height: auto throughout - only the crop
// window (via aspect-ratio + overflow: hidden on .zoom-popout-image-wrap)
// picks which band of the now much-larger image is visible.
function verticalCrop(region: SourceRegion | undefined): { lineFraction: number; offsetY: number } {
  if (!region) return { lineFraction: 1, offsetY: 0 };
  const [, y, , h] = region.bbox;
  const lineHeight = Math.max(h, 1 / GRID_ROWS);
  const lineFraction = Math.min(1, lineHeight * (1 + 2 * ZOOM_CONTEXT_LINES));
  const center = y + h / 2;
  const offsetY = Math.min(Math.max(center - lineFraction / 2, 0), 1 - lineFraction);
  return { lineFraction, offsetY };
}

// The "core four" structure types the review screen offers a reclassify
// control for (2026-09-16 decision - dialogue and table_cell exist in the
// data model and are still rendered without crashing, just as a plain
// paragraph, but aren't offered here: table layout in particular needs
// meaningfully more UI than a dropdown, and both are rare in practice).
const CORE_STRUCTURE_TYPES: { value: StructureType; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "heading", label: "Heading" },
  { value: "list_item", label: "Bulleted list item" },
  { value: "numbered_item", label: "Numbered list item" },
];

// What a line renders as. Only heading/list_item/numbered_item get their own
// treatment; every other structureType (paragraph, line, dialogue,
// table_cell) falls back to a plain flowing paragraph - see
// CORE_STRUCTURE_TYPES above.
type LineKind = "heading" | "list_item" | "numbered_item" | "paragraph";

function lineKindFor(structureType: StructureType): LineKind {
  if (structureType === "heading" || structureType === "list_item" || structureType === "numbered_item") {
    return structureType;
  }
  return "paragraph";
}

// The value the reclassify dropdown shows for a line whose structureType
// isn't one of the four it offers (dialogue/table_cell/line) - "Paragraph"
// matches how it's actually rendered (see lineKindFor), so the dropdown
// never shows a value that isn't one of its own options.
function reclassifyValue(structureType: StructureType): StructureType {
  return CORE_STRUCTURE_TYPES.some((t) => t.value === structureType) ? structureType : "paragraph";
}

interface Line {
  kind: LineKind;
  segments: TranscriptSegment[];
}

// Groups a page's flat segment list into lines: a new line starts whenever a
// segment has startsNewBlock set (or it's the very first segment on the
// page); otherwise it's a continuation of whatever line came before it,
// regardless of its own structureType - see TranscriptSegment.startsNewBlock's
// doc comment for why a continuation segment (e.g. a low-confidence word
// pulled out of the middle of a sentence) always belongs to the previous
// line rather than starting a new one just because it's a separate segment.
function toLines(segments: TranscriptSegment[]): Line[] {
  const lines: Line[] = [];
  segments.forEach((segment, i) => {
    const last = lines[lines.length - 1];
    if (i === 0 || segment.startsNewBlock || !last) {
      lines.push({ kind: lineKindFor(segment.structureType), segments: [segment] });
    } else {
      last.segments.push(segment);
    }
  });
  return lines;
}

type Block =
  | { kind: "heading"; line: Line }
  | { kind: "list"; ordered: boolean; items: Line[] }
  | { kind: "paragraph"; line: Line };

// Groups adjacent same-type list lines into one shared <ul>/<ol> - three
// consecutive bulleted items should render as one list of three, not three
// separate one-item lists.
function toBlocks(lines: Line[]): Block[] {
  const blocks: Block[] = [];
  for (const line of lines) {
    const last = blocks[blocks.length - 1];
    if (line.kind === "heading") {
      blocks.push({ kind: "heading", line });
    } else if (line.kind === "list_item" || line.kind === "numbered_item") {
      const ordered = line.kind === "numbered_item";
      if (last && last.kind === "list" && last.ordered === ordered) {
        last.items.push(line);
      } else {
        blocks.push({ kind: "list", ordered, items: [line] });
      }
    } else {
      blocks.push({ kind: "paragraph", line });
    }
  }
  return blocks;
}

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
  transcriptionRemoved: boolean;
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
    transcriptionRemoved: p.transcriptionRemoved,
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
  const [deletingTranscriptionPageIds, setDeletingTranscriptionPageIds] = useState<Set<string>>(
    new Set()
  );
  const [deleting, setDeleting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Which segment's source handwriting to highlight on the page image -
  // whatever segment textarea currently has focus, cleared on blur. See
  // src/lib/ai/gridOverlay.ts for how sourceRegion is derived.
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  function handleSegmentFocus(segmentId: string) {
    setActiveSegmentId(segmentId);
  }
  function handleSegmentBlur() {
    setActiveSegmentId(null);
  }

  // Pop-out zoom (2026-09-16, replacing the in-page zoom-on-focus this
  // screen previously used - "I don't think this is quite what I want").
  // Originally opened on plain focus, same as the highlight above - but
  // that meant *every* click into a segment opened it, with no way to just
  // click in to edit (2026-09-16 follow-up bug report). A double-click is
  // now its own, deliberate trigger, independent of activeSegmentId/focus
  // entirely: a single click only ever places the cursor and edits, same
  // as any plain text field, and this only opens on the second click of a
  // double-click. Because a plain click can no longer open it, this is a
  // real modal again (backdrop/click-anywhere-closes, see the JSX below) -
  // it doesn't need the earlier pointer-events: none workaround that let
  // clicks fall through to the text underneath, since there's no longer
  // any everyday click for it to conflict with.
  const [popoutSegmentId, setPopoutSegmentId] = useState<string | null>(null);
  function handleSegmentDoubleClick(segmentId: string) {
    setPopoutSegmentId(segmentId);
  }

  // The zoom-on-focus crop (see verticalCrop() above) needs to shrink each
  // page's image wrapper to a fraction of its normal height without
  // distorting it - which needs the photo's own natural aspect ratio, not
  // just its on-screen rendered size. Captured once per page from the <img>
  // itself the moment it finishes loading.
  const [imgAspects, setImgAspects] = useState<Record<string, number>>({});
  function handleImageLoad(pageId: string, el: HTMLImageElement) {
    if (!el.naturalWidth || !el.naturalHeight) return;
    const aspect = el.naturalWidth / el.naturalHeight;
    // Bail out (return the *same* prev object) once this page's aspect is
    // already recorded. The <img>'s ref callback below runs on every render
    // (it's an inline arrow function, so React treats it as a new ref each
    // time), not just on first mount - without this guard, each render's
    // call would set a *new* object into state, which is itself a change
    // that triggers another render, which calls the new ref again... an
    // infinite loop (surfaced as React error #185, "Maximum update depth
    // exceeded") rather than the intended "record it once" behavior.
    setImgAspects((prev) => (prev[pageId] === aspect ? prev : { ...prev, [pageId]: aspect }));
  }

  // Escape also dismisses the pop-out, alongside the click-anywhere/close
  // button handling in the JSX below - a real listener (not a JSX
  // onKeyDown) since the pop-out itself holds no focus for a key event to
  // land on; the focused element stays whichever segment textarea opened
  // it (double-clicking to open one doesn't blur it), wherever that is in
  // the DOM.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoutSegmentId(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const popoutPage = pageStates.find((p) => p.segments.some((s) => s.id === popoutSegmentId));
  const popoutRegion = popoutPage?.segments.find((s) => s.id === popoutSegmentId)?.sourceRegion;
  const popoutAspect = popoutPage ? imgAspects[popoutPage.id] : undefined;
  const popoutVisible = Boolean(
    popoutPage && popoutRegion && popoutAspect && !popoutPage.imageRemoved && popoutPage.imagePath
  );
  const popoutCrop = popoutVisible ? verticalCrop(popoutRegion) : { lineFraction: 1, offsetY: 0 };

  // AI-trust visual language (03-ux-screens.md's cross-screen note), extended
  // from tags to the title: shows the same "AI suggested this" badge only
  // while the title is both server-recorded as AI-derived AND still exactly
  // what's on screen - the instant the user types something different, this
  // goes false immediately (same "the flag clears the moment you edit"
  // feedback the transcription segments already give), well before Save.
  const titleIsAiSuggested = initialTitleSource === "ai" && title.trim() === (initialTitle ?? "").trim();

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

  // Per-page "seed once" sync: a page whose local status isn't yet
  // 'ready_for_review' adopts whatever the latest data says (still working,
  // now ready, or now errored). The moment a page reaches 'ready_for_review'
  // locally, it's marked seeded and future syncs stop touching it, so a
  // later poll (from some *other* page still working) can never overwrite
  // edits already in progress on this one.
  //
  // The set-membership check/update used to live *inside* the setPageStates
  // updater below (mutating seededPagesRef.current as a side effect of
  // computing the next state). That's an impure updater, and it broke
  // exactly the way impure updaters do: React (in development) invokes a
  // state updater function twice to surface exactly this kind of bug - once
  // to check, once for real - and reuses whichever call ran last. The first
  // call's mutation marked the page "already seeded" *before* the second,
  // official call ran, so the second call saw nothing left to do and handed
  // back the untouched previous state. The visible symptom: the network
  // request came back with "ready_for_review", the updater clearly received
  // it (confirmed by logging), and the screen still never left "Transcribing"
  // without a hard reload - production never double-invokes, so this exact
  // sequence never happened there, which is what made it look like a
  // dev-only Next.js quirk rather than an app bug. Fix: read+decide what to
  // seed *before* calling setPageStates (a plain, non-reentrant read), keep
  // the updater itself a pure function of (prev, incoming), and only mutate
  // the ref once that decision is made - never inside the updater.
  const seededPagesRef = useRef<Set<string>>(
    new Set(pages.filter((p) => p.status === "ready_for_review").map((p) => p.id))
  );
  function applyIncomingPages(incoming: NotePage[]) {
    const unseeded = incoming.filter((page) => !seededPagesRef.current.has(page.id));
    if (unseeded.length === 0) return;

    setPageStates((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      for (const page of unseeded) byId.set(page.id, toPageState(page));
      // Preserve page order (byId may have inserted in prop order already,
      // but incoming is always sorted by page_number - safe to re-derive).
      return incoming.map((p) => byId.get(p.id) ?? toPageState(p));
    });

    for (const page of unseeded) {
      if (page.status === "ready_for_review") seededPagesRef.current.add(page.id);
    }
  }

  useEffect(() => {
    applyIncomingPages(pages);
  }, [pages]);

  // Async processing (see src/lib/jobs.ts): upload/retry now enqueue a job
  // per page and return immediately, so this screen has to poll rather than
  // assume every page is done by the time it renders. Polling re-fetches the
  // server component via router.refresh(), which re-renders this component
  // with a fresh `pages` prop - the effect above re-runs on that prop change
  // and applies it through the same seed-merge, and this effect stops itself
  // once no page is still uploaded/transcribing.
  useEffect(() => {
    if (!anyPageWorking) return;
    const interval = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(interval);
  }, [anyPageWorking, router]);

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
              segments: p.segments.map((s) => ({ id: s.id, text: s.text, structureType: s.structureType })),
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

  // "Delete transcription only" - the mirror of handleDeleteImage above:
  // keeps the photo and just discards the transcribed text, irreversibly.
  // Clears segments locally too (not just transcriptionRemoved), so an
  // already-open textarea for this page doesn't keep showing text that's
  // gone server-side - and so a later Save has nothing stale to send for
  // this page (the server independently guards against this anyway, see
  // delete-transcription/route.ts's doc comment).
  async function handleDeleteTranscription(pageId: string) {
    const ok = window.confirm(
      "Delete this page's transcription? The photo stays, but the transcribed text can't be recovered afterward."
    );
    if (!ok) return;

    setDeletingTranscriptionPageIds((prev) => new Set(prev).add(pageId));
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/notes/${noteId}/pages/${pageId}/delete-transcription`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't delete the transcription.");
      setPageStates((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, transcriptionRemoved: true, segments: [] } : p))
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Couldn't delete the transcription.");
    } finally {
      setDeletingTranscriptionPageIds((prev) => {
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

  // Reclassify (2026-09-16): changing what a line renders as. Applies the
  // new structureType to every segment in the line, not just its first, so
  // the stored data stays consistent with what's displayed - a line's
  // segments should all agree on what kind of line they're part of.
  function updateLineStructureType(pageId: string, segmentIds: string[], structureType: StructureType) {
    setPageStates((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              segments: p.segments.map((s) =>
                segmentIds.includes(s.id) ? { ...s, structureType } : s
              ),
            }
          : p
      )
    );
    setSavedMessage(null);
  }

  // Renders one line's segments as the same individually-editable, auto-
  // growing textareas regardless of what kind of line they're in (heading,
  // paragraph, or a single list item) - only the wrapper element differs.
  function renderLineSegments(pageId: string, segments: TranscriptSegment[]) {
    return segments.map((segment) => {
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
            updateSegment(pageId, segment.id, e.target.value);
            autoGrow(e.currentTarget);
          }}
          onFocus={() => handleSegmentFocus(segment.id)}
          onBlur={handleSegmentBlur}
          onDoubleClick={() => handleSegmentDoubleClick(segment.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
        />
      );
    });
  }

  // The small "what kind of line is this" dropdown shown next to every
  // heading/paragraph/list item - reclassifies the whole line at once (see
  // updateLineStructureType above).
  function renderTypeSelect(pageId: string, line: Line) {
    return (
      <select
        className="line-type-select"
        aria-label="Change this line's formatting"
        value={reclassifyValue(line.segments[0].structureType)}
        onChange={(e) =>
          updateLineStructureType(
            pageId,
            line.segments.map((s) => s.id),
            e.target.value as StructureType
          )
        }
      >
        {CORE_STRUCTURE_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div>
      {pageStates.map((page) => {
        const blocks = toBlocks(toLines(page.segments));
        const isRetrying = retryingPageIds.has(page.id);
        const activeRegion = page.segments.find((s) => s.id === activeSegmentId)?.sourceRegion;
        return (
          <div key={page.id} className="note-page-block">
            {pageStates.length > 1 && (
              <p className="muted note-page-label">
                Page {page.pageNumber} of {pageStates.length}
              </p>
            )}

            <div className="note-page-columns">
              <div className="note-page-image">
                <div className="note-image-wrap">
                  {page.imageRemoved ? (
                    // Original removed via "Delete original image" - the
                    // transcription alongside is unaffected, this just
                    // replaces the broken/missing <img> with an honest
                    // placeholder (03-ux-screens.md §6's "clear ... state
                    // rather than a broken image or blank area").
                    <div className="image-removed-placeholder">
                      <p className="muted" style={{ margin: 0 }}>
                        Original photo deleted. The transcription is unaffected.
                      </p>
                    </div>
                  ) : !page.imagePath ? (
                    // A page created from an uploaded PDF starts with no
                    // image at all - it's rendered out of the PDF in the
                    // background (jobs.ts's rasterize_pdf stage) rather than
                    // during the upload itself, so this note may sit here
                    // for a few seconds on a large scan. Same visual pattern
                    // as the "original deleted" placeholder above, different
                    // copy - this is a normal in-progress state, not an
                    // error, and this page's status ('uploaded') keeps the
                    // existing polling loop refreshing until it resolves.
                    <div className="image-removed-placeholder">
                      <p className="muted" style={{ margin: 0 }}>
                        Extracting this page from your PDF…
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Opens the original photo at full native resolution
                          in a new tab - the in-page copy is now sized to be
                          legible on its own (see globals.css), but a
                          genuinely hard word may still need a closer look
                          than any fixed on-page size can give. */}
                      <a
                        href={`/${page.imagePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="note-image-link"
                        title="Open full-size in a new tab"
                      >
                        <img
                          src={`/${page.imagePath}`}
                          alt="Uploaded handwritten page"
                          className="note-image"
                          // Both a ref callback and onLoad: a cached image
                          // can finish loading (and fire its native `load`
                          // event) before React ever attaches the onLoad
                          // listener, so relying on onLoad alone silently
                          // never captures the aspect ratio - and therefore
                          // never zooms - on a repeat visit to an already-
                          // cached photo. The ref callback catches that case
                          // via el.complete; onLoad still covers a fresh,
                          // not-yet-loaded image normally.
                          ref={(el) => {
                            if (el && el.complete && el.naturalWidth) handleImageLoad(page.id, el);
                          }}
                          onLoad={(e) => handleImageLoad(page.id, e.currentTarget)}
                        />
                      </a>
                      {activeRegion && (
                        <div
                          className="region-highlight"
                          style={{
                            left: `${activeRegion.bbox[0] * 100}%`,
                            width: `${activeRegion.bbox[2] * 100}%`,
                            top: `${activeRegion.bbox[1] * 100}%`,
                            height: `${activeRegion.bbox[3] * 100}%`,
                          }}
                        />
                      )}
                    </>
                  )}
                </div>

                {page.status === "ready_for_review" && !page.imageRemoved && (
                  <button
                    type="button"
                    className="button secondary delete-image-button"
                    onClick={() => handleDeleteImage(page.id)}
                    disabled={deletingImagePageIds.has(page.id)}
                  >
                    {deletingImagePageIds.has(page.id) ? "Deleting…" : "Delete original image"}
                  </button>
                )}
              </div>

              <div className="note-page-text">
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

                {page.status === "ready_for_review" && page.transcriptionRemoved && (
                  // Transcription removed via "Delete transcription" - the
                  // photo alongside is unaffected, this just replaces the
                  // segment editor with an honest placeholder, same pattern
                  // as the image-removed placeholder above.
                  <div className="image-removed-placeholder">
                    <p className="muted" style={{ margin: 0 }}>
                      Transcription deleted. The original photo is unaffected.
                    </p>
                  </div>
                )}

                {page.status === "ready_for_review" && !page.transcriptionRemoved && (
                  <div className="transcription">
                    {blocks.map((block) => {
                      if (block.kind === "heading") {
                        return (
                          <div key={block.line.segments[0].id} className="structure-line">
                            {renderTypeSelect(page.id, block.line)}
                            <h2 className="segment-heading">
                              {renderLineSegments(page.id, block.line.segments)}
                            </h2>
                          </div>
                        );
                      }
                      if (block.kind === "list") {
                        const ListTag = block.ordered ? "ol" : "ul";
                        return (
                          <ListTag key={block.items[0].segments[0].id} className="segment-list">
                            {block.items.map((line) => (
                              <li key={line.segments[0].id}>
                                {/* The flex row lives on this inner div, not
                                    the <li> itself - display: flex on an
                                    <li> suppresses its own bullet/number
                                    marker (display: list-item stops
                                    applying), which silently produced a
                                    marker-less list the first time this
                                    shipped. */}
                                <div className="list-item-line">
                                  {renderTypeSelect(page.id, line)}
                                  <div className="flow">{renderLineSegments(page.id, line.segments)}</div>
                                </div>
                              </li>
                            ))}
                          </ListTag>
                        );
                      }
                      return (
                        <div key={block.line.segments[0].id} className="structure-line">
                          {renderTypeSelect(page.id, block.line)}
                          <p className="flow">{renderLineSegments(page.id, block.line.segments)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {page.status === "ready_for_review" && !page.transcriptionRemoved && (
                  <button
                    type="button"
                    className="button secondary delete-transcription-button"
                    onClick={() => handleDeleteTranscription(page.id)}
                    disabled={deletingTranscriptionPageIds.has(page.id)}
                  >
                    {deletingTranscriptionPageIds.has(page.id) ? "Deleting…" : "Delete transcription"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {popoutVisible && popoutPage && popoutRegion && (
        // A real modal again (2026-09-16: now that opening it is a
        // deliberate double-click - see handleSegmentDoubleClick above -
        // rather than plain focus, there's no everyday single click left
        // for a blocking backdrop to conflict with). Clicking anywhere
        // here - the backdrop or the close-up image itself - closes it,
        // same as the close button or Escape; nothing needs its own
        // stopPropagation guard since every one of them does the same
        // thing.
        <div className="zoom-popout-backdrop" onClick={() => setPopoutSegmentId(null)}>
          <div className="zoom-popout">
            <button type="button" className="zoom-popout-close" aria-label="Close close-up" onClick={() => setPopoutSegmentId(null)}>
              ×
            </button>
            <div
              className="zoom-popout-image-wrap"
              style={{ aspectRatio: `${popoutAspect! / popoutCrop.lineFraction}` }}
            >
              <img
                src={`/${popoutPage.imagePath}`}
                alt="Close-up of the highlighted handwriting"
                className="zoom-popout-image"
                style={{ transform: `translateY(-${popoutCrop.offsetY * 100}%)` }}
              />
              <div
                className="region-highlight"
                style={{
                  // Full width rather than the AI-detected bbox's own left/
                  // width (2026-09-16 feedback: "the width seems a bit off
                  // ... expanded to fit the whole image"). The bbox's
                  // horizontal extent comes from gridOverlay.ts's grid-cell
                  // classification, which is naturally coarser sideways
                  // than the vertical crop math here (a deliberate,
                  // separate approximation - see verticalCrop()'s own
                  // comment) - close enough for the small inline highlight,
                  // but visibly noticeable blown up to pop-out size. The
                  // pop-out's crop is already always full photo width (see
                  // verticalCrop() - it never crops horizontally), so
                  // matching the highlight to that width instead just
                  // means "the whole visible line," not a wider guess.
                  left: 0,
                  width: "100%",
                  top: `${((popoutRegion.bbox[1] - popoutCrop.offsetY) / popoutCrop.lineFraction) * 100}%`,
                  height: `${(popoutRegion.bbox[3] / popoutCrop.lineFraction) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

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
