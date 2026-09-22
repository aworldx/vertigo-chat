#!/usr/bin/env node

import assert from "node:assert/strict"

const phoenix = process.env.PHOENIX_API_URL ?? "http://127.0.0.1:4030"
const goAPI = process.env.GO_API_URL ?? "http://127.0.0.1:4020"

async function response(base, path) {
  const result = await fetch(new URL(path, base))
  return { status: result.status, body: await result.json() }
}

async function compare(path) {
  const [oldResult, newResult] = await Promise.all([response(phoenix, path), response(goAPI, path)])
  try {
    assert.deepStrictEqual(newResult, oldResult)
  } catch {
    throw new Error(`${path} differs\nPhoenix: ${JSON.stringify(oldResult)}\nGo: ${JSON.stringify(newResult)}`)
  }
}

const catalogue = await response(phoenix, "/api/v1/profiles")
if (catalogue.status !== 200 || !Array.isArray(catalogue.body.data)) throw new Error("Phoenix catalogue is unavailable")
const nickname = catalogue.body.data.at(0)?.nickname
if (typeof nickname !== "string") throw new Error("Phoenix catalogue has no profile fixture")

for (const path of [
  "/api/v1/profiles",
  "/api/v1/profiles?q=%20%20",
  "/api/v1/profiles?q=%D0%BD%D0%B5%D1%82-%D1%82%D0%B0%D0%BA%D0%BE%D0%B9-%D0%B0%D0%BD%D0%BA%D0%B5%D1%82%D1%8B",
  "/api/v1/profiles?page=999",
  "/api/v1/profiles?page=0",
  "/api/v1/profiles?page%5Bnested%5D=1",
  "/api/v1/profiles?q%5Bnested%5D=value",
  "/api/v1/profiles?q=one&q=two",
  `/api/v1/profiles/${encodeURIComponent(nickname)}`,
  "/api/v1/profiles/not-a-profile-contract-fixture",
]) {
  await compare(path)
}

process.stdout.write("Profile HTTP contracts match between Phoenix and Go.\n")
