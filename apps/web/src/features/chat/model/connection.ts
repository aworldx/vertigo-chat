import { decodeFrame, socketURL, type Frame, type Snapshot } from "../api/protocol"
import { readSession, clearSession, readOutbox, saveOutbox, type PendingMessage } from "./storage"
export type RoomState = {
  status: "loading" | "ready" | "reconnecting" | "ended" | "duplicate"
  nickname: string
  error: string
  snapshot: Snapshot
  outbox: PendingMessage[]
}
export class ChatConnection {
  private state: RoomState = {
    status: "loading",
    nickname: "",
    error: "",
    snapshot: { messages: [], peers: [] },
    outbox: [],
  }
  private listeners = new Set<() => void>()
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopped = false
  private leaving = false
  private token = ""
  private retry = 0
  private release: (() => void) | undefined
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.state
  private update(patch: Partial<RoomState>) {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  start() {
    const session = readSession()
    if (!session) {
      this.update({ status: "ended" })
      return
    }
    this.token = session.resume_token
    this.update({ nickname: session.nickname, outbox: readOutbox() })
    if ("locks" in navigator) {
      void navigator.locks
        .request(`vertigo-chat-${session.nickname}`, { ifAvailable: true }, async (lock) => {
          if (this.stopped) return
          if (!lock) {
            this.update({
              status: "duplicate",
              error: "Чат уже открыт в другой вкладке. Вернись в неё, чтобы продолжить.",
            })
            return
          }
          await new Promise<void>((resolve) => {
            this.release = resolve
            this.connect()
          })
        })
        .catch(() => {
          if (!this.stopped) this.update({ status: "ended", error: "Не удалось открыть сессию вкладки." })
        })
    } else this.connect()
    document.addEventListener("visibilitychange", this.visibility)
    window.addEventListener("offline", this.offline)
    window.addEventListener("online", this.online)
  }
  stop() {
    this.stopped = true
    clearTimeout(this.timer)
    this.socket?.close()
    this.release?.()
    document.removeEventListener("visibilitychange", this.visibility)
    window.removeEventListener("offline", this.offline)
    window.removeEventListener("online", this.online)
  }
  private offline = () => {
    this.socket?.close()
    this.update({
      status: "reconnecting",
      outbox: this.state.outbox.map((item) => (item.state === "failed" ? item : { ...item, state: "retrying" })),
    })
  }
  private online = () => {
    clearTimeout(this.timer)
    this.retry = 0
    this.connect()
  }
  private visibility = () => {
    this.write({ type: "heartbeat", visibility: document.visibilityState })
  }
  private write(command: object) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(command))
      return true
    }
    return false
  }
  private connect() {
    if (this.stopped) return
    if (!navigator.onLine) return
    const socket = new WebSocket(socketURL())
    this.socket = socket
    socket.onopen = () => {
      this.write({ type: "resume", resume_token: this.token })
    }
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== "string") return
      const frame = decodeFrame(event.data)
      if (frame) this.receive(frame)
    }
    socket.onclose = (event) => {
      if (this.stopped || this.socket !== socket) return
      if (event.code === 1008) {
        clearSession()
        this.update({ status: "ended", error: "Сессия завершена. Войди в чат снова." })
        return
      }
      this.update({
        status: "reconnecting",
        outbox: this.state.outbox.map((item) => (item.state === "failed" ? item : { ...item, state: "retrying" })),
      })
      this.timer = setTimeout(
        () => {
          this.connect()
        },
        Math.min(1000 * 2 ** this.retry++, 10000),
      )
    }
  }
  private receive(frame: Frame) {
    switch (frame.type) {
      case "ready":
        this.retry = 0
        this.update({ status: "ready", error: "", snapshot: frame.snapshot })
        this.visibility()
        if (this.leaving) {
          this.write({ type: "leave" })
          return
        }
        for (const item of this.state.outbox) if (item.state !== "failed") this.write({ type: "send", ...item })
        break
      case "snapshot":
        this.update({ snapshot: frame.snapshot })
        break
      case "ack": {
        const outbox = this.state.outbox.filter((item) => item.client_id !== frame.message.client_id)
        saveOutbox(outbox)
        const messages = [...this.state.snapshot.messages.filter((item) => item.id !== frame.message.id), frame.message]
          .sort((a, b) => a.id - b.id)
          .slice(-30)
        this.update({ outbox, snapshot: { ...this.state.snapshot, messages } })
        break
      }
      case "error": {
        const outbox = this.state.outbox.map((item) =>
          item.client_id === frame.client_id ? { ...item, state: "failed" as const } : item,
        )
        saveOutbox(outbox)
        this.update({ outbox, error: "Не удалось отправить сообщение. Проверь текст и повтори." })
        break
      }
      case "left":
        this.stop()
        window.location.assign("/")
        break
    }
  }
  send(body: string) {
    body = body.trim()
    if (!body) return false
    const item: PendingMessage = {
      client_id: crypto.randomUUID(),
      body,
      state: this.state.status === "ready" ? "sending" : "retrying",
    }
    const outbox = [...this.state.outbox, item]
    try {
      saveOutbox(outbox)
    } catch {
      this.update({ error: "Разреши хранение данных вкладки, чтобы отправить сообщение." })
      return false
    }
    this.update({ outbox, error: "" })
    if (this.state.status === "ready") this.write({ type: "send", ...item })
    return true
  }
  retryMessage(clientID: string) {
    const outbox = this.state.outbox.map((item) =>
      item.client_id === clientID ? { ...item, state: "retrying" as const } : item,
    )
    saveOutbox(outbox)
    this.update({ outbox, error: "" })
    const item = outbox.find((item) => item.client_id === clientID)
    if (item && this.state.status === "ready") this.write({ type: "send", ...item })
  }
  leave() {
    clearSession()
    this.leaving = true
    this.update({ outbox: [], error: "" })
    if (this.state.status === "ready") this.write({ type: "leave" })
  }
}
