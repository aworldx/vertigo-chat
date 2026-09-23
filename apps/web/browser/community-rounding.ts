import { PNG } from "pngjs"
export type Bounds = { x: number; y: number; width: number; height: number }
// A backdrop repaint after a like rounds up to 32 pixels at the upload/card
// rounded corners by <=4 channel levels. Text and geometry have no tolerance.
function cornerRoundingOnly(
  before: Buffer,
  after: Buffer,
  bounds: Bounds[],
  maxPixels: number,
  maxChannel: number,
  panel?: Bounds,
): boolean {
  const a = PNG.sync.read(before),
    b = PNG.sync.read(after)
  if (a.width !== b.width || a.height !== b.height) return false
  let count = 0
  for (let i = 0; i < a.data.length; i += 4) {
    const left = a.data.subarray(i, i + 4),
      right = b.data.subarray(i, i + 4)
    if (left.equals(right)) continue
    if (++count > maxPixels || left.some((v, j) => Math.abs(v - (right[j] ?? -255)) > maxChannel)) return false
    const x = (i / 4) % a.width,
      y = Math.floor(i / 4 / a.width)
    const backdrop = panel && (x < panel.x || x >= panel.x + panel.width || y < panel.y || y >= panel.y + panel.height)
    if (
      !backdrop &&
      !bounds.some(
        (r) =>
          x >= r.x &&
          x < r.x + r.width &&
          y >= r.y &&
          y < r.y + r.height &&
          (x < r.x + 16 || x >= r.x + r.width - 16) &&
          (y < r.y + 16 || y >= r.y + r.height - 16),
      )
    )
      return false
  }
  return true
}

export function galleryCornerRoundingOnly(before: Buffer, after: Buffer, bounds: Bounds[], editing = false) {
  // The tablet caption editor repaints the photo's four corners (measured 60 pixels, <=11 levels).
  return cornerRoundingOnly(before, after, bounds, editing ? 64 : 32, editing ? 12 : 4)
}
// Expanding a library article repaints backdrop-filtered sidebar corners.
export function libraryCornerRoundingOnly(before: Buffer, after: Buffer, bounds: Bounds[]) {
  return cornerRoundingOnly(before, after, bounds, 48, 2)
}

// Native input compositing rounds at most thirty-two corner pixels by one channel level.
export function adminCornerRoundingOnly(before: Buffer, after: Buffer, bounds: Bounds[], editing = false) {
  return cornerRoundingOnly(before, after, bounds, 32, editing ? 3 : 1)
}

// Native input corners and the dimmed backdrop can round by one level after a legacy layout correction.
export function libraryEditorRoundingOnly(before: Buffer, after: Buffer, inputs: Bounds[], panel: Bounds) {
  return cornerRoundingOnly(before, after, inputs, 12, 1, panel)
}
