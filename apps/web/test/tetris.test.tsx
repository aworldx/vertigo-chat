import assert from "node:assert/strict"
import { afterEach, test } from "node:test"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import { record } from "../src/shared/api/json"
import { blocks } from "../src/features/tetris/model/pieces"
import { isGame, type Game, type Player } from "../src/features/tetris/api/protocol"
import { predict } from "../src/features/tetris/model/prediction"
import { boardSounds } from "../src/features/tetris/model/soundEvents"
import { useControls } from "../src/features/tetris/model/useControls"

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  IS_REACT_ACT_ENVIRONMENT: true,
})
const React = (await import("react")).default
const { render, fireEvent, cleanup, renderHook, act } = await import("@testing-library/react")
const { GameInvitation } = await import("../src/features/chat/ui/GameInvitation")
const { GameNavigation } = await import("../src/shared/gameNavigation")
const { useRoomCommands } = await import("../src/features/chat/model/useRoomCommands")
afterEach(cleanup)
function player(): Player {
  return {
    id: "self",
    nickname: "Игрок",
    registered: true,
    ready: true,
    connected: true,
    dead: false,
    place: 0,
    score: 0,
    lines: 0,
    level: 1,
    cells: Array.from({ length: 20 }, () => Array.from({ length: 10 }, () => 0)),
    active: { kind: 3, rotation: 0, x: 3, y: 0 },
    ghost: { kind: 3, rotation: 0, x: 3, y: 18 },
    next: [1, 2, 3, 4, 5, 6],
    hold: 0,
    can_hold: true,
    incoming: 0,
    target: "",
    sequence: 0,
  }
}
function game(): Game {
  return {
    id: "a".repeat(32),
    code: "ЛИСА-27",
    mode: "solo",
    status: "running",
    self: "self",
    host: "self",
    paused: false,
    countdown: 0,
    elapsed_ms: 0,
    players: [player()],
  }
}
test("sounds distinguish confirmed locks and clears from movement, hold and repeated snapshots", () => {
  const before = player()
  assert.deepEqual(boardSounds(before, { ...before, active: { ...before.active, x: 4 } }), [])
  assert.deepEqual(boardSounds(before, { ...before, active: { ...before.active, kind: 1 } }), [])
  const cells = before.cells.map((row) => [...row])
  const bottom = cells[19]
  assert.ok(bottom)
  bottom[4] = 3
  const locked = { ...before, cells }
  assert.deepEqual(boardSounds(before, locked), ["lock"])
  assert.deepEqual(boardSounds(locked, { ...locked }), [])
  assert.deepEqual(boardSounds(before, { ...locked, lines: 2, incoming: 2 }), ["clear", "attack"])
  assert.deepEqual(boardSounds(before, { ...locked, id: "different-match" }), [])
})
test("held movement responds immediately and keeps repeating across state updates", (t) => {
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout"] })
  const sent: string[] = []
  const { result, rerender, unmount } = renderHook(
    ({ version }) =>
      useControls(true, (action) => {
        sent.push(`${String(version)}:${action}`)
      }),
    { initialProps: { version: 1 } },
  )
  act(() => {
    result.current.press("left")
  })
  assert.deepEqual(sent, ["1:left"])
  rerender({ version: 2 })
  act(() => {
    t.mock.timers.tick(150)
  })
  assert.deepEqual(sent, ["1:left", "2:left"])
  act(() => {
    t.mock.timers.tick(45)
  })
  assert.equal(sent.length, 3)
  act(() => {
    result.current.stop()
    t.mock.timers.tick(500)
  })
  assert.equal(sent.length, 3)
  unmount()
})
test("keyboard input follows the game window and ignores its form controls", () => {
  const frame = document.createElement("iframe")
  document.body.append(frame)
  const child = frame.contentWindow
  assert.ok(child)
  const sent: string[] = []
  const hook = renderHook(() =>
    useControls(
      true,
      (action) => {
        sent.push(action)
      },
      child,
    ),
  )
  fireEvent.keyDown(window, { code: "ArrowLeft" })
  assert.deepEqual(sent, [])
  fireEvent.keyDown(child, { code: "ArrowRight" })
  fireEvent.keyUp(child, { code: "ArrowRight" })
  assert.deepEqual(sent, ["right"])
  const input = child.document.createElement("input")
  const button = child.document.createElement("button")
  child.document.body.append(input, button)
  fireEvent.keyDown(input, { code: "ArrowLeft" })
  fireEvent.keyDown(button, { code: "Space" })
  assert.deepEqual(sent, ["right"])
  hook.unmount()
  fireEvent.keyDown(child, { code: "ArrowLeft" })
  assert.deepEqual(sent, ["right"])
  frame.remove()
})
test("client piece coordinates match the server fixtures", () => {
  const fixtures: unknown = JSON.parse(
    readFileSync(new URL("../../../contracts/fixtures/tetris-pieces.json", import.meta.url), "utf8"),
  )
  assert.ok(Array.isArray(fixtures))
  for (const fixture of fixtures) {
    assert.ok(record(fixture) && record(fixture.piece))
    const p = fixture.piece
    assert.ok(
      typeof p.kind === "number" &&
        typeof p.rotation === "number" &&
        typeof p.x === "number" &&
        typeof p.y === "number",
    )
    assert.deepEqual(blocks({ kind: p.kind, rotation: p.rotation, x: p.x, y: p.y }), fixture.cells)
  }
})
test("input prediction respects walls and does not mutate authoritative score or board", () => {
  const original = game()
  const originalPlayer = original.players[0]
  assert.ok(originalPlayer)
  let state = original
  for (let i = 0; i < 20; i++) state = predict(state, "left")
  const p = state.players[0]
  assert.ok(p)
  assert.equal(p.active.x, 0)
  assert.equal(originalPlayer.active.x, 3)
  state = predict(state, "rotate")
  assert.equal(state.players[0]?.active.rotation, 1)
  state = predict(state, "drop")
  assert.equal(state.players[0]?.active.y, state.players[0]?.ghost.y)
  const dropped = state.players[0]
  assert.ok(dropped)
  assert.deepEqual(dropped.cells, originalPlayer.cells)
  assert.equal(dropped.score, 0)
  assert.equal(predict({ ...original, paused: true }, "left").players[0]?.active.x, 3)
})
test("protocol rejects malformed board, pieces and counter values", () => {
  const value = game()
  assert.ok(isGame(value))
  assert.equal(isGame({ ...value, players: [{ ...player(), cells: [[0]] }] }), false)
  assert.equal(isGame({ ...value, players: [{ ...player(), active: { kind: 99, rotation: 0, x: 0, y: 0 } }] }), false)
  assert.equal(isGame({ ...value, elapsed_ms: -1 }), false)
})
test("one invitation closes joining at capacity and keeps spectators", () => {
  const calls: { id: string; join: boolean }[] = []
  const id = "b".repeat(32)
  const show = (players: string[], status = "lobby") => (
    <GameNavigation.Provider
      value={(id, join) => {
        calls.push({ id, join })
      }}
    >
      <GameInvitation author="Луна" body={JSON.stringify({ id, code: "ЛУНА-36", status, players })} />
    </GameNavigation.Provider>
  )
  const view = render(show(["Луна"]))
  fireEvent.click(view.getByRole("button", { name: "Присоединиться" }))
  assert.deepEqual(calls, [{ id, join: true }])
  view.rerender(show(["Луна", "Марк", "Амир"]))
  assert.equal(view.queryByRole("button", { name: "Присоединиться" }), null)
  fireEvent.click(view.getByRole("button", { name: "Наблюдать" }))
  assert.deepEqual(calls[1], { id, join: false })
  view.rerender(show(["Луна", "Марк"], "running"))
  assert.equal(view.queryByRole("button", { name: "Присоединиться" }), null)
  view.rerender(show(["Луна", "Марк"], "cancelled"))
  assert.equal(view.queryByRole("button", { name: "Наблюдать" }), null)
})
test("slash commands dispatch solo, memorable code and rankings without becoming chat text", () => {
  const commands: string[] = []
  const { result } = renderHook(() =>
    useRoomCommands(
      [],
      [],
      () => undefined,
      () => undefined,
      () => undefined,
      () => {
        commands.push("settings")
      },
      (argument) => {
        commands.push(argument)
      },
    ),
  )
  act(() => {
    for (const command of ["/тетрис", "/тетрис соло", "/тетрис ЛИСА-27", "/тетрис топ"])
      assert.equal(result.current.execute(command), true)
  })
  act(() => {
    assert.equal(result.current.execute("/настройки"), true)
    assert.equal(result.current.execute("/настройки лишнее"), true)
  })
  assert.deepEqual(commands, ["", "соло", "ЛИСА-27", "топ", "settings"])
})

test("reconnect preserves local input and resends only unacknowledged sequences", async (t) => {
  const { useGame } = await import("../src/features/tetris/model/useGame")
  const onlineDescriptor = Object.getOwnPropertyDescriptor(navigator, "onLine")
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true })
  t.after(() => {
    if (onlineDescriptor) Object.defineProperty(navigator, "onLine", onlineDescriptor)
    else Reflect.deleteProperty(navigator, "onLine")
  })
  const sockets: FakeSocket[] = []
  class FakeSocket {
    static OPEN = 1
    readyState = 1
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: ((event: { code: number; reason: string }) => void) | null = null
    sent: { type: string; sequence?: number }[] = []
    constructor() {
      sockets.push(this)
    }
    send(value: string) {
      this.sent.push(JSON.parse(value) as { type: string; sequence?: number })
    }
    close() {
      this.readyState = 3
    }
    state(value: Game) {
      this.onmessage?.({ data: JSON.stringify({ type: "state", game: value }) })
    }
  }
  const originalSocket = globalThis.WebSocket
  Object.defineProperty(globalThis, "WebSocket", { value: FakeSocket, configurable: true, writable: true })
  t.after(() => {
    Object.defineProperty(globalThis, "WebSocket", { value: originalSocket, configurable: true, writable: true })
  })
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] })
  const view = renderHook(() => useGame("a".repeat(32), "token", false))
  const first = sockets[0]
  assert.ok(first)
  act(() => {
    first.onopen?.()
    first.state(game())
    view.result.current.send("left")
  })
  assert.equal(view.result.current.game?.players[0]?.active.x, 2)
  act(() => {
    t.mock.timers.tick(35)
  })
  assert.equal(first.sent.filter((entry) => entry.type === "left").length, 1)
  act(() => {
    first.close()
    first.onclose?.({ code: 1006, reason: "" })
    view.result.current.send("left")
  })
  assert.equal(view.result.current.game.players[0].active.x, 1)
  act(() => {
    t.mock.timers.tick(1000)
  })
  const second = sockets[1]
  assert.ok(second)
  const confirmed = game()
  const self = confirmed.players[0]
  assert.ok(self)
  self.sequence = 1
  self.active.x = 2
  act(() => {
    second.onopen?.()
    second.state(confirmed)
    t.mock.timers.tick(35)
  })
  assert.equal(view.result.current.game.players[0].active.x, 1)
  assert.deepEqual(
    second.sent.filter((entry) => entry.type === "left"),
    [{ type: "left", sequence: 2 }],
  )
  view.unmount()
})

test("changing a dialog callback does not steal game focus", async () => {
  const { Modal } = await import("../src/shared/ui/Modal")
  const show = () => (
    <Modal id="test-dialog" labelId="title" className="" onClose={() => undefined}>
      <button>Close</button>
      <button data-testid="field">Field</button>
    </Modal>
  )
  const view = render(show())
  const field = view.getByTestId("field")
  field.focus()
  view.rerender(show())
  assert.equal(document.activeElement, field)
})
