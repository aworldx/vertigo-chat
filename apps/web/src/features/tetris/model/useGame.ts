import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import type { Action } from "../api/protocol"
import { GameConnection } from "../api/gameConnection"
import { GameStore } from "./gameStore"

export function useGame(id: string, token: string, join: boolean, clockWindow: Window = window) {
  const store = useMemo(() => new GameStore(id), [id])
  const game = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [error, setError] = useState("")
  const connected = useSyncExternalStore(store.subscribe, store.getConnectionSnapshot)
  const connection = useRef<GameConnection | null>(null)
  const latest = useMemo(
    () => ({
      get current() {
        return store.current
      },
    }),
    [store],
  )
  useEffect(() => {
    const transport = new GameConnection(id, token, join, {
      state: (next) => {
        store.receive(next, performance.now())
        setError("")
      },
      error: (message) => {
        store.reject()
        if (store.current?.status !== "finished" && store.current?.status !== "cancelled") setError(message)
      },
      connection: (online) => {
        if (!online) store.disconnect()
      },
    })
    connection.current = transport
    transport.start()
    return () => {
      transport.stop()
      store.disconnect()
      connection.current = null
    }
  }, [id, token, join, store])
  useEffect(() => {
    let frame = 0
    const tick = () => {
      store.frame(performance.now())
      frame = clockWindow.requestAnimationFrame(tick)
    }
    frame = clockWindow.requestAnimationFrame(tick)
    return () => {
      clockWindow.cancelAnimationFrame(frame)
    }
  }, [store, clockWindow])
  const send = useCallback(
    (action: Action) => {
      const now = performance.now()
      const transport = connection.current
      if (!transport?.available(now)) return false
      const input = store.input(action, now)
      if (!input) return false
      if (!transport.send(input, now)) {
        store.reject()
        return false
      }
      setError("")
      return true
    },
    [store],
  )
  return { game, error, connected, send, latest, store }
}
