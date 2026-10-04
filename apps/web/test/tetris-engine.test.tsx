import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { record } from "../src/shared/api/json"
import { isGame, type Game, type Player, type Action } from "../src/features/tetris/api/protocol"
import { predict } from "../src/features/tetris/model/prediction"
import { GameStore } from "../src/features/tetris/model/gameStore"

const raw: unknown = JSON.parse(
  readFileSync(new URL("../../../contracts/fixtures/tetris-simulation.json", import.meta.url), "utf8"),
)
assert.ok(Array.isArray(raw))
const first: unknown = raw[0]
assert.ok(record(first) && isGame(first.initial))
const initial: Game = first.initial
function self(game: Game | null) {
  assert.ok(game)
  const p = game.players[0]
  assert.ok(p)
  return p
}
function board(p: Player | undefined) {
  assert.ok(p)
  return {
    active: p.active,
    ghost: p.ghost,
    cells: p.cells,
    next: p.next,
    hold: p.hold,
    can_hold: p.can_hold,
    dead: p.dead,
    score: p.score,
    lines: p.lines,
    level: p.level,
    incoming: p.incoming,
    simulation: p.simulation,
  }
}
test("TypeScript matches Go checkpoints: gravity, lock, rotations, hold, clears, combo, garbage and top-out", () => {
  for (const value of raw) {
    assert.ok(record(value) && isGame(value.initial) && Array.isArray(value.steps))
    let current = value.initial
    for (const step of value.steps) {
      assert.ok(record(step) && typeof step.action === "string" && typeof step.count === "number" && isGame(step.game))
      assert.ok(
        ["tick", "left", "right", "down", "rotate", "counterrotate", "drop", "hold", "pause"].includes(step.action),
      )
      for (let i = 0; i < step.count; i++) current = predict(current, step.action as Action | "tick")
      assert.deepEqual(board(current.players[0]), board(step.game.players[0]), `${String(value.name)}: ${step.action}`)
      current = { ...current, status: step.game.status }
    }
  }
})
test("hard drop locks and spawns before acknowledgement; following rotation cannot alter locked cells", () => {
  const before = structuredClone(initial)
  const dropped = predict(initial, "drop")
  assert.equal(self(dropped).simulation?.piece_id, (self(initial).simulation?.piece_id ?? 0) + 1)
  assert.equal(self(dropped).active.y, 0)
  assert.notDeepEqual(self(dropped).cells, self(initial).cells)
  const rotated = predict(dropped, "rotate")
  assert.deepEqual(self(rotated).cells, self(dropped).cells)
  assert.deepEqual(initial, before)
})
test("local simulation advances during delayed snapshots and rejects stale revisions", () => {
  const store = new GameStore()
  store.receive(initial, 0)
  for (let now = 50; now <= 900; now += 50) store.frame(now)
  assert.ok((store.current?.players[0]?.active.y ?? 0) > self(initial).active.y)
  const input = store.input("drop", 901)
  assert.ok(input)
  const cells = store.current?.players[0]?.cells
  store.receive({ ...initial, revision: 10 }, 950)
  assert.deepEqual(store.current?.players[0]?.cells, cells)
  store.receive({ ...initial, revision: 9 }, 1000)
  assert.deepEqual(store.current?.players[0]?.cells, cells)
  store.disconnect()
  assert.equal(store.input("rotate", 1001), null)
  store.receive({ ...initial, revision: 11 }, 1100)
  assert.deepEqual(store.current?.players[0]?.cells, self(initial).cells)
})
test("reconciliation never replays an input into the successor of its target piece", () => {
  const store = new GameStore()
  store.receive(initial, 0)
  assert.ok(store.input("rotate", 1))
  store.receive({ ...predict(initial, "drop"), revision: 100 }, 50)
  assert.equal(store.current?.players[0]?.active.rotation, 0)
})
test("predictive horizon bounds work after suspension and fresh snapshots resume the clock", () => {
  const store = new GameStore()
  store.receive(initial, 0)
  store.frame(60000)
  assert.equal(store.current?.elapsed_ms, initial.elapsed_ms)
  assert.equal(store.input("drop", 60001), null)
  store.receive({ ...initial, revision: initial.revision + 1 }, 60002)
  store.frame(60052)
  assert.equal(store.current.elapsed_ms, initial.elapsed_ms + 50)
})

test("idle lobby and long solo pause remain controllable; stalled live play reports synchronization", () => {
  const store = new GameStore()
  store.receive({ ...initial, status: "lobby" }, 0)
  assert.ok(store.input("ready", 30000))
  store.receive({ ...initial, revision: 100, paused: true }, 30001)
  const pause = store.input("pause", 60000)
  assert.ok(pause)
  const acknowledged = {
    ...initial,
    players: initial.players.map((player) => ({ ...player, sequence: pause.sequence })),
  }
  store.receive({ ...acknowledged, revision: 101 }, 60001)
  store.frame(63000)
  assert.equal(store.getConnectionSnapshot(), false)
  assert.equal(store.input("drop", 63001), null)
  store.receive({ ...acknowledged, revision: 102 }, 63002)
  assert.equal(store.getConnectionSnapshot(), true)
})
