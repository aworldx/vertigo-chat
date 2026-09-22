import assert from "node:assert/strict"
import { test } from "node:test"
import { PNG } from "pngjs"
import { posterRoundingOnly } from "../browser/compare-screenshots"

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
