import test from "node:test"
import assert from "node:assert/strict"
import { PNG } from "pngjs"
import { galleryCornerRoundingOnly, libraryEditorRoundingOnly } from "../browser/community-rounding"
test("gallery tolerance rejects text, geometry and larger color changes", () => {
  const a = new PNG({ width: 80, height: 80 })
  a.data.fill(100)
  const before = PNG.sync.write(a),
    bounds = [{ x: 10, y: 10, width: 60, height: 60 }]
  const changed = (x: number, y: number, delta: number) => {
    const b = PNG.sync.read(before)
    b.data[(y * 80 + x) * 4] = 100 + delta
    return PNG.sync.write(b)
  }
  assert.equal(galleryCornerRoundingOnly(before, changed(10, 10, 3), bounds), true)
  const panel = { x: 5, y: 5, width: 70, height: 70 }
  assert.equal(libraryEditorRoundingOnly(before, changed(1, 40, 1), bounds, panel), true)
  assert.equal(libraryEditorRoundingOnly(before, changed(1, 40, 2), bounds, panel), false)
  assert.equal(libraryEditorRoundingOnly(before, changed(40, 40, 1), bounds, panel), false)
  assert.equal(galleryCornerRoundingOnly(before, changed(40, 40, 1), bounds), false)
  assert.equal(galleryCornerRoundingOnly(before, changed(40, 40, 1), bounds, true), false)
  assert.equal(galleryCornerRoundingOnly(before, changed(10, 10, 13), bounds, true), false)
  assert.equal(galleryCornerRoundingOnly(before, changed(10, 10, 5), bounds), false)
  assert.equal(galleryCornerRoundingOnly(before, changed(10, 10, 3), [{ x: 20, y: 20, width: 60, height: 60 }]), false)
})
