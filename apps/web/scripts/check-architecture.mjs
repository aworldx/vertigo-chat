import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import ts from "typescript"

const root = resolve("src")
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : []
  })
}
const layers = ["shared", "features", "pages", "app"]
for (const file of files(root)) {
  const from = relative(root, file).split("/")
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest)
  for (const node of source.statements) {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue
    const specifier = node.moduleSpecifier.text
    if (!specifier.startsWith(".")) continue
    const target = resolve(dirname(file), specifier)
    const to = relative(root, target).split("/")
    const invalid = layers.indexOf(to[0]) > layers.indexOf(from[0]) || to[0] === ".."
      || (from[0] === "features" && to[0] === "features" && from[1] !== to[1])
      || (to[0] === "features" && (from[0] !== "features" || from[1] !== to[1]) && to.length > 2 && to.slice(2).join("/") !== "index")
    if (invalid) throw new Error(`Architecture boundary: ${relative(root, file)} -> ${specifier}`)
  }
}
console.log("React architecture boundaries passed")
