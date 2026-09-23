function blob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value)
        else reject(new Error("invalid_photo"))
      },
      "image/webp",
      quality,
    )
  })
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
  const image = await createImageBitmap(file)
  try {
    return await Promise.all([blob(resize(image, 1600), 0.82), blob(resize(image, 480), 0.72)])
  } finally {
    image.close()
  }
}
