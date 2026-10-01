function blob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value)
        else reject(new Error("invalid_photo"))
      },
      type,
      quality,
    )
  })
}
async function encode(canvas: HTMLCanvasElement, quality: number, limit: number): Promise<Blob> {
  const webp = await blob(canvas, "image/webp", quality)
  if (webp.type === "image/webp" && webp.size <= limit) return webp
  // Safari can return PNG when WebP encoding is unavailable. JPEG needs an opaque background.
  const context = canvas.getContext("2d")
  if (!context) throw new Error("invalid_photo")
  context.save()
  context.globalCompositeOperation = "destination-over"
  context.fillStyle = "#fff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.restore()
  for (const level of [quality, 0.65, 0.45]) {
    const jpeg = await blob(canvas, "image/jpeg", level)
    if (jpeg.type !== "image/jpeg") throw new Error("invalid_photo")
    if (jpeg.size <= limit) return jpeg
  }
  throw new Error("photo_too_large")
}
function resize(image: ImageBitmap, max: number) {
  const scale = Math.min(1, max / image.width, max / image.height),
    canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("invalid_photo")
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas
}
export async function compress(file: File) {
  const image = await createImageBitmap(file).catch(() => {
    throw new Error("invalid_photo")
  })
  try {
    return await Promise.all([encode(resize(image, 1600), 0.82, 2_000_000), encode(resize(image, 480), 0.72, 300_000)])
  } finally {
    image.close()
  }
}
