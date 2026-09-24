import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { JSDOM } from "jsdom"
import { ChatConnection } from "../src/features/chat/model/connection"
import { saveSession, readOutbox, readSession } from "../src/features/chat/model/storage"
import { defaultPreferences } from "../src/features/chat/api/preferences"
import type { Frame, Message, Snapshot } from "../src/features/chat/api/protocol"
class SocketStub {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: SocketStub[] = []
  readyState = SocketStub.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  constructor(readonly url: string) {
    SocketStub.instances.push(this)
  }
  send(data: string) {
    this.sent.push(data)
  }
  open() {
    this.readyState = SocketStub.OPEN
    this.onopen?.()
  }
  close(code = 1000) {
    this.readyState = SocketStub.CLOSED
    this.onclose?.({ code })
  }
}

class ChannelStub {
  onmessage: ((event: { data: unknown }) => void) | null = null
  close() {}
}
const keys = ["window", "document", "navigator", "sessionStorage", "WebSocket", "BroadcastChannel"]
const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
let dom: JSDOM
let connections: ChatConnection[] = []
beforeEach(() => {
  dom = new JSDOM("<html></html>", { url: "https://chat.example" })
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: { onLine: true },
    sessionStorage: dom.window.sessionStorage,
    WebSocket: SocketStub,
    BroadcastChannel: ChannelStub,
  }))
    Object.defineProperty(globalThis, key, { configurable: true, value })
  SocketStub.instances = []
  connections = []
})
afterEach(() => {
  for (const connection of connections) connection.stop()
  dom.window.close()
  for (const [key, descriptor] of descriptors)
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
})
const snapshot: Snapshot = { messages: [], peers: [], preferences: defaultPreferences, admin: false, typing: [] }
function fixture(ready = true) {
  saveSession({ nickname: "Alice", resume_token: "credential" })
  const connection = new ChatConnection()
  connections.push(connection)
  connection.start()
  const socket = SocketStub.instances.at(-1)
  assert.ok(socket)
  const receive = (frame: Frame) => socket.onmessage?.({ data: JSON.stringify(frame) })
  socket.open()
  if (ready) receive({ type: "ready", snapshot, connection_id: "connection", generation: 1 })
  return { connection, socket, receive }
}
function message(clientID: string, id = 1, author = "Alice"): Message {
  return {
    id,
    client_id: clientID,
    author,
    kind: "text",
    body: "Hello",
    recipient: "",
    reactions: {},
    reacted: [],
    sent_at: new Date().toISOString(),
    appearance: defaultPreferences.appearance,
    font_id: "theme",
    font_style: "normal",
  }
}

test("a full offline outbox rejects the next message without losing any pending message", () => {
  const { connection } = fixture(false)
  assert.equal(connection.send("  "), false)
  for (let i = 0; i < 50; i++) assert.equal(connection.send(`message ${String(i)}`), true)
  assert.equal(connection.send("message 51"), false)
  assert.equal(connection.getSnapshot().outbox.length, 50)
  assert.equal(connection.getSnapshot().outbox[0]?.body, "message 0")
  assert.deepEqual(readOutbox(), connection.getSnapshot().outbox)
  assert.match(connection.getSnapshot().error, /Очередь заполнена/)
})
test("acks and history reconcile only the sender's own pending message", () => {
  const { connection, receive } = fixture()
  connection.send("Hello")
  const id = connection.getSnapshot().outbox[0]?.client_id
  assert.ok(id)
  receive({ type: "snapshot", snapshot: { ...snapshot, messages: [message(id, 1, "Bob")] } })
  assert.equal(connection.getSnapshot().outbox.length, 1)
  receive({ type: "ack", message: message(id, 2) })
  assert.equal(connection.getSnapshot().outbox.length, 0)
  assert.equal(connection.getSnapshot().timeline.length, 2)
  receive({ type: "snapshot", snapshot: { ...snapshot, messages: [message(id, 1, "Bob"), message(id, 2)] } })
  assert.equal(connection.getSnapshot().timeline.length, 2)
  connection.send("Second")
  const second = connection.getSnapshot().outbox[0]?.client_id
  assert.ok(second)
  receive({ type: "snapshot", snapshot: { ...snapshot, messages: [message(second, 3)] } })
  assert.equal(readOutbox().length, 0)
})
test("delivery failures can be retried and cancelled, rate limits remain visible", () => {
  const { connection, receive } = fixture()
  connection.send("Hello")
  const id = connection.getSnapshot().outbox[0]?.client_id
  assert.ok(id)
  receive({ type: "error", code: "rate_limited", client_id: id })
  assert.equal(connection.getSnapshot().outbox[0]?.state, "blocked")
  assert.match(connection.getSnapshot().error, /лимитом/)
  connection.retryMessage(id)
  assert.equal(connection.getSnapshot().outbox[0]?.state, "sending")
  receive({ type: "error", code: "private_unavailable", client_id: id })
  assert.match(connection.getSnapshot().error, /Личное/)
  connection.cancelMessage(id)
  assert.equal(readOutbox().length, 0)
  connection.retryMessage("missing")
})
test("ack timeout and offline preserve queued messages for recovery", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { connection, receive } = fixture()
  connection.send("Hello")
  t.mock.timers.tick(10000)
  assert.equal(connection.getSnapshot().outbox[0]?.state, "retrying")
  window.dispatchEvent(new dom.window.Event("offline"))
  assert.equal(connection.getSnapshot().status, "reconnecting")
  window.dispatchEvent(new dom.window.Event("online"))
  assert.equal(SocketStub.instances.length, 2)
  // Ignore callbacks from the old connection after reconnection.
  receive({ type: "error", code: "old", client_id: "" })
  assert.equal(connection.getSnapshot().error, "")
})
test("preferences resolve, reject on server errors and reject on disconnect", async () => {
  const { connection, socket, receive } = fixture()
  const first = connection.savePreferences(defaultPreferences)
  await assert.rejects(connection.savePreferences(defaultPreferences), /Дождись/)
  receive({ type: "preferences", preferences: defaultPreferences })
  assert.deepEqual(await first, defaultPreferences)
  const second = connection.savePreferences(defaultPreferences)
  receive({ type: "error", code: "preferences_invalid", client_id: "" })
  await assert.rejects(second, /сохранить/)
  const third = connection.savePreferences(defaultPreferences)
  socket.close(1006)
  await assert.rejects(third, /прервалась/)
  await assert.rejects(connection.savePreferences(defaultPreferences), /Дождись/)
})
test("terminal session closure clears credentials and does not reconnect", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { connection, socket } = fixture()
  socket.close(1008)
  assert.equal(readSession(), null)
  assert.equal(connection.getSnapshot().status, "ended")
  t.mock.timers.tick(60000)
  assert.equal(SocketStub.instances.length, 1)
})
test("signals unsubscribe and private delivery remains ephemeral", () => {
  const { connection, receive } = fixture()
  const received: string[] = []
  const unsubscribe = connection.subscribeSignal((sender, body) => received.push(sender + body))
  receive({ type: "signal", sender: "Bob", body: "offer" })
  unsubscribe()
  receive({ type: "signal", sender: "Bob", body: "ignored" })
  assert.deepEqual(received, ["Boboffer"])
  const privateMessage = { ...message("private", -1, "Bob"), kind: "private" }
  receive({ type: "private", message: privateMessage })
  receive({ type: "private", message: privateMessage })
  assert.equal(connection.getSnapshot().ephemeral.length, 1)
  assert.equal(connection.getSnapshot().timeline.length, 0)
  connection.send("@Bob Hello")
  const id = connection.getSnapshot().outbox[0]?.client_id
  assert.ok(id)
  receive({ type: "ack", message: { ...privateMessage, client_id: id, id: -2 } })
  assert.equal(readOutbox().length, 0)
  assert.equal(connection.getSnapshot().ephemeral.length, 2)
})
test("typing is throttled, listening and actions carry the expected commands", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 10000 })
  const { connection, socket } = fixture()
  connection.typing(true)
  connection.typing(true)
  connection.typing(false)
  connection.listening("Song", true)
  connection.listening("Other", false)
  connection.listening("Song", false)
  connection.signal("Bob", "offer")
  connection.setReaction(1, "smile", true)
  connection.deleteMessage(1)
  const frames = socket.sent.map((raw) => JSON.parse(raw) as { type: string; body?: string })
  assert.equal(frames.filter((frame) => frame.type === "typing").length, 2)
  assert.equal(frames.filter((frame) => frame.type === "listening").length, 2)
  assert.deepEqual(
    frames.slice(-3).map((frame) => frame.type),
    ["signal", "reaction", "delete"],
  )
})
test("Karmik moods expire and subscribers are detached", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const { connection, receive } = fixture()
  let updates = 0
  const unsubscribe = connection.subscribe(() => updates++)
  connection.petKarmik()
  assert.equal(connection.getSnapshot().karmikMood, "happy")
  receive({
    type: "snapshot",
    snapshot: {
      ...snapshot,
      messages: [{ ...message("mood"), kind: "system", body: "Кармик сердито машет хвостом: Нет" }],
    },
  })
  assert.equal(connection.getSnapshot().karmikMood, "angry")
  t.mock.timers.tick(8000)
  assert.equal(connection.getSnapshot().karmikMood, "resting")
  assert.ok(updates > 0)
  unsubscribe()
  updates = 0
  connection.petKarmik()
  assert.equal(updates, 0)
})
test("missing credentials end the connection without opening a socket", () => {
  const connection = new ChatConnection()
  connections.push(connection)
  connection.start()
  assert.equal(connection.getSnapshot().status, "ended")
  assert.equal(SocketStub.instances.length, 0)
})

test("cancelling a failed send preserves another author's published message with the same client ID", () => {
  const { connection, receive } = fixture()
  connection.send("Hello")
  const id = connection.getSnapshot().outbox[0]?.client_id
  assert.ok(id)
  receive({ type: "snapshot", snapshot: { ...snapshot, messages: [message(id, 5, "Bob")] } })
  connection.cancelMessage(id)
  assert.equal(connection.getSnapshot().outbox.length, 1)
  receive({ type: "error", code: "rejected", client_id: id })
  connection.cancelMessage(id)
  assert.equal(connection.getSnapshot().outbox.length, 0)
  assert.equal(connection.getSnapshot().timeline[0]?.message.author, "Bob")
})
test("a private acknowledgement preserves public messages with a matching client ID", () => {
  const { connection, receive } = fixture()
  connection.send("^Bob Hello")
  const id = connection.getSnapshot().outbox[0]?.client_id
  assert.ok(id)
  receive({ type: "snapshot", snapshot: { ...snapshot, messages: [message(id, 6, "Bob")] } })
  receive({ type: "ack", message: { ...message(id, -3), kind: "private", recipient: "Bob" } })
  assert.equal(connection.getSnapshot().timeline.length, 1)
  assert.equal(connection.getSnapshot().timeline[0]?.message.author, "Bob")
})
test("stopping the connection rejects a pending preferences save", async () => {
  const { connection } = fixture()
  const saving = connection.savePreferences(defaultPreferences)
  connection.stop()
  await assert.rejects(saving, /закрыто/)
})
