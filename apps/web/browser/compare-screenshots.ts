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
