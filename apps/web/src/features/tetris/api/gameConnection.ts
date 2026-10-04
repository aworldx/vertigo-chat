import { record } from "../../../shared/api/json"
import { isGame, type Game } from "./protocol"
import type { Action } from "./protocol"
type Input = { type: Action; sequence: number; piece_id: number }

type Events = { state: (game: Game) => void; error: (message: string) => void; connection: (online: boolean) => void }
export class GameConnection {
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private stopped = false
  private terminal = false
  private ready = false
  private joined = false
  private sentAt: number[] = []
  constructor(
    private id: string,
    private token: string,
    private join: boolean,
    private events: Events,
  ) {}
  start() {
    window.addEventListener("online", this.online)
    window.addEventListener("offline", this.offline)
    this.connect()
  }
  stop() {
    this.stopped = true
    clearTimeout(this.timer)
    window.removeEventListener("online", this.online)
    window.removeEventListener("offline", this.offline)
    this.socket?.close()
    this.socket = null
  }
  private offline = () => {
    clearTimeout(this.timer)
    this.ready = false
    this.events.connection(false)
    const previous = this.socket
    this.socket = null
    previous?.close()
  }
  private online = () => {
    if (this.terminal || this.ready || this.stopped) return
    clearTimeout(this.timer)
    this.connect()
  }
  private connect() {
    if (this.stopped || !navigator.onLine) return
    this.ready = false
    const url = new URL(`/api/v1/tetris/${encodeURIComponent(this.id)}/socket`, window.location.origin)
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
    const socket = new WebSocket(url)
    this.socket = socket
    socket.onopen = () => {
      if (!this.stopped && this.socket === socket)
        socket.send(JSON.stringify({ type: "auth", token: this.token, client_clock: true }))
    }
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (this.stopped || this.socket !== socket || typeof event.data !== "string") return
      let value: unknown
      try {
        value = JSON.parse(event.data)
      } catch {
        return
      }
      if (!record(value)) return
      if (value.type === "error" && typeof value.message === "string") {
        this.events.error(value.message)
        return
      }
      if (value.type !== "state" || !isGame(value.game)) return
      this.ready = true
      this.events.state(value.game)
      this.events.connection(true)
      if (this.join && !this.joined && !value.game.self) {
        this.joined = true
        socket.send(JSON.stringify({ type: "join", sequence: 0 }))
      }
    }
    socket.onclose = (event) => {
      if (this.stopped || this.socket !== socket) return
      this.ready = false
      this.events.connection(false)
      if (event.code === 1008 || event.code === 1000) {
        this.terminal = true
        this.events.error(event.reason || "Соединение закрыто. Открой игру заново.")
      } else
        this.timer = setTimeout(() => {
          this.connect()
        }, 1000)
    }
  }
  available(now: number) {
    this.sentAt = this.sentAt.filter((at) => now - at < 1000)
    return (
      this.ready &&
      !this.terminal &&
      this.socket?.readyState === WebSocket.OPEN &&
      this.socket.bufferedAmount < 16384 &&
      this.sentAt.length < 35
    )
  }
  replay(batch: { type: "replay"; through_ms: number; inputs: (Input & { at_ms: number })[] }, now: number) {
    if (!this.available(now) || !this.socket) return false
    this.socket.send(JSON.stringify(batch))
    this.sentAt.push(now)
    return true
  }
  send(input: Input, now: number) {
    if (!this.available(now) || !this.socket) return false
    // No paced queue: input goes to the socket in the same turn as prediction.
    this.socket.send(JSON.stringify({ type: input.type, sequence: input.sequence, piece_id: input.piece_id }))
    this.sentAt.push(now)
    return true
  }
}
