import { predict } from "./prediction"
import { useCallback, useEffect, useRef, useState } from "react"
import { record } from "../../../shared/api/json"
import { isGame, type Game, type Action } from "../api/protocol"

export function useGame(id: string, token: string, join: boolean) {
  const [game, setGame] = useState<Game | null>(null)
  const [error, setError] = useState("")
  const [connected, setConnected] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const sequence = useRef(0)
  const readyToSend = useRef(false)
  const terminal = useRef(false)
  const sent = useRef(new Set<number>())
  const pending = useRef<{ sequence: number; action: Action }[]>([])
  const latest = useRef<Game | null>(null)
  useEffect(() => {
    terminal.current = false
    let stopped = false,
      joined = false,
      timer: ReturnType<typeof setTimeout> | undefined
    function connect() {
      if (stopped || !navigator.onLine) return
      readyToSend.current = false
      sent.current.clear()
      const url = new URL(`/api/v1/tetris/${encodeURIComponent(id)}/socket`, window.location.origin)
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      let ready = false
      const ws = new WebSocket(url)
      socket.current = ws
      ws.onopen = () => {
        if (!stopped) ws.send(JSON.stringify({ type: "auth", token }))
      }
      ws.onmessage = (event: MessageEvent<unknown>) => {
        if (stopped || socket.current !== ws || typeof event.data !== "string") return
        let value: unknown
        try {
          value = JSON.parse(event.data)
        } catch {
          return
        }
        if (!record(value)) return
        if (value.type === "error" && typeof value.message === "string") {
          pending.current = []
          if (latest.current?.status !== "finished" && latest.current?.status !== "cancelled") setError(value.message)
          return
        }
        if (value.type !== "state" || !isGame(value.game)) return
        if (!ready) {
          setError("")
          ready = true
          readyToSend.current = true
        }
        const next = value.game
        if (
          next.status === "finished" ||
          next.status === "cancelled" ||
          next.players.find((p) => p.id === next.self)?.dead
        ) {
          pending.current = []
          sent.current.clear()
          setError("")
        }
        const acknowledged = next.players.find((p) => p.id === next.self)?.sequence ?? 0
        pending.current = pending.current.filter((input) => input.sequence > acknowledged)
        const predicted = pending.current.reduce((state, input) => predict(state, input.action), next)
        latest.current = predicted
        setGame(predicted)
        setConnected(true)
        sequence.current = Math.max(sequence.current, next.players.find((p) => p.id === next.self)?.sequence ?? 0)
        if (join && !joined && !next.self) {
          joined = true
          ws.send(JSON.stringify({ type: "join", sequence: ++sequence.current }))
        }
      }
      ws.onclose = (event) => {
        if (stopped || socket.current !== ws) return
        setConnected(false)
        readyToSend.current = false
        if (event.code === 1008 || event.code === 1000) {
          terminal.current = true
          setError(event.reason || "Соединение закрыто. Открой игру заново.")
          return
        }
        setError("")
        timer = setTimeout(connect, 1000)
      }
    }
    const offline = () => {
      clearTimeout(timer)
      readyToSend.current = false
      setConnected(false)
      const previous = socket.current
      socket.current = null
      previous?.close()
    }
    const online = () => {
      if (terminal.current || readyToSend.current) return
      clearTimeout(timer)
      connect()
    }
    window.addEventListener("offline", offline)
    window.addEventListener("online", online)
    connect()
    // Network delivery is paced independently from immediate local input.
    const delivery = setInterval(() => {
      if (!readyToSend.current || socket.current?.readyState !== WebSocket.OPEN) return
      const input = pending.current.find((item) => !sent.current.has(item.sequence))
      if (!input) return
      socket.current.send(JSON.stringify({ type: input.action, sequence: input.sequence }))
      sent.current.add(input.sequence)
    }, 35)
    return () => {
      clearInterval(delivery)
      window.removeEventListener("offline", offline)
      window.removeEventListener("online", online)
      stopped = true
      clearTimeout(timer)
      socket.current?.close()
      socket.current = null
    }
  }, [id, token, join])
  const send = useCallback((action: Action) => {
    if (terminal.current || pending.current.length >= 600) return false
    setError("")
    const seq = ++sequence.current
    if (["join", "ready", "unready", "start", "leave"].includes(action)) {
      if (!readyToSend.current || socket.current?.readyState !== WebSocket.OPEN) return false
      socket.current.send(JSON.stringify({ type: action, sequence: seq }))
      return true
    }
    const current = latest.current
    const player = current?.players.find((p) => p.id === current.self)
    if (current?.status !== "running" || !player || player.dead) return false
    pending.current.push({ sequence: seq, action })
    if (latest.current) {
      latest.current = predict(latest.current, action)
      setGame(latest.current)
    }

    return true
  }, [])
  return { game, error, connected, send, latest }
}
