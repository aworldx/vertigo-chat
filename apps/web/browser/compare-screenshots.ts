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
