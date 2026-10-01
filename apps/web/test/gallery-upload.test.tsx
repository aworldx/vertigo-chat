import assert from "node:assert/strict"
import { test, type TestContext } from "node:test"
import { JSDOM } from "jsdom"
import { compress } from "../src/features/gallery/model/compress"
import { galleryError, uploadPhoto } from "../src/features/gallery/api/gallery"

const dom = new JSDOM("<html><body></body></html>")
Object.assign(globalThis, { document: dom.window.document, createImageBitmap: async () => ({}) })
function setup(t: TestContext, encode: (type: string, quality: number) => Blob | null) {
  const close = t.mock.fn<() => void>()
  const fillRect = t.mock.fn<(x: number, y: number, width: number, height: number) => void>()
  t.mock.method(globalThis, "createImageBitmap", async () => ({ width: 3024, height: 4032, close }))
  t.mock.method(dom.window.HTMLCanvasElement.prototype, "getContext", () => ({
    drawImage() {},
    save() {},
    restore() {},
    fillRect,
  }))
  t.mock.method(
    dom.window.HTMLCanvasElement.prototype,
    "toBlob",
    (callback: BlobCallback, type: string, quality: number) => {
      callback(encode(type, quality))
    },
  )
  return { close, fillRect }
}
const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" })
function image(type: string, size = 100) {
  return new Blob([new Uint8Array(size)], { type })
}
test("gallery keeps supported WebP and releases the decoded bitmap", async (t) => {
  const { close, fillRect } = setup(t, (type) => image(type))
  const result = await compress(file)
  assert.deepEqual(
    result.map((value) => value.type),
    ["image/webp", "image/webp"],
  )
  assert.equal(fillRect.mock.callCount(), 0)
  assert.equal(close.mock.callCount(), 1)
})
test("gallery replaces Safari PNG fallback with opaque JPEG within both upload limits", async (t) => {
  const { close, fillRect } = setup(t, (type) => image(type === "image/webp" ? "image/png" : type))
  const result = await compress(file)
  assert.deepEqual(
    result.map((value) => value.type),
    ["image/jpeg", "image/jpeg"],
  )
  assert.deepEqual(
    fillRect.mock.calls.map((call) => call.arguments),
    [
      [0, 0, 1200, 1600],
      [0, 0, 360, 480],
    ],
  )
  assert.equal(close.mock.callCount(), 1)
})
test("gallery lowers JPEG quality when encoded images exceed the server limits", async (t) => {
  setup(t, (type, quality) => image(type, quality > 0.45 ? 2_000_001 : 100))
  const result = await compress(file)
  assert.deepEqual(
    result.map((value) => [value.type, value.size]),
    [
      ["image/jpeg", 100],
      ["image/jpeg", 100],
    ],
  )
})
test("gallery rejects oversized output with a size error and releases the bitmap", async (t) => {
  const { close } = setup(t, (type) => image(type, 2_000_001))
  await assert.rejects(compress(file), { message: "photo_too_large" })
  assert.match(galleryError(new Error("photo_too_large")), /меньшего размера/)
  assert.equal(close.mock.callCount(), 1)
})
test("gallery rejects an empty encoder result", async (t) => {
  const { close } = setup(t, () => null)
  await assert.rejects(compress(file), { message: "invalid_photo" })
  assert.equal(close.mock.callCount(), 1)
})
test("gallery maps browser decoding failures to the readable image error", async (t) => {
  t.mock.method(globalThis, "createImageBitmap", () => Promise.reject(new Error("decode failed")))
  await assert.rejects(compress(file), { message: "invalid_photo" })
})
test("gallery sends filenames matching each encoded image format", async (t) => {
  const bodies: FormData[] = []
  t.mock.method(globalThis, "fetch", (_url: string, options: RequestInit) => {
    assert.ok(options.body instanceof FormData)
    bodies.push(options.body)
    return Promise.resolve(new Response('{"id":1}', { status: 201 }))
  })
  await uploadPhoto(image("image/jpeg"), image("image/webp"), "Мандарины", "csrf")
  const body = bodies[0]
  assert.ok(body)
  for (const [field, name, type] of [
    ["image", "photo.jpg", "image/jpeg"],
    ["thumbnail", "thumbnail.webp", "image/webp"],
  ]) {
    assert.ok(field)
    const value = body.get(field)
    assert.ok(value instanceof File)
    assert.equal(value.name, name)
    assert.equal(value.type, type)
  }
})
