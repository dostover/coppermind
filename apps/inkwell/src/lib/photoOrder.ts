// Upload ordering (2026-11-05): picking a whole folder of photos hands files
// over in whatever order the OS file picker chooses - usually by file name,
// sometimes by click order - which often isn't the order the pages were
// written in. Each batch of picked files is ordered by when each photo was
// taken (the camera's EXIF timestamp) when every file in the batch has one,
// and otherwise by file name with numbers compared as numbers ("IMG_9" before
// "IMG_10"). Mixing the two in one batch would interleave two unrelated
// orderings, so a batch is one or the other, never both.
//
// Client-side only, no dependencies: reads just the start of each JPEG,
// where EXIF lives.

export type BatchOrder = "taken" | "name";

const EXIF_SCAN_BYTES = 256 * 1024;

const nameCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function compareFileNames(a: string, b: string): number {
  return nameCollator.compare(a, b);
}

/** Capture time from a JPEG's EXIF block, as a ms timestamp of the camera's
 *  own clock read as if it were UTC (EXIF stores no time zone - fine for
 *  ordering, and displayed back with timeZone: "UTC" so it reads as the
 *  camera's local time). null for anything else, or no usable timestamp. */
export async function readCaptureTime(file: File): Promise<number | null> {
  if (file.type !== "image/jpeg") return null;
  try {
    return parseExifCaptureTime(await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer());
  } catch {
    return null;
  }
}

export function parseExifCaptureTime(buffer: ArrayBuffer): number | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset);
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return null; // bad marker / image data reached
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && isExifHeader(view, offset + 4)) {
      return parseTiff(view, offset + 10);
    }
    offset += 2 + size;
  }
  return null;
}

function isExifHeader(view: DataView, at: number): boolean {
  if (at + 6 > view.byteLength) return false;
  // "Exif\0\0"
  return view.getUint32(at) === 0x45786966 && view.getUint16(at + 4) === 0;
}

const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_SUBSEC_ORIGINAL = 0x9291;

interface IfdEntry {
  type: number;
  count: number;
  valueAt: number; // absolute offset of the value (inline or pointed-to)
}

function parseTiff(view: DataView, tiff: number): number | null {
  if (tiff + 8 > view.byteLength) return null;
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const le = order === 0x4949;
  if (view.getUint16(tiff + 2, le) !== 42) return null;

  const readIfd = (relOffset: number): Map<number, IfdEntry> => {
    const entries = new Map<number, IfdEntry>();
    const start = tiff + relOffset;
    if (start + 2 > view.byteLength) return entries;
    const count = view.getUint16(start, le);
    for (let i = 0; i < count; i++) {
      const e = start + 2 + i * 12;
      if (e + 12 > view.byteLength) break;
      const type = view.getUint16(e + 2, le);
      const n = view.getUint32(e + 4, le);
      const byteSize = type === 2 || type === 1 || type === 7 ? n : type === 3 ? n * 2 : n * 4;
      const valueAt = byteSize <= 4 ? e + 8 : tiff + view.getUint32(e + 8, le);
      entries.set(view.getUint16(e, le), { type, count: n, valueAt });
    }
    return entries;
  };

  const readAscii = (entry: IfdEntry | undefined): string | null => {
    if (!entry || entry.type !== 2 || entry.valueAt + entry.count > view.byteLength) return null;
    let s = "";
    for (let i = 0; i < entry.count; i++) {
      const c = view.getUint8(entry.valueAt + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  };

  const ifd0 = readIfd(view.getUint32(tiff + 4, le));
  const exifPointer = ifd0.get(TAG_EXIF_IFD);
  const exif = exifPointer ? readIfd(view.getUint32(exifPointer.valueAt, le)) : new Map<number, IfdEntry>();

  const stamp =
    parseExifDate(readAscii(exif.get(TAG_DATETIME_ORIGINAL))) ??
    parseExifDate(readAscii(exif.get(TAG_DATETIME_DIGITIZED))) ??
    parseExifDate(readAscii(ifd0.get(TAG_DATETIME)));
  if (stamp === null) return null;

  // Burst shots share a whole second - sub-seconds keep them in order.
  const subsec = readAscii(exif.get(TAG_SUBSEC_ORIGINAL))?.trim();
  const ms = subsec && /^\d+$/.test(subsec) ? Math.round(Number(`0.${subsec}`) * 1000) : 0;
  return stamp + ms;
}

// "2026:11:03 20:14:05" -> ms. Cameras write "0000:00:00 00:00:00" (or
// blanks) when the clock was never set - treated as no timestamp.
function parseExifDate(value: string | null): number | null {
  const m = value?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
  if (y < 1970 || mo < 1 || mo > 12 || d < 1) return null;
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

/** Orders one batch of picked files - see the comment at the top. */
export function orderBatch<T extends { file: File; takenAt: number | null }>(
  items: T[]
): { items: T[]; order: BatchOrder } {
  const byName = (a: T, b: T) => compareFileNames(a.file.name, b.file.name);
  if (items.length > 0 && items.every((i) => i.takenAt !== null)) {
    return {
      items: [...items].sort((a, b) => a.takenAt! - b.takenAt! || byName(a, b)),
      order: "taken",
    };
  }
  return { items: [...items].sort(byName), order: "name" };
}

export function formatTakenAt(takenAt: number): string {
  return new Date(takenAt).toLocaleString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
