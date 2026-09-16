// GRID_COLS/GRID_ROWS live in their own module, separate from gridOverlay.ts,
// specifically so a client component (e.g. ReviewEditor.tsx, for its
// zoom-on-focus feature - see verticalCrop() there) can import just these two
// numbers without pulling in gridOverlay.ts's `sharp` dependency, which is a
// server-only native module and breaks the client bundle if it ends up in it.
// gridOverlay.ts re-exports both names from here, so nothing else needs to
// change which module it imports them from.
export const GRID_COLS = 6;
export const GRID_ROWS = 12;
