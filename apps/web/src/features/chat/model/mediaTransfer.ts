import { createAudioStream, type AudioStream } from "./audioStream"
import { normalizeFile, mediaType } from "./mediaSignature"
import { record } from "../api/entrance"
import { newID } from "../../../shared/id"
export type SharedFile = {
  id: string
  author: string
  name: string
  type: string
  size: number
  url: string
  error: string
  progress: number
  status: "waiting" | "loading" | "ready"
}
type Transfer = {
  stream: AudioStream | null
  sender: string
  file: SharedFile
  chunks: Uint8Array<ArrayBuffer>[]
  size: number
  timer: ReturnType<typeof setTimeout>
  relay: boolean
}
type Peer = { pc: RTCPeerConnection; sender: string; id: string; timer: ReturnType<typeof setTimeout> }
const CHUNK = 18000
const MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/mp4",
  "audio/aac",
])
function valid(type: string, size: number) {
  return (
    MIME.has(type) &&
    Number.isSafeInteger(size) &&
    size > 0 &&
    size <= (type.startsWith("image/") ? 5_000_000 : 50_000_000)
  )
}
async function description(pc: RTCPeerConnection) {
  if (pc.iceGatheringState !== "complete")
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", check)
        reject(new Error("ICE unavailable"))
      }, 10000)
      function check() {
        if (pc.iceGatheringState === "complete") {
          clearTimeout(timer)
          pc.removeEventListener("icegatheringstatechange", check)
          resolve()
        }
      }
      pc.addEventListener("icegatheringstatechange", check)
      check()
    })
  return pc.localDescription?.sdp ?? ""
}
export class MediaTransfer {
  private stopped = false
  private streams = new Map<string, AudioStream>()
  private stream(id: string, type: string) {
    const value = createAudioStream(type)
    if (value) this.streams.set(id, value)
    return value
  }
  private stopStream(value: AudioStream | null) {
    if (value) {
      value.abort()
      for (const [id, stream] of this.streams) if (stream === value) this.streams.delete(id)
    }
  }
  private files = new Map<string, { file: File; timer: ReturnType<typeof setTimeout> }>()
  private cards = new Map<string, SharedFile>()
  private transfers = new Map<string, Transfer>()
  private peers = new Map<string, Peer>()
  private acknowledgements = new Map<string, (error?: Error) => void>()
  private urls = new Set<string>()
  constructor(
    private signal: (target: string, body: string) => boolean,
    private received: (file: SharedFile) => void,
    private fail: (message: string) => void,
    private removed: (id: string) => void = () => {},
  ) {}
  private emit(file: SharedFile) {
    if (this.stopped) return
    this.cards.set(file.id, file)
    this.received(file)
    // Bound both the visible history and the bytes retained by File/Blob/MSE.
    let bytes = [...this.cards.values()].reduce((sum, card) => sum + (card.status === "waiting" ? 0 : card.size), 0)
    for (const [id, card] of this.cards) {
      if (this.cards.size <= 20 && bytes <= 128 * 1024 * 1024) break
      bytes -= card.status === "waiting" ? 0 : card.size
      this.discard(id)
    }
  }
  private discard(id: string) {
    const card = this.cards.get(id)
    if (card?.url && this.urls.delete(card.url)) URL.revokeObjectURL(card.url)
    this.stopStream(this.streams.get(id) ?? null)
    clearTimeout(this.files.get(id)?.timer)
    clearTimeout(this.transfers.get(id)?.timer)
    this.files.delete(id)
    this.transfers.delete(id)
    for (const [key, peer] of this.peers) if (peer.id === id) this.close(key)
    for (const [key, finish] of this.acknowledgements)
      if (key.startsWith(`${id}:`)) finish(new Error("Файл больше недоступен."))
    this.cards.delete(id)
    this.removed(id)
  }
  private sendSignal(target: string, value: object) {
    if (this.stopped || !this.signal(target, JSON.stringify(value))) throw new Error("Связь прервалась.")
  }
  stop() {
    this.stopped = true
    for (const stream of this.streams.values()) stream.abort()
    this.streams.clear()
    for (const { timer } of this.files.values()) clearTimeout(timer)
    for (const { timer } of this.transfers.values()) clearTimeout(timer)
    for (const key of this.peers.keys()) this.close(key)
    for (const url of this.urls) URL.revokeObjectURL(url)
    this.urls.clear()
    this.files.clear()
    this.cards.clear()
    this.transfers.clear()
    for (const finish of this.acknowledgements.values()) finish(new Error("Передача файлов завершена."))
  }
  private close(key: string) {
    const p = this.peers.get(key)
    if (p) {
      this.peers.delete(key)
      clearTimeout(p.timer)
      p.pc.close()
    }
  }
  async share(file: File, author: string) {
    file = await normalizeFile(file)
    if (this.stopped) throw new Error("Передача файлов завершена.")
    if (!valid(file.type, file.size))
      throw new Error("Изображение: JPG, PNG или WebP до 5 МБ. Аудиофайл: MP3, OGG, WAV, M4A или AAC до 50 МБ.")
    if (Array.from(file.name).length > 120) throw new Error("Название файла должно быть не длиннее 120 символов.")
    const id = newID(),
      url = URL.createObjectURL(file)
    this.urls.add(url)
    const timer = setTimeout(
      () => {
        this.files.delete(id)
      },
      15 * 60 * 1000,
    )
    this.files.set(id, { file, timer })
    try {
      this.sendSignal("", { id, type: "announce", name: file.name, mime: file.type, size: file.size })
    } catch (error) {
      this.urls.delete(url)
      URL.revokeObjectURL(url)
      clearTimeout(timer)
      this.files.delete(id)
      throw error
    }
    this.emit({
      id,
      author,
      name: file.name,
      type: file.type,
      size: file.size,
      url,
      error: "",
      progress: 100,
      status: "ready",
    })
  }
  request(id: string) {
    const file = this.cards.get(id)
    if (!file || file.status === "ready" || this.transfers.has(id)) return
    const timer = setTimeout(() => {
      this.fallback(id)
    }, 20000)
    const stream = this.stream(id, file.type)
    const loading = { ...file, url: stream?.url ?? "", status: "loading" as const, error: "", progress: 0 }
    this.transfers.set(id, { stream, sender: file.author, file: loading, chunks: [], size: 0, timer, relay: false })
    this.emit(loading)
    try {
      this.sendSignal(file.author, { id, type: "request" })
    } catch {
      this.error(id, "Автор недоступен. Попробуй ещё раз.")
    }
  }
  private error(id: string, message: string) {
    const transfer = this.transfers.get(id)
    if (transfer) {
      clearTimeout(transfer.timer)
      this.stopStream(transfer.stream)
      this.transfers.delete(id)
      this.emit({ ...transfer.file, url: "", status: "waiting", error: message })
    }
    this.fail(message)
  }
  private fallback(id: string) {
    const t = this.transfers.get(id)
    if (!t || t.relay) return
    this.stopStream(t.stream)
    t.stream = this.stream(id, t.file.type)
    t.file = { ...t.file, url: t.stream?.url ?? "" }
    t.relay = true
    t.chunks = []
    t.size = 0
    this.close(id + ":" + t.sender)
    clearTimeout(t.timer)
    t.timer = setTimeout(() => {
      this.error(id, "Передача остановилась. Попробуй ещё раз.")
    }, 30000)
    try {
      this.sendSignal(t.sender, { id, type: "relay_request" })
    } catch {
      this.error(id, "Связь прервалась. Попробуй ещё раз.")
    }
  }
  private open(id: string, sender: string) {
    const key = id + ":" + sender
    this.close(key)
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] })
    const timer = setTimeout(() => {
      this.close(key)
    }, 30000)
    this.peers.set(key, { pc, sender, id, timer })
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        if (this.transfers.has(id)) this.fallback(id)
        this.close(key)
      }
    }
    return pc
  }
  async accept(sender: string, raw: string) {
    if (this.stopped) return
    const v: unknown = JSON.parse(raw)
    if (!record(v) || typeof v.id !== "string" || typeof v.type !== "string") return
    const id = v.id
    switch (v.type) {
      case "announce":
        if (
          typeof v.name === "string" &&
          typeof v.mime === "string" &&
          typeof v.size === "number" &&
          valid(v.mime, v.size)
        )
          this.emit({
            id,
            author: sender,
            name: v.name,
            type: v.mime,
            size: v.size,
            url: "",
            error: "",
            progress: 0,
            status: "waiting",
          })
        return
      case "request":
        await this.offer(id, sender)
        return
      case "relay_request":
        await this.relay(id, sender)
        return
      case "relay_ack":
        if (typeof v.index === "number") this.acknowledgements.get(`${id}:${sender}:${String(v.index)}`)?.()
        return
      case "relay_chunk":
        this.chunk(id, sender, v)
        return
      case "answer":
        if (typeof v.sdp === "string")
          await this.peers.get(id + ":" + sender)?.pc.setRemoteDescription({ type: "answer", sdp: v.sdp })
        return
      case "offer":
        if (typeof v.sdp === "string" && this.transfers.get(id)?.sender === sender && !this.transfers.get(id)?.relay)
          await this.answer(id, sender, v.sdp)
        return
    }
  }
  private async offer(id: string, sender: string) {
    const entry = this.files.get(id)
    if (!entry) return
    try {
      const pc = this.open(id, sender),
        channel = pc.createDataChannel("file", { ordered: true })
      channel.onopen = () => {
        void this.sendBytes(channel, entry.file).catch(() => {
          this.close(id + ":" + sender)
        })
      }
      await pc.setLocalDescription(await pc.createOffer())
      this.sendSignal(sender, { id, type: "offer", sdp: await description(pc) })
    } catch {
      this.close(id + ":" + sender)
    }
  }
  private async answer(id: string, sender: string, sdp: string) {
    try {
      const pc = this.open(id, sender)
      pc.ondatachannel = (event) => {
        const channel = event.channel
        channel.binaryType = "arraybuffer"
        channel.onmessage = (event: MessageEvent<unknown>) => {
          if (this.transfers.get(id)?.relay) return
          if (event.data instanceof ArrayBuffer) this.append(id, new Uint8Array(event.data))
          else if (event.data === "done") {
            this.complete(id)
            this.close(id + ":" + sender)
          }
        }
      }
      await pc.setRemoteDescription({ type: "offer", sdp })
      await pc.setLocalDescription(await pc.createAnswer())
      this.sendSignal(sender, { id, type: "answer", sdp: await description(pc) })
    } catch {
      this.fallback(id)
    }
  }
  private async sendBytes(channel: RTCDataChannel, file: File) {
    for (let offset = 0; offset < file.size; offset += 16384) {
      if (channel.bufferedAmount > 262144)
        await new Promise<void>((resolve, reject) => {
          channel.bufferedAmountLowThreshold = 65536
          const timer = setTimeout(() => {
            reject(new Error("timeout"))
          }, 15000)
          channel.onbufferedamountlow = () => {
            clearTimeout(timer)
            resolve()
          }
        })
      channel.send(await file.slice(offset, offset + 16384).arrayBuffer())
    }
    channel.send("done")
  }
  private append(id: string, bytes: Uint8Array<ArrayBuffer>) {
    const t = this.transfers.get(id)
    if (!t) return
    t.size += bytes.length
    if (t.size > t.file.size) {
      this.error(id, "Получен файл неверного размера.")
      return
    }
    t.chunks.push(bytes)
    t.stream?.append(bytes)
    clearTimeout(t.timer)
    t.timer = setTimeout(() => {
      if (t.relay) this.error(id, "Передача остановилась.")
      else this.fallback(id)
    }, 30000)
    this.emit({ ...t.file, status: "loading", progress: Math.floor((t.size / t.file.size) * 100) })
  }
  private complete(id: string) {
    const t = this.transfers.get(id)
    if (!t) return
    if (t.size !== t.file.size) {
      this.error(id, "Получен файл неверного размера.")
      return
    }
    clearTimeout(t.timer)
    this.transfers.delete(id)
    const signature = new Uint8Array(Math.min(t.size, 65536))
    let offset = 0
    for (const chunk of t.chunks) {
      const part = chunk.slice(0, signature.length - offset)
      signature.set(part, offset)
      offset += part.length
      if (offset === signature.length) break
    }
    if (mediaType(signature) !== t.file.type) {
      this.stopStream(t.stream)
      this.emit({ ...t.file, url: "", status: "waiting", error: "Полученный файл имеет неверный формат." })
      return
    }
    if (t.stream && !t.stream.failed) {
      t.stream.finish()
      this.emit({ ...t.file, status: "ready", progress: 100 })
      return
    }
    this.stopStream(t.stream)
    const url = URL.createObjectURL(new Blob(t.chunks, { type: t.file.type }))
    this.urls.add(url)
    this.emit({ ...t.file, url, status: "ready", progress: 100 })
  }
  private async relay(id: string, sender: string) {
    const entry = this.files.get(id)
    if (!entry) return
    const total = Math.ceil(entry.file.size / CHUNK)
    for (let index = 0; index < total; index++) {
      const bytes = new Uint8Array(await entry.file.slice(index * CHUNK, (index + 1) * CHUNK).arrayBuffer())
      const data = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
      const key = `${id}:${sender}:${String(index)}`
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.acknowledgements.delete(key)
          reject(new Error("Передача остановилась."))
        }, 30000)
        const finish = (error?: Error) => {
          clearTimeout(timer)
          this.acknowledgements.delete(key)
          if (error) reject(error)
          else resolve()
        }
        this.acknowledgements.set(key, finish)
        try {
          this.sendSignal(sender, { id, type: "relay_chunk", index, total, data })
        } catch (error) {
          finish(error instanceof Error ? error : new Error("Связь прервалась."))
        }
      })
    }
  }
  private chunk(id: string, sender: string, v: Record<string, unknown>) {
    const t = this.transfers.get(id)
    if (
      !t?.relay ||
      t.sender !== sender ||
      typeof v.data !== "string" ||
      v.index !== t.chunks.length ||
      v.total !== Math.ceil(t.file.size / CHUNK)
    )
      return
    const bytes = Uint8Array.from(atob(v.data), (c) => c.charCodeAt(0))
    if (bytes.length !== Math.min(CHUNK, t.file.size - t.size)) return
    this.append(id, bytes)
    this.sendSignal(sender, { id, type: "relay_ack", index: v.index })
    if (t.size === t.file.size) this.complete(id)
  }
}
