import assert from "node:assert/strict"
import { writeFile } from "node:fs/promises"
import { PNG } from "pngjs"

export async function writeDiff(oldImage: Buffer, newImage: Buffer, path: string): Promise<number> {
  const old = PNG.sync.read(oldImage)
  const current = PNG.sync.read(newImage)
  assert.equal(current.width, old.width)
  assert.equal(current.height, old.height)
  const diff = new PNG({ width: old.width, height: old.height })
  let pixels = 0
  for (let index = 0; index < old.data.length; index += 4) {
    const changed = !old.data.subarray(index, index + 4).equals(current.data.subarray(index, index + 4))
    if (changed) pixels++
    const grey = old.data[index] ?? 0
    diff.data.set(changed ? [255, 0, 0, 255] : [grey, grey, grey, 100], index)
  }
  await writeFile(path, PNG.sync.write(diff))
  return pixels
}

// Fractional poster resizing can round a channel differently by one level in
// Chromium, even with byte-identical source PNGs and CPU rendering. Keep the
// raw diff; permit at most two such pixels, exclusively inside the verified
// poster bounds. Text, forms and every other pixel still require exact equality.
export function posterRoundingOnly(
  oldImage: Buffer,
  newImage: Buffer,
  bounds: { x: number; y: number; width: number; height: number },
): boolean {
  const old = PNG.sync.read(oldImage)
  const current = PNG.sync.read(newImage)
  if (old.width !== current.width || old.height !== current.height) return false
  let differences = 0
  for (let index = 0; index < old.data.length; index += 4) {
    const before = old.data.subarray(index, index + 4)
    const after = current.data.subarray(index, index + 4)
    if (before.equals(after)) continue
    differences++
    const x = (index / 4) % old.width
    const y = Math.floor(index / 4 / old.width)
    if (
      differences > 2 ||
      x < bounds.x ||
      x >= bounds.x + bounds.width ||
      y < bounds.y ||
      y >= bounds.y + bounds.height ||
      before.some((channel, offset) => Math.abs(channel - (after[offset] ?? -255)) > 1)
    )
      return false
  }
  return true
}

// Chromium's native `outline: auto` can rasterize a few corner pixels differently
// in otherwise identical compositor layers. Only the band OUTSIDE the focused
// control is eligible, after the caller has checked geometry and computed styles.
export function nativeFocusRoundingOnly(
  oldImage: Buffer,
  newImage: Buffer,
  control: { x: number; y: number; width: number; height: number },
): boolean {
  const old = PNG.sync.read(oldImage),
    current = PNG.sync.read(newImage)
  if (old.width !== current.width || old.height !== current.height) return false
  let differences = 0
  for (let index = 0; index < old.data.length; index += 4) {
    const before = old.data.subarray(index, index + 4),
      after = current.data.subarray(index, index + 4)
    if (before.equals(after)) continue
    differences++
    const x = (index / 4) % old.width,
      y = Math.floor(index / 4 / old.width)
    const insideControl =
      x >= control.x && x < control.x + control.width && y >= control.y && y < control.y + control.height
    if (
      differences > 3 ||
      insideControl ||
      x < control.x - 2 ||
      x >= control.x + control.width + 2 ||
      y < control.y - 2 ||
      y >= control.y + control.height + 2 ||
      before.some((channel, offset) => Math.abs(channel - (after[offset] ?? -255)) > 7)
    )
      return false
  }
  return true
}

// CPU compositing of translucent dark backgrounds can differ by one channel
// level. Callers must first prove equal geometry/styles and supply only the
// affected background/border regions. Bright text, alpha, larger changes and
// more than 12 pixels per verified region remain failures; raw diffs are retained.
export function darkCompositorRoundingOnly(
  oldImage: Buffer,
  newImage: Buffer,
  regions: { x: number; y: number; width: number; height: number }[],
): boolean {
  const old = PNG.sync.read(oldImage),
    current = PNG.sync.read(newImage)
  if (old.width !== current.width || old.height !== current.height) return false
  let differences = 0
  for (let index = 0; index < old.data.length; index += 4) {
    const before = old.data.subarray(index, index + 4),
      after = current.data.subarray(index, index + 4)
    if (before.equals(after)) continue
    const x = (index / 4) % old.width,
      y = Math.floor(index / 4 / old.width)
    if (
      ++differences > 12 * regions.length ||
      before[3] !== after[3] ||
      before
        .subarray(0, 3)
        .some(
          (channel, offset) =>
            channel > 80 || (after[offset] ?? 255) > 80 || Math.abs(channel - (after[offset] ?? -255)) > 1,
        ) ||
      !regions.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)
    )
      return false
  }
  return true
}
