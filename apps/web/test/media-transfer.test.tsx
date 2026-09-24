import assert from "node:assert/strict"
import { test } from "node:test"
import { MediaTransfer, type SharedFile } from "../src/features/chat/model/mediaTransfer"
import { mediaType, normalizeFile } from "../src/features/chat/model/mediaSignature"

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const image = (name = "pixel.png") => new File([png], name, { type: "image/png" })
function fixture(signal: (target: string, body: string) => boolean = () => true) {
  const cards = new Map<string, SharedFile>(),
    errors: string[] = [],
    removed: string[] = []
  const manager = new MediaTransfer(
    signal,
    (card) => {
      cards.set(card.id, card)
    },
    (error) => {
      errors.push(error)
    },
    (id) => {
      cards.delete(id)
      removed.push(id)
    },
  )
  return { manager, cards, errors, removed }
}

test("eviction releases old Blob URLs and stop releases the remaining media", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let next = 0
  const revoked: string[] = []
  t.mock.method(URL, "createObjectURL", () => `blob:${String(++next)}`)
  t.mock.method(URL, "revokeObjectURL", (url: string) => {
    revoked.push(url)
  })
  const f = fixture()
  for (let index = 0; index < 25; index++) await f.manager.share(image(), "alice")
  assert.equal(f.cards.size, 20)
  assert.equal(f.removed.length, 5)
  assert.equal(revoked.length, 5)
  t.mock.timers.tick(15 * 60 * 1000)
  assert.equal(f.cards.size, 20, "expiry of sharing must not remove a still-visible preview")
  f.manager.stop()
  assert.equal(new Set(revoked).size, 25)
  assert.equal(revoked.length, 25)
  await assert.rejects(f.manager.share(image(), "alice"), /завершена/u)
})

test("byte budget evicts large files even before reaching twenty cards", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const bytes = new Uint8Array(47 * 1024 * 1024)
  bytes.set([79, 103, 103, 83])
  const file = new File([bytes], "audio.ogg", { type: "audio/ogg" })
  const f = fixture()
  for (let index = 0; index < 3; index++) await f.manager.share(file, "alice")
  assert.equal(f.cards.size, 2)
  assert.equal(f.removed.length, 1)
  f.manager.stop()
})

test("a failed announcement cleans up its URL and does not publish a card", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const revoke = t.mock.method(URL, "revokeObjectURL", () => {})
  const f = fixture(() => false)
  await assert.rejects(f.manager.share(image(), "alice"), /Связь прервалась/u)
  assert.equal(f.cards.size, 0)
  assert.equal(revoke.mock.callCount(), 1)
  f.manager.stop()
  assert.equal(revoke.mock.callCount(), 1)
})

test("bad type, content, size and filename are rejected before announcement", async () => {
  let announcements = 0
  const f = fixture(() => {
    announcements++
    return true
  })
  for (const file of [
    new File(["not a photo"], "fake.png", { type: "image/png" }),
    new File([png], "fake.jpg", { type: "image/jpeg" }),
    image("x".repeat(121)),
    new File([png, new Uint8Array(5_000_000)], "large.png", { type: "image/png" }),
  ])
    await assert.rejects(f.manager.share(file, "alice"))
  assert.equal(announcements, 0)
  f.manager.stop()
})

test("valid relay chunks complete a preview; forged sender, order and total are ignored", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const signals: string[] = []
  const f = fixture((_target, body) => {
    signals.push(body)
    return true
  })
  const announce = { id: "file", type: "announce", name: "pixel.png", mime: "image/png", size: png.length }
  await f.manager.accept("owner", JSON.stringify(announce))
  f.manager.request("unknown")
  f.manager.request("file")
  f.manager.request("file")
  assert.equal(signals.length, 1)
  t.mock.timers.tick(20000)
  assert.match(signals[1] ?? "", /relay_request/)
  const chunk = { id: "file", type: "relay_chunk", data: Buffer.from(png).toString("base64"), index: 0, total: 1 }
  await f.manager.accept("other", JSON.stringify(chunk))
  await f.manager.accept("owner", JSON.stringify({ ...chunk, index: 1 }))
  await f.manager.accept("owner", JSON.stringify({ ...chunk, total: 2 }))
  assert.equal(f.cards.get("file")?.status, "loading")
  await f.manager.accept("owner", JSON.stringify(chunk))
  assert.equal(f.cards.get("file")?.status, "ready")
  assert.equal(f.cards.get("file")?.progress, 100)
  assert.match(f.cards.get("file")?.url ?? "", /^blob:/)
  f.manager.request("file")
  assert.equal(signals.length, 3)
  assert.match(signals[2] ?? "", /relay_ack/)
  f.manager.stop()
})

test("invalid received content remains retryable and stalled relay reports failure", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const f = fixture()
  await f.manager.accept(
    "owner",
    JSON.stringify({ id: "file", type: "announce", name: "x.png", mime: "image/png", size: 8 }),
  )
  f.manager.request("file")
  t.mock.timers.tick(20000)
  await f.manager.accept(
    "owner",
    JSON.stringify({ id: "file", type: "relay_chunk", data: Buffer.alloc(8).toString("base64"), index: 0, total: 1 }),
  )
  assert.equal(f.cards.get("file")?.status, "waiting")
  assert.match(f.cards.get("file")?.error ?? "", /неверный формат/u)
  f.manager.request("file")
  t.mock.timers.tick(20000)
  t.mock.timers.tick(30000)
  assert.match(f.errors.at(-1) ?? "", /Передача остановилась/u)
  f.manager.stop()
  await f.manager.accept("owner", "invalid JSON is ignored after stop")
})

test("stopping an in-flight relay cancels acknowledgement waits", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let chunkSent: (() => void) | undefined
  const sent = new Promise<void>((resolve) => {
    chunkSent = resolve
  })
  const f = fixture((_target, body) => {
    if (body.includes('"relay_chunk"')) chunkSent?.()
    return true
  })
  await f.manager.share(image(), "alice")
  const id = [...f.cards.keys()][0]
  assert.ok(id)
  const request = f.manager.accept("reader", JSON.stringify({ id, type: "relay_request" }))
  const rejected = assert.rejects(request, /завершена/u)
  await sent
  f.manager.stop()
  await rejected
  t.mock.timers.tick(60000)
})

test("audio signatures normalize browser MIME variants while image mismatch stays invalid", async () => {
  const signatures: [number[], string][] = [
    [[255, 216, 255], "image/jpeg"],
    [[82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], "image/webp"],
    [[82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69], "audio/wav"],
    [[79, 103, 103, 83], "audio/ogg"],
    [[0, 0, 0, 0, 102, 116, 121, 112], "audio/mp4"],
    [[255, 241], "audio/aac"],
    [[73, 68, 51], "audio/mpeg"],
    [[255, 251, 144], "audio/mpeg"],
  ]
  for (const [bytes, type] of signatures) assert.equal(mediaType(new Uint8Array(bytes)), type)
  assert.equal(mediaType(new Uint8Array([255, 0, 0])), null)
  const normalized = await normalizeFile(
    new File([new Uint8Array([0, 0, 0, 0, 102, 116, 121, 112])], "song.mp3", { type: "audio/mpeg" }),
  )
  assert.equal(normalized.name, "song.m4a")
  assert.equal(normalized.type, "audio/mp4")
})
