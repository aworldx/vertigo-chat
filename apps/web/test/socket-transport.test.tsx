import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import { SocketTransport } from "../src/features/chat/model/socketTransport"

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

const descriptors = new Map(
  ["window", "navigator", "WebSocket"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
)
let online = true
beforeEach(() => {
  online = true
  SocketStub.instances = []
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: { location: { origin: "https://chat.example" } } },
    navigator: {
      configurable: true,
      value: {
        get onLine() {
          return online
        },
      },
    },
    WebSocket: { configurable: true, value: SocketStub },
  })
})
afterEach(() => {
  for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
})
function fixture() {
  const frames: string[] = [],
    closes: number[] = []
  let opens = 0
  const transport = new SocketTransport({
    opened: () => {
      opens++
    },
    closed: (code) => {
      closes.push(code)
    },
    frame: (frame) => {
      frames.push(frame.type)
    },
  })
  return { transport, frames, closes, opened: () => opens }
}
function socket(index = 0) {
  const value = SocketStub.instances[index]
  assert.ok(value)
  return value
}

test("resumes only an open socket and rejects invalid incoming frames", () => {
  const f = fixture()
  f.transport.start("credential")
  assert.equal(socket().url, "wss://chat.example/api/v1/chat/socket")
  assert.equal(f.transport.send({ type: "leave" }), false)
  socket().open()
  assert.deepEqual(socket().sent, ['{"type":"resume","resume_token":"credential"}'])
  assert.equal(f.transport.send({ type: "heartbeat" }), true)
  socket().onmessage?.({ data: new Uint8Array() })
  socket().onmessage?.({ data: "invalid JSON" })
  socket().onmessage?.({ data: '{"type":"left"}' })
  assert.deepEqual(f.frames, ["left"])
  assert.equal(f.opened(), 1)
  f.transport.stop()
})

test("repeated online events do not create parallel sockets", () => {
  const { transport } = fixture()
  transport.start("credential")
  transport.reconnect()
  assert.equal(SocketStub.instances.length, 1)
  socket().open()
  transport.reconnect()
  assert.equal(SocketStub.instances.length, 1)
  transport.stop()
  assert.equal(socket().readyState, SocketStub.CLOSED)
  assert.equal(transport.send({ type: "leave" }), false)
})

test("old socket callbacks are fenced after token replacement and stop", () => {
  const f = fixture()
  f.transport.start("old")
  const old = socket()
  f.transport.replaceToken("new")
  old.open()
  old.onmessage?.({ data: '{"type":"left"}' })
  assert.equal(f.opened(), 0)
  assert.deepEqual(f.frames, [])
  socket(1).open()
  assert.deepEqual(socket(1).sent, ['{"type":"resume","resume_token":"new"}'])
  f.transport.stop()
  socket(1).onmessage?.({ data: '{"type":"left"}' })
  socket(1).onopen?.()
  assert.equal(f.opened(), 1)
  assert.deepEqual(f.frames, [])
  assert.deepEqual(f.closes, [])
})

test("terminal policy closure never reconnects", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const f = fixture()
  f.transport.start("expired")
  socket().close(1008)
  f.transport.reconnect()
  t.mock.timers.tick(60000)
  assert.deepEqual(f.closes, [1008])
  assert.equal(SocketStub.instances.length, 1)
  f.transport.stop()
})

test("transient closure retries with backoff and resets it after success", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const f = fixture()
  f.transport.start("credential")
  socket().close(1006)
  t.mock.timers.tick(999)
  assert.equal(SocketStub.instances.length, 1)
  t.mock.timers.tick(1)
  socket(1).close(1006)
  t.mock.timers.tick(1999)
  assert.equal(SocketStub.instances.length, 2)
  t.mock.timers.tick(1)
  socket(2).open()
  socket(2).close(1006)
  t.mock.timers.tick(1000)
  assert.equal(SocketStub.instances.length, 4)
  f.transport.stop()
  t.mock.timers.tick(60000)
  assert.equal(SocketStub.instances.length, 4)
})

test("offline defers connection until online and intentional stop cancels retry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const f = fixture()
  online = false
  f.transport.start("credential")
  assert.equal(SocketStub.instances.length, 0)
  online = true
  f.transport.reconnect()
  socket().open()
  online = false
  f.transport.disconnect()
  t.mock.timers.tick(1000)
  assert.equal(SocketStub.instances.length, 1)
  online = true
  f.transport.reconnect()
  assert.equal(SocketStub.instances.length, 2)
  socket(1).close(1006)
  f.transport.stop()
  t.mock.timers.tick(60000)
  assert.equal(SocketStub.instances.length, 2)
})
