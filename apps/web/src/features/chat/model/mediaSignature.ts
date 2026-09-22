export function mediaType(bytes: Uint8Array): string | null {
  const at = (values: number[], offset = 0) => values.every((value, index) => bytes[offset + index] === value)
  if (at([255, 216, 255])) return "image/jpeg"
  if (at([137, 80, 78, 71, 13, 10, 26, 10])) return "image/png"
  if (at([82, 73, 70, 70]) && at([87, 69, 66, 80], 8)) return "image/webp"
  if (at([79, 103, 103, 83])) return "audio/ogg"
  if (at([82, 73, 70, 70]) && at([87, 65, 86, 69], 8)) return "audio/wav"
  if (at([102, 116, 121, 112], 4)) return "audio/mp4"
  if (bytes[0] === 255 && (bytes[1] === 241 || bytes[1] === 249)) return "audio/aac"
  for (let offset = 0; offset <= bytes.length - 3; offset++) {
    if (at([73, 68, 51], offset)) return "audio/mpeg"
    const second = bytes[offset + 1] ?? 0,
      third = bytes[offset + 2] ?? 0
    if (
      bytes[offset] === 255 &&
      (second & 224) === 224 &&
      ((second >> 3) & 3) !== 1 &&
      ((second >> 1) & 3) !== 0 &&
      third >> 4 !== 0 &&
      third >> 4 !== 15 &&
      ((third >> 2) & 3) !== 3
    )
      return "audio/mpeg"
  }
  return null
}
export async function normalizeFile(file: File) {
  const type = mediaType(new Uint8Array(await file.slice(0, 65536).arrayBuffer()))
  if (!type || (type !== file.type && !(type.startsWith("audio/") && file.type.startsWith("audio/"))))
    throw new Error("Содержимое файла не соответствует заявленному формату.")
  return new File([file], type === "audio/mp4" ? file.name.replace(/\.[^.]*$/u, "") + ".m4a" : file.name, {
    type,
    lastModified: file.lastModified,
  })
}
