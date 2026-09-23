import { newID } from "../../../shared/id"
import type { MediaItem } from "../api/media"
import { defaultPreferences, type Preferences } from "../api/preferences"
import { type Frame, type Snapshot } from "../api/protocol"
import { readSession, clearSession, readOutbox, saveOutbox, type PendingMessage } from "./storage"
import { transitionPendingDelivery } from "./delivery"
import { addTimelineEntry, publishTimeline, setTimelineDelivery, type TimelineEntry } from "./timeline"
import { SocketTransport } from "./socketTransport"
export type RoomState = {
  karmikMood: "resting" | "happy" | "angry"
  status: "loading" | "ready" | "reconnecting" | "ended" | "duplicate"
  nickname: string
  generation: number
  ephemeral: Snapshot["messages"]
  error: string
  snapshot: Snapshot
  outbox: PendingMessage[]
  timeline: TimelineEntry[]
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
    timeline: [],
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
    const previous = new Set(this.state.timeline.map((entry) => entry.message.id))
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
  private stopped = false
  private lastTyping = 0
  private leaving = false
  private release: (() => void) | undefined
  private transport = new SocketTransport({
    opened: () => undefined,
    frame: (frame) => {
      this.receive(frame)
    },
    closed: (code) => {
      this.disconnected(code)
    },
  })
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
    const outbox = readOutbox()
    this.update({
      nickname: session.nickname,
      outbox,
      timeline: outbox.map((item) => this.pendingTimelineEntry(item, session.nickname)),
    })
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
            this.transport.start(session.resume_token)
          })
        })
        .catch(() => {
          if (!this.stopped) this.update({ status: "ended", error: "Не удалось открыть сессию вкладки." })
        })
    } else this.transport.start(session.resume_token)
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
    this.transport.stop()
    this.release?.()
    document.removeEventListener("visibilitychange", this.visibility)
    window.removeEventListener("offline", this.offline)
    window.removeEventListener("online", this.online)
  }
  private offline = () => {
    this.transport.disconnect()
    const outbox = this.state.outbox.map((item) =>
      item.state === "failed" || item.state === "blocked" || item.state === "confirmed"
        ? item
        : { ...item, state: "retrying" as const },
    )
    this.update({
      status: "reconnecting",
      outbox,
      timeline: outbox.reduce(
        (timeline, item) => setTimelineDelivery(timeline, item.client_id, item.state),
        this.state.timeline,
      ),
    })
  }
  private online = () => {
    this.transport.reconnect()
  }
  private visibility = () => {
    this.write({ type: "heartbeat", visibility: document.visibilityState })
  }
  private write(command: object) {
    return this.transport.send(command)
  }
  private disconnected(code: number) {
    if (this.stopped) return
    this.preferenceReply?.reject(new Error("Связь прервалась. Повтори сохранение после подключения."))
    this.preferenceReply = undefined
    if (code === 1008) {
      clearSession()
      this.update({ status: "ended", error: "Сессия завершена. Войди в чат снова." })
      return
    }
    const outbox = this.state.outbox.map((item) =>
      item.state === "failed" || item.state === "blocked" || item.state === "confirmed"
        ? item
        : { ...item, state: "retrying" as const },
    )
    this.update({
      status: "reconnecting",
      outbox,
      timeline: outbox.reduce(
        (timeline, item) => setTimelineDelivery(timeline, item.client_id, item.state),
        this.state.timeline,
      ),
    })
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
        this.update({
          status: "ready",
          error: "",
          snapshot: frame.snapshot,
          timeline: publishTimeline(this.state.timeline, frame.snapshot.messages),
          generation: frame.generation,
        })
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
        this.update({
          snapshot: frame.snapshot,
          timeline: publishTimeline(this.state.timeline, frame.snapshot.messages),
        })
        this.reconcile(frame.snapshot)
        break
      case "private":
        this.update({
          ephemeral: [...this.state.ephemeral.filter((m) => m.id !== frame.message.id), frame.message].slice(-100),
        })
        break
      case "ack": {
        this.clearAcknowledgement(frame.message.client_id)
        if (frame.message.kind === "private") {
          const outbox = this.state.outbox.filter((item) => item.client_id !== frame.message.client_id)
          saveOutbox(outbox)
          this.update({
            outbox,
            ephemeral: [...this.state.ephemeral.filter((m) => m.id !== frame.message.id), frame.message].slice(-100),
          })
          break
        }
        const outbox = this.state.outbox.filter((item) => item.client_id !== frame.message.client_id)
        saveOutbox(outbox)
        this.update({
          outbox,
          timeline: addTimelineEntry(this.state.timeline, {
            key: `client:${frame.message.client_id}`,
            message: frame.message,
            delivery: "confirmed",
          }),
        })
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
            ? {
                ...item,
                state: transitionPendingDelivery(item.state, frame.code === "rate_limited" ? "block" : "fail"),
              }
            : item,
        )
        saveOutbox(outbox)
        this.update({
          outbox,
          timeline: setTimelineDelivery(
            this.state.timeline,
            frame.client_id,
            frame.code === "rate_limited" ? "blocked" : "failed",
          ),
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
    if (item.state === "blocked" || item.state === "failed" || item.state === "confirmed") return
    const outbox = this.state.outbox.map((pending) =>
      pending.client_id === item.client_id ? { ...pending, state: "sending" as const } : pending,
    )
    saveOutbox(outbox)
    this.update({ outbox, timeline: setTimelineDelivery(this.state.timeline, item.client_id, "sending") })
    const sending = outbox.find((pending) => pending.client_id === item.client_id)
    if (!sending || !this.write({ type: "send", ...sending })) return
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
        this.update({ outbox, timeline: setTimelineDelivery(this.state.timeline, item.client_id, "retrying") })
      }, 10000),
    )
  }
  private reconcile(snapshot: Snapshot) {
    const waiting = new Set(this.state.outbox.map((item) => item.client_id))
    const ids = new Set(
      snapshot.messages
        .filter((message) => message.author === this.state.nickname && waiting.has(message.client_id))
        .map((message) => message.client_id),
    )
    for (const id of ids) this.clearAcknowledgement(id)
    const outbox = this.state.outbox.filter((item) => !ids.has(item.client_id))
    const timeline = [...ids].reduce(
      (entries, clientID) => setTimelineDelivery(entries, clientID, "published"),
      this.state.timeline,
    )
    if (ids.size > 0) {
      saveOutbox(outbox)
      this.update({ outbox, timeline })
    }
  }
  private pendingTimelineEntry(item: PendingMessage, nickname: string): TimelineEntry {
    const preferences = this.state.snapshot.preferences
    return {
      key: `client:${item.client_id}`,
      delivery: item.state,
      message: {
        id: 0,
        client_id: item.client_id,
        kind: "text",
        author: nickname,
        body: item.body,
        sent_at: item.sent_at,
        recipient: "",
        reactions: {},
        reacted: [],
        appearance: preferences.appearance,
        font_id: preferences.font_id,
        font_style: preferences.font_style,
      },
    }
  }
  send(body: string) {
    body = body.trim()
    if (!body) return false
    const item: PendingMessage = {
      client_id: newID(),
      body,
      sent_at: new Date().toISOString(),
      state: this.state.status === "ready" ? "sending" : "retrying",
    }
    const outbox = [...this.state.outbox, item].slice(-50)
    try {
      saveOutbox(outbox)
    } catch {
      this.update({ error: "Разреши хранение данных вкладки, чтобы отправить сообщение." })
      return false
    }
    this.update({
      outbox,
      timeline: addTimelineEntry(this.state.timeline, this.pendingTimelineEntry(item, this.state.nickname)),
      error: "",
    })
    if (this.state.status === "ready") this.transmit(item)
    return true
  }
  retryMessage(clientID: string) {
    const outbox = this.state.outbox.map((item) =>
      item.client_id === clientID ? { ...item, state: "retrying" as const } : item,
    )
    saveOutbox(outbox)
    this.update({ outbox, timeline: setTimelineDelivery(this.state.timeline, clientID, "sending"), error: "" })
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
    this.update({
      outbox,
      timeline: this.state.timeline.filter((entry) => entry.message.client_id !== clientID),
      error: "",
    })
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
    this.update({ status: "reconnecting" })
    this.transport.replaceToken(token)
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
