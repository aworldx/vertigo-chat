import { decodeFrame, socketURL, type Frame } from "../api/protocol"

export class SocketTransport {
  private socket: WebSocket | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private retry = 0
  private stopped = false
  private token = ""

  constructor(
    private readonly events: {
      closed: (code: number) => void
      frame: (frame: Frame) => void
      opened: () => void
    },
  ) {}

  start(token: string) {
    this.stopped = false
    this.token = token
    this.connect()
  }

  stop() {
    this.stopped = true
    clearTimeout(this.timer)
    const previous = this.socket
    this.socket = null
    previous?.close()
  }

  disconnect() {
    this.socket?.close()
  }

  reconnect() {
    clearTimeout(this.timer)
    this.retry = 0
    this.connect()
  }

  replaceToken(token: string) {
    const previous = this.socket
    this.socket = null
    previous?.close()
    clearTimeout(this.timer)
    this.token = token
    this.connect()
  }

  send(command: object) {
    if (this.socket?.readyState !== WebSocket.OPEN) return false
    this.socket.send(JSON.stringify(command))
    return true
  }

  private connect() {
    if (this.stopped || !navigator.onLine) return
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) return
    const socket = new WebSocket(socketURL())
    this.socket = socket
    socket.onopen = () => {
      if (this.stopped || this.socket !== socket) return
      this.retry = 0
      this.send({ type: "resume", resume_token: this.token })
      this.events.opened()
    }
    socket.onmessage = (event: MessageEvent<unknown>) => {
      if (this.stopped || this.socket !== socket) return
      if (typeof event.data !== "string") return
      const frame = decodeFrame(event.data)
      if (frame) this.events.frame(frame)
    }
    socket.onclose = (event) => {
      if (this.stopped || this.socket !== socket) return
      this.socket = null
      if (event.code === 1008) this.stopped = true
      this.events.closed(event.code)
      if (this.stopped) return
      this.timer = setTimeout(
        () => {
          this.connect()
        },
        Math.min(1000 * 2 ** this.retry++, 10000),
      )
    }
  }
}
