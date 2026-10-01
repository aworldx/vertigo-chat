import { expect, type Page } from "@playwright/test"

export async function prepareGalleryFallback(page: Page) {
  const base64 = await page.evaluate(() => {
    const encoder = document.createElement("canvas")
    const original = encoder.toBlob.bind(encoder)
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      encoder.width = this.width
      encoder.height = this.height
      const context = encoder.getContext("2d")
      if (!context) throw new Error("Canvas unavailable")
      context.drawImage(this, 0, 0)
      original(callback, type === "image/webp" ? "image/png" : type, quality)
    }
    const canvas = document.createElement("canvas")
    canvas.width = 1200
    canvas.height = 1600
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas unavailable")
    const pixels = context.createImageData(canvas.width, canvas.height)
    let seed = 7
    for (let i = 0; i < pixels.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        pixels.data[i + channel] = seed >>> 24
      }
      pixels.data[i + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    return canvas.toDataURL("image/png").split(",")[1]
  })
  if (!base64) throw new Error("Missing generated photo")
  const buffer = Buffer.from(base64, "base64")
  expect(buffer.length).toBeGreaterThan(2_000_000)
  await page.locator("#gallery-photo-file").setInputFiles({ name: "large-photo.png", mimeType: "image/png", buffer })
}

export async function verifyGalleryFallback(page: Page) {
  for (const [path, limit] of [
    ["/gallery/photos/3", 2_000_000],
    ["/gallery/photos/3/thumbnail", 300_000],
  ] as const) {
    const response = await page.request.get(new URL(path, page.url()).href)
    expect(response.ok()).toBe(true)
    expect(response.headers()["content-type"]).toBe("image/jpeg")
    const bytes = await response.body()
    expect(bytes.length).toBeLessThanOrEqual(limit)
    expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff")
  }
  await expect(page.locator("#gallery-upload-error")).toHaveCount(0)
  await page.reload()
  await expect(page.locator("#photos-3 img")).toBeVisible()
  await expect
    .poll(() =>
      page.locator("#photos-3 img").evaluate((image) => (image instanceof HTMLImageElement ? image.naturalWidth : 0)),
    )
    .toBe(360)
}
