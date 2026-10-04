import type { Piece, Player, Action, Simulation } from "../api/protocol"
import { blocks } from "./pieces"

export function fits(player: Player, piece: Piece) {
  return blocks(piece).every(([x, y]) => x >= 0 && x < 10 && y >= 0 && y < 20 && player.cells[y]?.[x] === 0)
}
function ghost(player: Player) {
  let piece = { ...player.active }
  while (fits(player, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 }
  return piece
}
function draw(simulation: Simulation): number {
  if (!simulation.bag.length) {
    simulation.bag = [1, 2, 3, 4, 5, 6, 7]
    for (let i = 6; i > 0; i--) {
      let x = simulation.random
      x ^= x << 13
      x ^= x >>> 17
      x ^= x << 5
      simulation.random = x >>> 0
      const j = simulation.random % (i + 1)
      const a = simulation.bag[i],
        b = simulation.bag[j]
      if (a !== undefined && b !== undefined) {
        simulation.bag[i] = b
        simulation.bag[j] = a
      }
    }
  }
  return simulation.bag.shift() ?? 1
}
function setPiece(player: Player, simulation: Simulation, kind: number) {
  player.active = { kind, rotation: 0, x: 3, y: 0 }
  simulation.piece_id++
  simulation.fall_ms = simulation.lock_ms = simulation.resets = 0
  if (!fits(player, player.active)) player.dead = true
}
function spawn(player: Player, simulation: Simulation) {
  const kind = player.next.shift() ?? 1
  player.next.push(draw(simulation))
  setPiece(player, simulation, kind)
  player.can_hold = true
}
function move(player: Player, x: number, y: number) {
  const piece = { ...player.active, x: player.active.x + x, y: player.active.y + y }
  if (!fits(player, piece)) return false
  player.active = piece
  return true
}
function resetLock(simulation: Simulation) {
  if (simulation.resets < 15 && simulation.lock_ms > 0) {
    simulation.lock_ms = 0
    simulation.resets++
  }
}
function rotate(player: Player, simulation: Simulation, direction: number) {
  const rotated = { ...player.active, rotation: (player.active.rotation + direction + 4) % 4 }
  for (const [x, y] of [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-2, 0],
    [2, 0],
    [0, -1],
    [0, -2],
  ] as const) {
    const piece = { ...rotated, x: rotated.x + x, y: rotated.y + y }
    if (fits(player, piece)) {
      player.active = piece
      resetLock(simulation)
      break
    }
  }
}
function applyGarbage(player: Player, simulation: Simulation, cleared: number, elapsed: number) {
  let attack = [0, 0, 1, 2, 4][cleared] ?? 0
  while (simulation.pending.length && attack > 0) {
    const first = simulation.pending[0]
    if (!first) break
    const cancelled = Math.min(attack, first.lines)
    first.lines -= cancelled
    attack -= cancelled
    if (!first.lines) simulation.pending.shift()
  }
  while (simulation.pending[0] && simulation.pending[0].due <= elapsed) {
    const pending = simulation.pending.shift()
    if (!pending) break
    for (let i = 0; i < pending.lines; i++) {
      if (player.cells[0]?.some(Boolean)) player.dead = true
      player.cells.shift()
      player.cells.push(Array.from({ length: 10 }, (_, x) => (x === pending.hole ? 0 : 8)))
    }
    if (!fits(player, player.active)) player.dead = true
  }
  player.incoming = simulation.pending.reduce((sum, item) => sum + item.lines, 0)
}
function lock(player: Player, simulation: Simulation, elapsed: number) {
  for (const [x, y] of blocks(player.active)) {
    const row = player.cells[y]
    if (row) row[x] = player.active.kind
  }
  const remaining = player.cells.filter((row) => row.some((cell) => cell === 0))
  const cleared = 20 - remaining.length
  player.cells = [...Array.from({ length: cleared }, () => Array.from({ length: 10 }, () => 0)), ...remaining]
  const level = player.level
  simulation.combo = cleared ? simulation.combo + 1 : -1
  player.score += (([0, 100, 300, 500, 800][cleared] ?? 0) + 50 * Math.max(0, simulation.combo)) * level
  player.lines += cleared
  player.level = 1 + Math.floor(player.lines / 10)
  spawn(player, simulation)
  applyGarbage(player, simulation, cleared, elapsed)
}
function input(player: Player, simulation: Simulation, action: Action, elapsed: number) {
  switch (action) {
    case "left":
    case "right":
      if (move(player, action === "left" ? -1 : 1, 0)) resetLock(simulation)
      break
    case "down":
      if (move(player, 0, 1)) player.score++
      break
    case "rotate":
    case "counterrotate":
      rotate(player, simulation, action === "rotate" ? 1 : -1)
      break
    case "drop":
      while (move(player, 0, 1)) player.score += 2
      lock(player, simulation, elapsed)
      break
    case "hold":
      if (player.can_hold) {
        const previous = player.hold
        player.hold = player.active.kind
        if (previous) setPiece(player, simulation, previous)
        else spawn(player, simulation)
        player.can_hold = false
      }
      break
  }
}
// Pure transition: copies the checkpoint, never mutates the authoritative snapshot.
export function stepBoard(source: Player, action: Action | "tick", elapsed: number): Player {
  if (source.dead || !source.simulation) return source
  const simulation: Simulation = {
    ...source.simulation,
    bag: [...source.simulation.bag],
    pending: source.simulation.pending.map((item) => ({ ...item })),
  }
  const player = {
    ...source,
    active: { ...source.active },
    cells: source.cells.map((row) => [...row]),
    next: [...source.next],
    simulation,
  }
  if (action === "tick") {
    simulation.fall_ms += 50
    const interval = Math.max(70, 850 - (player.level - 1) * 60)
    if (simulation.fall_ms >= interval) {
      simulation.fall_ms -= interval
      move(player, 0, 1)
    }
    if (fits(player, { ...player.active, y: player.active.y + 1 })) simulation.lock_ms = 0
    else simulation.lock_ms += 50
    if (simulation.lock_ms >= 500) lock(player, simulation, elapsed)
  } else input(player, simulation, action, elapsed)
  player.ghost = ghost(player)
  return player
}
