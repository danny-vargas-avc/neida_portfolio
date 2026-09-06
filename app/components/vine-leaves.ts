/**
 * Where each leaf sits on Neida's vine drawing.
 *
 * The artwork is a traced scan: 176 filled paths with no groups or ids, and the
 * leaves are fused to the vine in the same connected outlines, so a leaf cannot
 * be picked out by selecting paths. Instead each leaf gets an ellipse in
 * viewBox coordinates, used for three things at once:
 *
 *   - the clickable/focusable hit area
 *   - the clip region that tints just that leaf in its accent colour
 *   - the order the reveal animation walks around the wreath
 *
 * Coordinates are in the drawing's own 600 x 911 viewBox. If Neida redraws the
 * vine, re-measure these (scripts/leaf-overlay.mjs renders them over the art).
 */

export interface Leaf {
  /** Must match a section `slug` in content/sections/. */
  slug: string
  /** Label for screen readers and the visible fallback. */
  label: string
  cx: number
  cy: number
  rx: number
  ry: number
  /** Degrees, clockwise. Leaves sit at angles around the wreath. */
  rot: number
}

/** Centre and radius of the vine ring, used by the sweep-reveal mask. */
export const WREATH = { cx: 295, cy: 505, r: 180 } as const

/**
 * The cropped viewBox, produced by scripts/clean-vine.mjs.
 *
 * The scan is a full sheet of paper: the ink covers about 60% of it, leaving a
 * wide band of blank page above and below the wreath. This is the box around
 * the ink itself. Path coordinates are unchanged — only the window onto them —
 * so every leaf position above is still measured in the original scan's space
 * and did not need re-measuring. Re-run the script and paste the numbers here
 * whenever the artwork changes.
 */
export const ART_VIEW = { x: 13, y: 221, width: 585, height: 547 } as const

/**
 * Ordered by angle clockwise from the top of the wreath, which is the order the
 * reveal sweep uncovers them and therefore the order arrow keys walk. Florals
 * and cake sit inside the ring rather than out on the rim, so they fall between
 * their neighbours by angle rather than by distance.
 */
export const LEAVES: Leaf[] = [
  { slug: 'clay', label: 'Clay', cx: 388, cy: 268, rx: 78, ry: 42, rot: -18 },
  { slug: 'florals', label: 'Florals', cx: 335, cy: 468, rx: 52, ry: 34, rot: -52 },
  { slug: 'film', label: 'Film', cx: 520, cy: 426, rx: 66, ry: 38, rot: 10 },
  { slug: 'education', label: 'Education', cx: 450, cy: 690, rx: 34, ry: 56, rot: 8 },
  { slug: 'cake', label: 'Cake', cx: 322, cy: 604, rx: 46, ry: 34, rot: -62 },
  { slug: 'research', label: 'Research', cx: 232, cy: 730, rx: 62, ry: 34, rot: -12 },
  { slug: 'drawings', label: 'Drawings', cx: 90, cy: 592, rx: 60, ry: 28, rot: -6 },
  { slug: 'textiles', label: 'Textiles', cx: 132, cy: 330, rx: 38, ry: 78, rot: -8 },
]
