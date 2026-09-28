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
  const pending = useRef<{ sequence: number; action: Action }[]>([])
  const latest = useRef<Game | null>(null)
  useEffect(() => {
    let stopped = false,
      joined = false,
      timer: ReturnType<typeof setTimeout> | undefined
    function connect() {
      const url = new URL(`/api/v1/tetris/${encodeURIComponent(id)}/socket`, window.location.origin)
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
      let ready = false
      const ws = new WebSocket(url)
      socket.current = ws
      ws.onopen = () => {
        if (!stopped) ws.send(JSON.stringify({ type: "auth", token }))
      }
      ws.onmessage = (event: MessageEvent<unknown>) => {
        if (stopped || typeof event.data !== "string") return
        let value: unknown
        try {
          value = JSON.parse(event.data)
        } catch {
          return
        }
        if (!record(value)) return
        if (value.type === "error" && typeof value.message === "string") {
          pending.current = []
          setError(value.message)
          return
        }
        if (value.type !== "state" || !isGame(value.game)) return
        if (!ready) {
          setError("")
          ready = true
        }
        const next = value.game
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
        if (stopped) return
        setConnected(false)
        pending.current = []
        if (event.code === 1008 || event.code === 1000) {
          setError(event.reason || "Соединение закрыто. Открой игру заново.")
          return
        }
        setError("Восстанавливаем связь. На возвращение есть 20 секунд.")
        timer = setTimeout(connect, 1000)
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      socket.current?.close()
      socket.current = null
    }
  }, [id, token, join])
  const send = useCallback((action: Action) => {
    if (socket.current?.readyState !== WebSocket.OPEN) return false
    setError("")
    const seq = ++sequence.current
    if (["left", "right", "down", "rotate", "counterrotate", "drop"].includes(action))
      pending.current.push({ sequence: seq, action })
    if (latest.current) {
      latest.current = predict(latest.current, action)
      setGame(latest.current)
    }
    socket.current.send(JSON.stringify({ type: action, sequence: seq }))
    return true
  }, [])
  return { game, error, connected, send, latest }
}
