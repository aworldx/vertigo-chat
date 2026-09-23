import assert from "node:assert/strict"
import { test } from "node:test"
import { formatVisitTime } from "../src/features/visits/model/time"
import { loadVisits } from "../src/features/visits/api/visits"
test("visit dates use Moscow across UTC date and year boundaries", () => {
  assert.equal(formatVisitTime("2026-12-31T22:15:00Z"), "01.01.2027 · 01:15")
  assert.equal(formatVisitTime("2026-08-17T10:15:00Z"), "17.08.2026 · 13:15")
})
test("visit boundary rejects invalid dates, missing status, duplicate keys and unexpected window", async () => {
  const original = globalThis.fetch
  const visit = { id: 1, nickname: "<script>", entered_at: "2026-09-23T00:00:00Z", left_at: null }
  try {
    for (const data of [
      { data: [{ ...visit, entered_at: "2026-02-30T00:00:00Z" }], meta: { history_hours: 48 } },
      { data: [{ ...visit, left_at: undefined }], meta: { history_hours: 48 } },
      { data: [visit, visit], meta: { history_hours: 48 } },
      { data: [visit], meta: { history_hours: 49 } },
    ]) {
      globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify(data)))
      await assert.rejects(loadVisits(new AbortController().signal))
    }
    globalThis.fetch = () =>
      Promise.resolve(new Response(JSON.stringify({ data: [visit], meta: { history_hours: 48 } })))
    const result = await loadVisits(new AbortController().signal)
    assert.equal(result.data[0]?.nickname, "<script>")
  } finally {
    globalThis.fetch = original
  }
})
