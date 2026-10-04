import type { Action, Game } from "../api/protocol"
import { predict } from "./prediction"

export type Input = { type: Action; sequence: number; piece_id: number; at: number }
const horizonMS = 2000
// One ordered simulation timeline; transport and React are subscribers, never its clock.
export class GameStore {
  constructor(readonly identity = "") {}
  current: Game | null = null
  private confirmed: Game | null = null
  private ui: Game | null = null
  private uiKey = ""
  private listeners = new Set<() => void>()
  private pending: Input[] = []
  private sequence = 0
  private receivedAt = 0
  private lastFrame = 0
  private remainder = 0
  private online = false
  private stalled = false
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  getSnapshot = () => this.ui
  getConnectionSnapshot = () => this.online && (!!this.current?.client_clock || !this.stalled)
  private publish() {
    const game = this.current
    const key =
      game &&
      JSON.stringify({
        status: game.status,
        paused: game.paused,
        self: game.self,
        host: game.host,
        countdown: game.countdown,
        players: game.players.map((p) => [
          p.id,
          p.nickname,
          p.registered,
          p.ready,
          p.connected,
          p.dead,
          p.place,
          p.score,
          p.lines,
          p.level,
          p.next,
          p.hold,
          p.can_hold,
          p.incoming,
          p.target,
          p.simulation?.piece_id,
        ]),
      })
    if (key !== this.uiKey) {
      this.uiKey = key ?? ""
      this.ui = game
    }
    this.listeners.forEach((listener) => {
      listener()
    })
  }
  receive(game: Game, now: number) {
    if (this.identity && game.id !== this.identity) return
    if (this.confirmed && game.revision < this.confirmed.revision) return
    const local = game.client_clock && this.current?.client_clock && this.current.status === "running"
    const first = !this.online && !local
    const old = this.current
    const self = game.players.find((player) => player.id === game.self)
    this.sequence = Math.max(this.sequence, self?.sequence ?? 0)
    this.pending = first ? [] : this.pending.filter((input) => input.sequence > (self?.sequence ?? 0))
    this.confirmed = game
    if (local && this.current) {
      this.online = true
      // Acknowledgements retire journal entries; they never move the live solo board.
      if (game.status === "finished" || game.status === "cancelled") {
        this.current = game
        this.pending = []
      }
      this.publish()
      return
    }
    this.online = true
    this.stalled = false
    this.receivedAt = this.lastFrame = now
    this.remainder = 0
    const target =
      first || game.status !== "running" || game.paused
        ? game.elapsed_ms
        : Math.max(game.elapsed_ms, Math.min(old?.elapsed_ms ?? 0, game.elapsed_ms + horizonMS))
    let state = game
    for (const input of this.pending) {
      state = this.advance(state, Math.min(target, Math.max(state.elapsed_ms, input.at)))
      state = predict(state, input.type, input.piece_id)
    }
    this.current = this.advance(state, target)
    if (game.status === "finished" || game.status === "cancelled" || self?.dead) this.pending = []
    this.publish()
  }
  private advance(game: Game, target: number) {
    let state = game
    while (
      state.status === "running" &&
      !state.paused &&
      state.elapsed_ms + 50 <= target &&
      !(state.client_clock && state.players.find((p) => p.id === state.self)?.dead)
    )
      state = predict(state, "tick")
    return state
  }
  frame(now: number) {
    const delta = Math.min(250, Math.max(0, now - this.lastFrame))
    this.lastFrame = now
    if (
      this.online &&
      !this.current?.client_clock &&
      this.current?.status === "running" &&
      !this.current.paused &&
      now - this.receivedAt > horizonMS &&
      !this.stalled
    ) {
      this.stalled = true
      this.publish()
    }
    if (
      !this.current ||
      (!this.current.client_clock && (!this.online || now - this.receivedAt > horizonMS)) ||
      this.current.paused ||
      this.current.status !== "running"
    )
      return
    this.remainder += delta
    const ticks = Math.floor(this.remainder / 50)
    if (!ticks) return
    this.remainder -= ticks * 50
    this.current = this.advance(this.current, this.current.elapsed_ms + ticks * 50)
    this.publish()
  }
  input(type: Action, now: number): Input | null {
    if (!this.current || (!this.current.client_clock && (!this.online || this.pending.length >= 80))) return null
    if (
      !this.current.client_clock &&
      this.current.status === "running" &&
      !this.current.paused &&
      now - this.receivedAt > horizonMS
    )
      return null
    const game = this.current
    const player = game.players.find((p) => p.id === game.self)
    const administrative = ["join", "ready", "unready", "start", "leave"].includes(type)
    if (!administrative && (game.status !== "running" || !player || player.dead || (game.paused && type !== "pause")))
      return null
    this.frame(now)
    const input = {
      type,
      sequence: ++this.sequence,
      piece_id: this.current.players.find((p) => p.id === game.self)?.simulation?.piece_id ?? 0,
      at: this.current.elapsed_ms,
    }
    if (!administrative) {
      this.pending.push(input)
      this.current = predict(this.current, type, input.piece_id)
      this.publish()
    }
    return input
  }
  replay() {
    const game = this.current
    const confirmed = this.confirmed
    if (!game?.client_clock || !confirmed || game.status !== "running") return null
    const through = Math.min(game.elapsed_ms, confirmed.elapsed_ms + 10000)
    const eligible = this.pending.filter((input) => input.at <= through)
    const inputs = eligible.slice(0, 128)
    const next = eligible[128]
    const through_ms = next ? Math.min(through, next.at) : through
    if (!inputs.length && through_ms <= confirmed.elapsed_ms) return null
    return { type: "replay" as const, through_ms, inputs: inputs.map(({ at, ...input }) => ({ ...input, at_ms: at })) }
  }
  disconnect() {
    this.online = false
    if (!this.current?.client_clock) this.pending = []
    this.remainder = 0
    this.publish()
    // Multiplayer drops stale input; local solo retains its ordered replay journal.
  }
  reject() {
    if (this.current?.client_clock)
      this.sequence = this.confirmed?.players.find((p) => p.id === this.confirmed?.self)?.sequence ?? 0
    this.pending = []
    this.current = this.confirmed
    this.publish()
  }
}
