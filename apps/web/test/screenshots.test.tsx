import assert from "node:assert/strict"
import { test } from "node:test"
import { PNG } from "pngjs"
import { posterRoundingOnly, nativeFocusRoundingOnly, darkCompositorRoundingOnly } from "../browser/compare-screenshots"

const bounds = { x: 1, y: 1, width: 2, height: 2 }
function picture(pixels: [number, number, number][]) {
  const png = new PNG({ width: 4, height: 4 })
  png.data.fill(100)
  for (const [x, y, delta] of pixels) png.data[(y * 4 + x) * 4] = 100 + delta
  return PNG.sync.write(png)
}
const baseline = picture([])
test("poster rounding allowance cannot hide changes to text, color or geometry", () => {
  assert.equal(
    posterRoundingOnly(
      baseline,
      picture([
        [1, 1, 1],
        [2, 2, -1],
      ]),
      bounds,
    ),
    true,
  )
  assert.equal(posterRoundingOnly(baseline, picture([[1, 1, 2]]), bounds), false)
  assert.equal(
    posterRoundingOnly(
      baseline,
      picture([
        [1, 1, 1],
        [1, 2, 1],
        [2, 2, 1],
      ]),
      bounds,
    ),
    false,
  )
  assert.equal(posterRoundingOnly(baseline, picture([[0, 0, 1]]), bounds), false)
  assert.equal(posterRoundingOnly(baseline, picture([[3, 1, 1]]), bounds), false)
  assert.equal(posterRoundingOnly(baseline, PNG.sync.write(new PNG({ width: 5, height: 4 })), bounds), false)
})

test("native focus allowance excludes control contents and larger outline changes", () => {
  assert.equal(nativeFocusRoundingOnly(baseline, picture([[0, 1, 7]]), bounds), true)
  assert.equal(nativeFocusRoundingOnly(baseline, picture([[1, 1, 1]]), bounds), false)
  assert.equal(nativeFocusRoundingOnly(baseline, picture([[0, 1, 8]]), bounds), false)
  assert.equal(
    nativeFocusRoundingOnly(
      baseline,
      picture([
        [0, 0, 1],
        [0, 1, 1],
        [0, 2, 1],
        [0, 3, 1],
      ]),
      bounds,
    ),
    false,
  )
  assert.equal(nativeFocusRoundingOnly(baseline, picture([[0, 1, 1]]), { ...bounds, x: 3 }), false)
  assert.equal(nativeFocusRoundingOnly(baseline, PNG.sync.write(new PNG({ width: 5, height: 4 })), bounds), false)
})

test("dark compositor allowance rejects brighter text, geometry, excessive pixels and stronger changes", () => {
  const image = (pixels: [number, number, number][]) => {
    const png = new PNG({ width: 4, height: 4 })
    png.data.fill(20)
    for (const [x, y, delta] of pixels) png.data[(y * 4 + x) * 4] = 20 + delta
    return PNG.sync.write(png)
  }
  assert.equal(darkCompositorRoundingOnly(image([]), image([[1, 1, 1]]), [bounds]), true)
  assert.equal(darkCompositorRoundingOnly(image([]), image([[1, 1, 2]]), [bounds]), false)
  assert.equal(darkCompositorRoundingOnly(image([]), image([[0, 0, 1]]), [bounds]), false)
  assert.equal(darkCompositorRoundingOnly(baseline, picture([[1, 1, 1]]), [bounds]), false)
  assert.equal(darkCompositorRoundingOnly(image([]), PNG.sync.write(new PNG({ width: 5, height: 4 })), [bounds]), false)
  const pixels: [number, number, number][] = Array.from({ length: 13 }, (_, i) => [i % 4, Math.floor(i / 4), 1])
  assert.equal(darkCompositorRoundingOnly(image([]), image(pixels), [{ x: 0, y: 0, width: 4, height: 4 }]), false)
})
