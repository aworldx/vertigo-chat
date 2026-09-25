import { readdir, readFile, mkdir } from "node:fs/promises"
import { resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"
import v8ToIstanbul from "v8-to-istanbul"
import { mergeBrowserScripts } from "./browser-coverage.mjs"
import coverage from "istanbul-lib-coverage"
import reports from "istanbul-reports"
import reporting from "istanbul-lib-report"

const root = fileURLToPath(new URL("..", import.meta.url))
const output = resolve(root, "coverage")
const browserDirectory = process.env.WEB_COVERAGE_DIR
if (!browserDirectory) throw new Error("WEB_COVERAGE_DIR is required; browser coverage must not be skipped")
const included = (file) => {
  const path = relative(root, file).replaceAll("\\", "/")
  return path.startsWith("src/") && !path.startsWith("src/shared/generated/") && /\.tsx?$/.test(path)
}
const map = coverage.createCoverageMap(JSON.parse(await readFile(resolve(output, "unit/coverage-final.json"), "utf8")))
const files = (await readdir(browserDirectory)).filter((name) => name.endsWith(".json"))
const entries = []
const sources = new Map()
for (const name of files) {
  const batch = JSON.parse(await readFile(resolve(browserDirectory, name), "utf8"))
  for (const entry of batch) {
    if (!entry.url?.endsWith("/assets/app.js") || !entry.source?.includes("sourceMappingURL=data:")) continue
    // Every browser delta repeats the full bundle and inline source map. Keep
    // one string per bundle instead of retaining hundreds of identical copies.
    if (!sources.has(entry.source)) sources.set(entry.source, entry.source)
    entries.push({ ...entry, source: sources.get(entry.source) })
  }
}
const merged = mergeBrowserScripts(entries)
const converter = v8ToIstanbul(resolve(root, "dist/assets/app.js"), 0, { source: merged.source })
await converter.load()
converter.applyCoverage(merged.functions)
for (const [file, data] of Object.entries(converter.toIstanbul())) if (included(file)) map.addFileCoverage(data)
map.filter(included)
await mkdir(output, { recursive: true })
const context = reporting.createContext({ dir: output, coverageMap: map })
for (const type of ["text", "json", "json-summary", "html"]) reports.create(type).execute(context)
const summary = map.getCoverageSummary()
// Go uses statement coverage; TS statements map to executable source lines in
// V8. Keep both floors explicit and include unexecuted source via c8 --all.
for (const metric of ["lines", "statements"]) {
  if (summary[metric].pct < 90) {
    console.error(`React ${metric}: ${summary[metric].pct}% is below the mandatory 90%`)
    process.exitCode = 1
  }
}
