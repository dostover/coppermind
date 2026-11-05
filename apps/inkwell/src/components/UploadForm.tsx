"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { extractErrorMessage } from "@/lib/fetchError";
import { formatTakenAt, orderBatch, readCaptureTime, type BatchOrder } from "@/lib/photoOrder";

// Multi-page notes (FR-2.3/FR-2.4): the user can select several page images
// (or a PDF, whose own pages are expanded server-side - see
// api/notes/upload/route.ts's preparePages) at once, or add more in a
// follow-up selection - the file input stays available after a pick - see
// them listed in the order they'll be saved as pages, remove one before
// uploading, and reorder with simple up/down moves rather than a full drag
// gesture - lighter to build and just as effective for "put page 3 before
// page 2," which is the actual need (03-ux-screens.md's full
// filmstrip-with-drag is the fuller version of this same interaction).
//
// Each pick is put in a sensible starting order (2026-11-05) - by when each
// photo was taken, or by file name - since "select all" in a folder hands
// files over in whatever order the OS chooses. See lib/photoOrder.ts. Each
// pick is ordered on its own and appended, so adding more files never
// reshuffles an order the user has already adjusted by hand.
interface PickedItem {
  key: string;
  file: File;
  takenAt: number | null;
  thumbUrl: string | null;
}

let nextItemKey = 0;

export function UploadForm() {
  const router = useRouter();
  const inputId = useId();
  const [items, setItems] = useState<PickedItem[]>([]);
  const [readingFiles, setReadingFiles] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ order: BatchOrder; count: number } | null>(null);
  const thumbUrlsRef = useRef<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Takes a plain File[] rather than the FileList straight off the input.
  // input.files is a *live* view tied to the DOM element - reading it later
  // (including from inside a React state updater, which can run after this
  // handler returns) reflects whatever the input holds *then*, not what it
  // held when onChange fired. The caller below resets the input's value
  // right after calling this (so the same file can be picked again / more
  // added right after), which clears that live FileList to empty - so by
  // the time a deferred `Array.from(newFiles)` ran, it was reading an
  // already-emptied list and silently contributing nothing. Converting to
  // a plain array immediately, before the reset, fixes it regardless of
  // when React actually processes the state update.
  async function addFiles(newFiles: File[]) {
    if (newFiles.length === 0) return;
    setReadingFiles(true);
    const picked = await Promise.all(
      newFiles.map(async (file): Promise<PickedItem> => {
        const thumbUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        if (thumbUrl) thumbUrlsRef.current.add(thumbUrl);
        return { key: `item-${nextItemKey++}`, file, takenAt: await readCaptureTime(file), thumbUrl };
      })
    );
    const { items: ordered, order } = orderBatch(picked);
    setItems((prev) => [...prev, ...ordered]);
    setLastOrder(ordered.length > 1 ? { order, count: ordered.length } : null);
    setReadingFiles(false);
  }

  // Thumbnails are object URLs - released when an item is removed, and all
  // at once when leaving the page.
  useEffect(() => {
    const urls = thumbUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    };
  }, []);

  function removeFile(index: number) {
    const removed = items[index];
    if (removed?.thumbUrl) {
      URL.revokeObjectURL(removed.thumbUrl);
      thumbUrlsRef.current.delete(removed.thumbUrl);
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function moveFile(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    for (const { file } of items) formData.append("images", file);

    try {
      const res = await fetch("/api/notes/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error(await extractErrorMessage(res, "Upload failed."));
      const data = await res.json();
      router.push(`/notes/${data.id}`);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <label htmlFor={inputId}>
        Handwritten page image(s) (JPEG, PNG, or WebP) or a PDF - select multiple, or add more
        below, to capture a multi-page note as one entry. A PDF&apos;s own pages are all included,
        in order, wherever it sits in the list below.
      </label>
      <input
        id={inputId}
        className="field"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        // On a phone/tablet with a camera, "capture" is what puts the
        // camera itself (not just the photo library) at the top of the
        // options a tap on this input offers - the mobile-first "camera
        // viewfinder as default entry point" from 03-ux-screens.md §3,
        // without needing getUserMedia/a custom viewfinder to get there.
        // Desktop browsers simply ignore the attribute.
        capture="environment"
        multiple
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []));
          e.target.value = ""; // allow picking the same file again / adding more right after
        }}
        style={{ margin: "0.75rem 0" }}
      />

      {lastOrder && (
        <p className="muted upload-order-note" role="status">
          {lastOrder.order === "taken"
            ? `Sorted the ${lastOrder.count} files you picked by when each photo was taken.`
            : `Sorted the ${lastOrder.count} files you picked by file name, since they don't all record when they were taken.`}{" "}
          Check the order below and use ↑ ↓ to fix anything - you can also reorder pages after
          they&apos;re transcribed.
        </p>
      )}

      {items.length > 0 && (
        <ul className="page-filmstrip">
          {/* Labeled by position among picked items, not a final page
              number: a PDF here contributes all of its own pages, in order,
              at this spot - so anything picked after it may land at a
              different page number than its position in this list suggests.
              Reordering/removing still operates on whole items (a PDF moves
              or drops as one unit, its internal page order intact). */}
          {items.map(({ key, file, takenAt, thumbUrl }, i) => (
            <li key={key} className="page-filmstrip-item">
              <span className="muted page-filmstrip-position">
                {file.type === "application/pdf" ? "PDF" : `Item ${i + 1}`}
              </span>
              {thumbUrl ? (
                // A local object URL for a file not yet uploaded - nothing for
                // next/image to optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="page-filmstrip-thumb" src={thumbUrl} alt="" />
              ) : (
                <span className="page-filmstrip-thumb page-filmstrip-thumb-empty" aria-hidden="true">
                  {file.type === "application/pdf" ? "PDF" : ""}
                </span>
              )}
              <span className="page-filmstrip-name">
                {file.name}
                {takenAt !== null && (
                  <span className="muted page-filmstrip-taken">Taken {formatTakenAt(takenAt)}</span>
                )}
              </span>
              <button
                type="button"
                className="button secondary"
                onClick={() => moveFile(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${file.name} earlier`}
              >
                ↑
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => moveFile(i, 1)}
                disabled={i === items.length - 1}
                aria-label={`Move ${file.name} later`}
              >
                ↓
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => removeFile(i)}
                aria-label={`Remove ${file.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        className="button"
        type="submit"
        disabled={items.length === 0 || readingFiles || status === "uploading"}
      >
        {status === "uploading"
          ? "Uploading..."
          : items.length > 1
            ? `Upload ${items.length} items as one note`
            : "Upload & Transcribe"}
      </button>
      {status === "error" && (
        <p className="toast error" role="alert">
          ⚠ {error} The original upload is safe - you can retry from this page.
        </p>
      )}
    </form>
  );
}
