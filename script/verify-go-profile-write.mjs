#!/usr/bin/env node

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"

const [responsePath, nickname] = process.argv.slice(2)
const response = JSON.parse(await readFile(responsePath, "utf8"))
assert.equal(response.data.nickname, nickname)
assert.equal(response.data.name, "Go contract profile")
assert.equal(response.data.gender, "other")
assert.equal(response.data.birth_date, "1999-01-01")
assert.equal(response.data.about, "Saved by the Go owner")
process.stdout.write("Authenticated Phoenix → Go profile update contract passed.\n")
