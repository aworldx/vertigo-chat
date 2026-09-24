import assert from "node:assert/strict"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { test } from "node:test"
const checker = new URL("./coverage-threshold.mjs", import.meta.url)
async function check(t, profiles) {
  const dir = await mkdtemp(join(tmpdir(), "coverage-check-"))
  t.after(() => rm(dir, {recursive:true,force:true}))
  const files = []
  for (const [i, contents] of profiles.entries()) {
    const file = join(dir, String(i)); await writeFile(file, contents); files.push(file)
  }
  const output = join(dir,"merged.cover")
  return {...spawnSync(process.execPath,[checker.pathname,"test",output,...files],{encoding:"utf8"}),output}
}
test("coverage below 90 fails without rounding up", async t=>{
  const result=await check(t,["mode: atomic\nx.go:1.1,2.2 8999 1\nx.go:3.1,4.2 1001 0\n"])
  assert.equal(result.status,1); assert.match(result.stdout,/89.99%/)
})
test("exactly 90 passes and repeated profiles do not inflate the denominator",async t=>{
  const profile="mode: atomic\nx.go:1.1,2.2 9 1\nx.go:3.1,4.2 1 0\n"
  const result=await check(t,[profile,profile]);assert.equal(result.status,0);assert.match(result.stdout,/9\/10 statements/)
})
test("unit and browser execution merge per block",async t=>{
  const result=await check(t,["mode: atomic\nx.go:1.1,2.2 9 0\nx.go:3.1,4.2 1 1\n","mode: set\nx.go:1.1,2.2 9 1\nx.go:3.1,4.2 1 0\n"])
  assert.equal(result.status,0);assert.match(await readFile(result.output,"utf8"),/9 1/)
})
test("missing, empty, malformed and incompatible profiles fail closed",async t=>{
 for(const profiles of [[],["mode: atomic\n"],["garbage"],["mode: atomic\nx 1 -1"],["mode: atomic\nx 1 1","mode: atomic\nx 2 1"]]) {
  const result=await check(t,profiles);assert.notEqual(result.status,0)
 }
})
