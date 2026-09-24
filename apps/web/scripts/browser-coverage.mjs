import { mergeScriptCovs } from "@bcoe/v8-coverage"

export function mergeBrowserScripts(entries) {
  const scripts = new Map()
  for (const entry of entries) {
    if (!entry.url?.endsWith("/assets/app.js") || !entry.source?.includes("sourceMappingURL=data:")) continue
    const group = scripts.get(entry.source) ?? []
    group.push({ scriptId: "bundle", url: entry.url, functions: entry.functions })
    scripts.set(entry.source, group)
  }
  if (!scripts.size) throw new Error("No source-mapped React browser coverage was collected")
  if (scripts.size !== 1) throw new Error("Browser reports contain different source bundles")
  const [source, scriptsToMerge] = scripts.entries().next().value
  // A delta omits unchanged functions: converting it separately overcounts them.
  const merged = mergeScriptCovs(scriptsToMerge)
  if (!merged) throw new Error("Empty browser script coverage")
  return { source, functions: merged.functions }
}
