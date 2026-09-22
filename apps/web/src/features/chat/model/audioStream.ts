export function createAudioStream(type: string) {
  if (
    type === "audio/mp4" ||
    !type.startsWith("audio/") ||
    typeof MediaSource === "undefined" ||
    !MediaSource.isTypeSupported(type)
  )
    return null
  const source = new MediaSource()
  const url = URL.createObjectURL(source)
  const queue: Uint8Array<ArrayBuffer>[] = []
  let buffer: SourceBuffer | null = null
  let complete = false,
    failed = false,
    stopped = false
  const pump = () => {
    if (stopped || failed || !buffer || buffer.updating || source.readyState !== "open") return
    const bytes = queue.shift()
    try {
      if (bytes) buffer.appendBuffer(bytes)
      else if (complete) source.endOfStream()
    } catch {
      failed = true
      queue.length = 0
    }
  }
  source.addEventListener(
    "sourceopen",
    () => {
      if (stopped) return
      try {
        buffer = source.addSourceBuffer(type)
        buffer.mode = "sequence"
        buffer.addEventListener("updateend", pump)
        buffer.addEventListener("error", () => {
          failed = true
          queue.length = 0
        })
        pump()
      } catch {
        failed = true
        queue.length = 0
      }
    },
    { once: true },
  )
  return {
    url,
    get failed() {
      return failed
    },
    append(bytes: Uint8Array<ArrayBuffer>) {
      if (!failed && !stopped) {
        queue.push(bytes)
        pump()
      }
    },
    finish() {
      complete = true
      pump()
    },
    abort() {
      stopped = true
      queue.length = 0
      if (source.readyState === "open") {
        try {
          buffer?.abort()
        } catch {
          /* A detached media element has already released its buffer. */
        }
      }
      URL.revokeObjectURL(url)
    },
  }
}
export type AudioStream = NonNullable<ReturnType<typeof createAudioStream>>
