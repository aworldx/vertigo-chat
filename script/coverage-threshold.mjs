import { readFile, writeFile } from "node:fs/promises"

const [component, output, ...profiles] = process.argv.slice(2)
if (!component || !output || !profiles.length) throw new Error("Usage: coverage-threshold.mjs component output profile...")
const blocks = new Map()
for (const profile of profiles) {
  const lines = (await readFile(profile, "utf8")).trim().split("\n")
  if (!/^mode: (atomic|set|count)$/.test(lines.shift() ?? "")) throw new Error(`Invalid coverage profile: ${profile}`)
  for (const line of lines) {
    const [location, statements, hits, ...extra] = line.trim().split(/\s+/)
    if (!location || extra.length || !/^\d+$/.test(statements ?? "") || !/^\d+$/.test(hits ?? "")) {
      throw new Error(`Invalid coverage block: ${line}`)
    }
    const previous = blocks.get(location)
    if (previous && previous.statements !== Number(statements)) throw new Error(`Sources changed between profiles: ${location}`)
    blocks.set(location, { statements: Number(statements), hits: Math.max(previous?.hits ?? 0, Number(hits)) })
  }
}
const totals = [...blocks.values()].reduce((sum, block) => ({
  statements: sum.statements + block.statements,
  covered: sum.covered + (block.hits > 0 ? block.statements : 0),
}), { statements: 0, covered: 0 })
if (!totals.statements) throw new Error(`${component}: empty coverage is not a passing result`)
await writeFile(output, "mode: atomic\n" + [...blocks].sort(([a], [b]) => a.localeCompare(b)).map(([location, block]) => `${location} ${block.statements} ${block.hits}`).join("\n") + "\n")
console.log(`${component}: ${totals.covered}/${totals.statements} statements (${(100 * totals.covered / totals.statements).toFixed(2)}%), required 90%`)
if (totals.covered * 100 < totals.statements * 90) process.exitCode = 1
