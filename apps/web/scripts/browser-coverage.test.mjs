import assert from "node:assert/strict"
import { test } from "node:test"
import { transformSync } from "esbuild"
import v8ToIstanbul from "v8-to-istanbul"
import coverage from "istanbul-lib-coverage"
import { mergeBrowserScripts } from "./browser-coverage.mjs"

test("partial Chromium deltas do not cover a function that never ran", async () => {
  const source = transformSync("function used() {\n  return 1\n}\nfunction never() {\n  return 2\n}\nused()\n", { sourcefile: "fixture.ts", sourcemap: "inline" }).code
  const fn = (name, count) => {
    const startOffset = source.indexOf(`function ${name}(`)
    return { functionName: name, isBlockCoverage: true, ranges: [{ startOffset, endOffset: source.indexOf("}", startOffset) + 1, count }] }
  }
  const root = { functionName: "", isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: source.length, count: 1 }] }
  const entry = functions => ({ source, url: "http://fixture/assets/app.js", functions })
  const merged = mergeBrowserScripts([entry([root, fn("used", 1), fn("never", 0)]), entry([root, fn("used", 1)])])
  const converter = v8ToIstanbul("/tmp/fixture.js", 0, { source })
  await converter.load()
  converter.applyCoverage(merged.functions)
  const map = coverage.createCoverageMap(converter.toIstanbul())
  const file = map.fileCoverageFor(map.files()[0])
  assert.equal(file.getLineCoverage()[5], 0, "never() body must remain uncovered")
  assert.ok(file.getLineCoverage()[2] > 0, "used() body must be covered")
  assert.throws(() => mergeBrowserScripts([]), /No source-mapped/)
  assert.throws(() => mergeBrowserScripts([entry([root]), { ...entry([root]), source: source + "\n" }]), /different source bundles/)
})
