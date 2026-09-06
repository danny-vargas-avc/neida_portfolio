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
  /**
   * Where the leaf's stem meets the vine, in the same coordinates.
   *
   * This is the origin the leaf grows from on hover. It has to be the stem
   * junction rather than the leaf's centre: scaling about the centre reads as a
   * balloon inflating, while scaling about the stem reads as the leaf sprouting
   * outward along its own axis. Keeping the origin at the junction also means
   * the stem barely moves, so the growing copy still meets the vine cleanly.
   */
  ax: number
  ay: number
  /**
   * Half-width of the blade at its widest, for the growth outline.
   *
   * Measured per leaf rather than derived from rx/ry: the ellipse is sized as a
   * comfortable click target, and a blade narrower or broader than that leaves
   * either un-erased ink along the leaf's edge or swallows nearby vine.
   */
  hw: number
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
 * The outline of a leaf blade, as an SVG path.
 *
 * A lens — pointed at the stem, pointed at the tip, widest in the middle — is
 * close to the real shape of these leaves, and much tighter than the ellipse
 * used for the hit area. That matters for the two leaves that sit INSIDE the
 * wreath (cake and florals): an ellipse around them also encloses lengths of
 * vine, which would then be recoloured and dragged along when the leaf grows.
 *
 * Built from the stem junction and the blade centre, so it stays correct as
 * long as those two are measured properly.
 */
export function leafOutline(leaf: Leaf): string {
  const { ax, ay, cx, cy } = leaf
  // The blade centre is halfway along, so the tip is the same distance again.
  const tx = cx * 2 - ax
  const ty = cy * 2 - ay

  const dx = tx - ax
  const dy = ty - ay
  const len = Math.hypot(dx, dy) || 1
  // Unit normal to the midrib.
  const nx = -dy / len
  const ny = dx / len

  // Widest at the middle. A quadratic reaches half its control offset at t=0.5,
  // so the control points sit twice the half-width off the midrib.
  const halfWidth = leaf.hw
  const c1x = cx + nx * halfWidth * 2
  const c1y = cy + ny * halfWidth * 2
  const c2x = cx - nx * halfWidth * 2
  const c2y = cy - ny * halfWidth * 2

  const r = (n: number) => Math.round(n * 10) / 10
  return `M${r(ax)} ${r(ay)} Q${r(c1x)} ${r(c1y)} ${r(tx)} ${r(ty)} Q${r(c2x)} ${r(c2y)} ${r(ax)} ${r(ay)} Z`
}

/**
 * Ordered by angle clockwise from the top of the wreath, which is the order the
 * reveal sweep uncovers them and therefore the order arrow keys walk. Florals
 * and cake sit inside the ring rather than out on the rim, so they fall between
 * their neighbours by angle rather than by distance.
 */
export const LEAVES: Leaf[] = [
  { slug: 'clay', label: 'Clay', cx: 390, cy: 272, rx: 94, ry: 48, rot: -28, ax: 322, ay: 312, hw: 47 },
  { slug: 'florals', label: 'Florals', cx: 336, cy: 466, rx: 64, ry: 42, rot: -50, ax: 300, ay: 508, hw: 35 },
  { slug: 'film', label: 'Film', cx: 524, cy: 430, rx: 80, ry: 46, rot: 8, ax: 458, ay: 432, hw: 44 },
  { slug: 'education', label: 'Education', cx: 450, cy: 692, rx: 42, ry: 68, rot: 8, ax: 444, ay: 636, hw: 33 },
  { slug: 'cake', label: 'Cake', cx: 322, cy: 604, rx: 58, ry: 42, rot: -62, ax: 348, ay: 646, hw: 37 },
  { slug: 'research', label: 'Research', cx: 232, cy: 730, rx: 75, ry: 42, rot: -12, ax: 292, ay: 716, hw: 37 },
  { slug: 'drawings', label: 'Drawings', cx: 90, cy: 592, rx: 72, ry: 36, rot: -6, ax: 148, ay: 588, hw: 31 },
  { slug: 'textiles', label: 'Textiles', cx: 132, cy: 330, rx: 46, ry: 92, rot: -8, ax: 148, ay: 402, hw: 35 },
]
