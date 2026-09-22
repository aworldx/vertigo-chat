import { newID } from "../../../shared/id"
import type { MediaItem } from "../api/media"
import { defaultPreferences, type Preferences } from "../api/preferences"
import { decodeFrame, socketURL, type Frame, type Snapshot } from "../api/protocol"
import { readSession, clearSession, readOutbox, saveOutbox, type PendingMessage } from "./storage"
export type RoomState = {
  karmikMood: "resting" | "happy" | "angry"
  status: "loading" | "ready" | "reconnecting" | "ended" | "duplicate"
  nickname: string
  generation: number
  ephemeral: Snapshot["messages"]
  error: string
  snapshot: Snapshot
  outbox: PendingMessage[]
}
export class ChatConnection {
  private state: RoomState = {
    karmikMood: "resting",
    status: "loading",
    nickname: "",
    generation: 0,
    ephemeral: [],
    error: "",
    snapshot: { messages: [], peers: [], preferences: defaultPreferences, admin: false, typing: [] },
    outbox: [],
  }
  private karmikTimer: ReturnType<typeof setTimeout> | undefined
  petKarmik() {
    this.showKarmik("happy")
  }
  private showKarmik(mood: "happy" | "angry") {
    clearTimeout(this.karmikTimer)
    this.update({ karmikMood: mood })
    this.karmikTimer = setTimeout(() => {
      this.update({ karmikMood: "resting" })
    }, 8000)
  }
  private observeKarmik(snapshot: Snapshot) {
    const previous = new Set(this.state.snapshot.messages.map((message) => message.id))
    for (const message of snapshot.messages) {
      if (message.kind !== "system" || previous.has(message.id)) continue
      if (message.body.startsWith("Кармик варит для ")) this.showKarmik("happy")
      if (message.body.startsWith("Кармик сердито машет хвостом:")) this.showKarmik("angry")
    }
  }
  private preferenceReply: { resolve: (value: Preferences) => void; reject: (error: Error) => void } | undefined
  private acknowledgements = new Map<string, ReturnType<typeof setTimeout>>()
  private listeningTrack = ""
  listening(track: string, active: boolean) {
    if (!active && this.listeningTrack !== track) return
    this.listeningTrack = active ? Array.from(track.trim()).slice(0, 200).join("") : ""
    this.write({ type: "listening", body: track, active })
  }
  private listeningChannel: BroadcastChannel | undefined
  private signals = new Set<(sender: string, body: string) => void>()
  subscribeSignal = (listener: (sender: string, body: string) => void) => {
    this.signals.add(listener)
    return () => {
      this.signals.delete(listener)
    }
  }
  signal(target: string, body: string) {
    return this.write({ type: "signal", target, body })
  }
  private listeners = new Set<() => void>()
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopped = false
  private lastTyping = 0
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
    this.listeningChannel = new BroadcastChannel("vertigo-listening")
    this.listeningChannel.onmessage = (event: MessageEvent<unknown>) => {
      const value = event.data
      if (
        typeof value === "object" &&
        value !== null &&
        "nickname" in value &&
        value.nickname === this.state.nickname &&
        "track" in value &&
        typeof value.track === "string" &&
        "active" in value &&
        typeof value.active === "boolean"
      )
        this.listening(value.track, value.active)
    }
    document.addEventListener("visibilitychange", this.visibility)
    window.addEventListener("offline", this.offline)
    window.addEventListener("online", this.online)
  }
  stop() {
    this.stopped = true
    clearTimeout(this.karmikTimer)
    for (const timer of this.acknowledgements.values()) clearTimeout(timer)
    this.acknowledgements.clear()
    this.listeningChannel?.close()
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
      outbox: this.state.outbox.map((item) =>
        item.state === "failed" || item.state === "blocked" || item.state === "confirmed"
          ? item
          : { ...item, state: "retrying" },
      ),
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
      this.preferenceReply?.reject(new Error("Связь прервалась. Повтори сохранение после подключения."))
      this.preferenceReply = undefined
      if (event.code === 1008) {
        clearSession()
        this.update({ status: "ended", error: "Сессия завершена. Войди в чат снова." })
        return
      }
      this.update({
        status: "reconnecting",
        outbox: this.state.outbox.map((item) =>
          item.state === "failed" || item.state === "blocked" || item.state === "confirmed"
            ? item
            : { ...item, state: "retrying" },
        ),
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
      case "signal":
        for (const listener of this.signals) listener(frame.sender, frame.body)
        break
      case "preferences":
        this.update({ snapshot: { ...this.state.snapshot, preferences: frame.preferences } })
        this.preferenceReply?.resolve(frame.preferences)
        this.preferenceReply = undefined
        break
      case "ready":
        if (this.listeningTrack) this.write({ type: "listening", body: this.listeningTrack, active: true })
        this.retry = 0
        this.update({ status: "ready", error: "", snapshot: frame.snapshot, generation: frame.generation })
        this.reconcile(frame.snapshot)
        this.visibility()
        if (this.leaving) {
          this.write({ type: "leave" })
          return
        }
        for (const item of this.state.outbox)
          if (item.state !== "failed" && item.state !== "blocked" && item.state !== "confirmed") this.transmit(item)
        break
      case "snapshot":
        this.observeKarmik(frame.snapshot)
        this.update({ snapshot: frame.snapshot })
        this.reconcile(frame.snapshot)
        break
      case "private":
        this.update({
          ephemeral: [...this.state.ephemeral.filter((m) => m.id !== frame.message.id), frame.message].slice(-100),
        })
        break
      case "ack": {
        this.clearAcknowledgement(frame.message.client_id)
        const outbox = this.state.outbox.filter((item) => item.client_id !== frame.message.client_id)
        saveOutbox(outbox)
        if (frame.message.kind === "private") {
          this.update({
            outbox,
            ephemeral: [...this.state.ephemeral.filter((m) => m.id !== frame.message.id), frame.message].slice(-100),
          })
          break
        }
        const confirmed = this.state.outbox.map((item) =>
          item.client_id === frame.message.client_id ? { ...item, state: "confirmed" as const } : item,
        )
        saveOutbox(confirmed)
        this.update({ outbox: confirmed })
        this.reconcile(this.state.snapshot)
        break
      }
      case "error": {
        if (frame.client_id) this.clearAcknowledgement(frame.client_id)
        if (frame.code.startsWith("preferences_")) {
          this.preferenceReply?.reject(new Error("Не удалось сохранить настройки. Повтори попытку."))
          this.preferenceReply = undefined
          return
        }
        const outbox = this.state.outbox.map((item) =>
          item.client_id === frame.client_id
            ? { ...item, state: frame.code === "rate_limited" ? ("blocked" as const) : ("failed" as const) }
            : item,
        )
        saveOutbox(outbox)
        this.update({
          outbox,
          error:
            frame.code === "rate_limited"
              ? "Заблокировано лимитом — сообщение видно только вам"
              : frame.code === "private_unavailable"
                ? "Личное сообщение не доставлено. Проверь, что собеседник в сети, и повтори."
                : "Не удалось выполнить действие. Проверь данные и повтори.",
        })
        break
      }
      case "left":
        this.stop()
        window.location.assign("/")
        break
    }
  }
  private clearAcknowledgement(id: string) {
    clearTimeout(this.acknowledgements.get(id))
    this.acknowledgements.delete(id)
  }
  private transmit(item: PendingMessage) {
    if (!this.write({ type: "send", ...item })) return
    this.clearAcknowledgement(item.client_id)
    this.acknowledgements.set(
      item.client_id,
      setTimeout(() => {
        this.acknowledgements.delete(item.client_id)
        const outbox = this.state.outbox.map((pending) =>
          pending.client_id === item.client_id && pending.state === "sending"
            ? { ...pending, state: "retrying" as const }
            : pending,
        )
        saveOutbox(outbox)
        this.update({ outbox })
      }, 10000),
    )
  }
  private reconcile(snapshot: Snapshot) {
    const ids = new Set(
      snapshot.messages.filter((message) => message.author === this.state.nickname).map((message) => message.client_id),
    )
    for (const id of ids) this.clearAcknowledgement(id)
    const outbox = this.state.outbox.filter((item) => !ids.has(item.client_id))
    if (outbox.length !== this.state.outbox.length) {
      saveOutbox(outbox)
      this.update({ outbox })
    }
  }
  send(body: string) {
    body = body.trim()
    if (!body) return false
    const item: PendingMessage = {
      client_id: newID(),
      body,
      state: this.state.status === "ready" ? "sending" : "retrying",
    }
    const outbox = [...this.state.outbox, item].slice(-50)
    try {
      saveOutbox(outbox)
    } catch {
      this.update({ error: "Разреши хранение данных вкладки, чтобы отправить сообщение." })
      return false
    }
    this.update({ outbox, error: "" })
    if (this.state.status === "ready") this.transmit(item)
    return true
  }
  retryMessage(clientID: string) {
    const outbox = this.state.outbox.map((item) =>
      item.client_id === clientID ? { ...item, state: "retrying" as const } : item,
    )
    saveOutbox(outbox)
    this.update({ outbox, error: "" })
    const item = outbox.find((item) => item.client_id === clientID)
    if (item && this.state.status === "ready") this.transmit(item)
  }
  cancelMessage(clientID: string) {
    const outbox = this.state.outbox.filter((item) => item.client_id !== clientID || item.state !== "failed")
    try {
      saveOutbox(outbox)
    } catch {
      this.update({ error: "Не удалось изменить очередь. Разреши хранение данных вкладки." })
      return
    }
    this.update({ outbox, error: "" })
  }
  sendMedia(media: MediaItem) {
    this.write({ type: "media", client_id: newID(), media })
  }
  setReaction(messageID: number, emoji: string, active: boolean) {
    this.write({ type: "reaction", message_id: messageID, emoji, active })
  }
  deleteMessage(messageID: number) {
    this.write({ type: "delete", message_id: messageID })
  }
  typing(active: boolean) {
    if (active && Date.now() - this.lastTyping < 2000) return
    this.lastTyping = Date.now()
    this.write({ type: "typing", active })
  }
  replaceCredential(token: string) {
    const old = this.socket
    this.socket = null
    old?.close()
    clearTimeout(this.timer)
    this.token = token
    this.update({ status: "reconnecting" })
    this.connect()
  }
  savePreferences(preferences: Preferences): Promise<Preferences> {
    if (this.state.status !== "ready" || this.preferenceReply)
      return Promise.reject(new Error("Дождись подключения к чату."))
    return new Promise((resolve, reject) => {
      this.preferenceReply = { resolve, reject }
      if (!this.write({ type: "preferences", preferences })) {
        this.preferenceReply = undefined
        reject(new Error("Нет связи. Повтори сохранение после подключения."))
      }
    })
  }
  leave() {
    clearSession()
    this.leaving = true
    this.update({ outbox: [], error: "" })
    if (this.state.status === "ready") this.write({ type: "leave" })
  }
}
