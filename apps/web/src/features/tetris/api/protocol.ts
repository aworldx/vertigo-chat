import { record } from "../../../shared/api/json"
import type { components } from "../../../shared/generated/tetris"

export type Game = components["schemas"]["TetrisGame"]
export type Player = components["schemas"]["TetrisPlayer"]
export type Simulation = components["schemas"]["TetrisSimulation"]
export type Piece = components["schemas"]["TetrisPiece"]
export type Leader = components["schemas"]["TetrisLeader"]
export type Action =
  | "left"
  | "right"
  | "down"
  | "rotate"
  | "counterrotate"
  | "drop"
  | "hold"
  | "pause"
  | "join"
  | "ready"
  | "unready"
  | "start"
  | "leave"
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max
function piece(v: unknown): v is Piece {
  return record(v) && integer(v.kind, 1, 7) && integer(v.rotation, 0, 3) && integer(v.x, -4, 10) && integer(v.y, -4, 20)
}
function simulation(v: unknown): v is Simulation {
  return (
    record(v) &&
    integer(v.piece_id, 1) &&
    integer(v.fall_ms) &&
    integer(v.lock_ms, 0, 500) &&
    integer(v.resets, 0, 15) &&
    integer(v.combo, -1) &&
    integer(v.random, 1, 4294967295) &&
    Array.isArray(v.bag) &&
    v.bag.length <= 7 &&
    v.bag.every((kind: unknown) => integer(kind, 1, 7)) &&
    Array.isArray(v.pending) &&
    v.pending.every(
      (item: unknown) => record(item) && integer(item.lines, 1) && integer(item.due) && integer(item.hole, 0, 9),
    )
  )
}
function player(v: unknown): v is Player {
  return (
    record(v) &&
    typeof v.id === "string" &&
    typeof v.nickname === "string" &&
    typeof v.registered === "boolean" &&
    typeof v.ready === "boolean" &&
    typeof v.connected === "boolean" &&
    typeof v.dead === "boolean" &&
    integer(v.place, 0, 3) &&
    integer(v.score) &&
    integer(v.lines) &&
    integer(v.level, 1) &&
    integer(v.hold, 0, 7) &&
    typeof v.can_hold === "boolean" &&
    integer(v.incoming) &&
    typeof v.target === "string" &&
    integer(v.sequence) &&
    (v.simulation === undefined || simulation(v.simulation)) &&
    piece(v.active) &&
    piece(v.ghost) &&
    Array.isArray(v.next) &&
    v.next.length >= 5 &&
    v.next.length <= 6 &&
    v.next.every((n: unknown) => integer(n, 1, 7)) &&
    Array.isArray(v.cells) &&
    v.cells.length === 20 &&
    v.cells.every(
      (row: unknown) => Array.isArray(row) && row.length === 10 && row.every((n: unknown) => integer(n, 0, 8)),
    )
  )
}
export function isGame(v: unknown): v is Game {
  return (
    record(v) &&
    typeof v.id === "string" &&
    /^[a-f0-9]{32}$/u.test(v.id) &&
    typeof v.code === "string" &&
    (v.mode === "solo" || v.mode === "versus") &&
    ["lobby", "countdown", "running", "finished", "cancelled"].includes(String(v.status)) &&
    typeof v.self === "string" &&
    typeof v.host === "string" &&
    typeof v.paused === "boolean" &&
    integer(v.countdown, 0, 3) &&
    integer(v.elapsed_ms) &&
    integer(v.revision) &&
    Array.isArray(v.players) &&
    v.players.length <= 3 &&
    v.players.every(player)
  )
}
export function isLeader(v: unknown): v is Leader {
  return (
    record(v) &&
    typeof v.nickname === "string" &&
    integer(v.rating, -100000) &&
    integer(v.score) &&
    integer(v.lines) &&
    integer(v.level) &&
    integer(v.matches) &&
    integer(v.wins) &&
    typeof v.achieved_at === "string" &&
    Number.isFinite(Date.parse(v.achieved_at))
  )
}
