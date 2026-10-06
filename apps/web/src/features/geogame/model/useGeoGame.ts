import { useCallback, useEffect, useRef, useState } from "react"
import { requestGame, type GeoSnapshot } from "../api/game"

export function useGeoGame(readToken: () => string) {
  const [state, setState] = useState<{ token: string; game: GeoSnapshot; received: number } | null>(null)
  const [openVersion, setOpenVersion] = useState(0)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)
  const serial = useRef(0)
  const mutation = useRef(false)
  const alive = useRef(true)
  const pending = useRef<AbortController | null>(null)
  const refresh = useCallback(async () => {
    if (mutation.current) return
    const token = readToken()
    if (!token) {
      return
    }
    const version = ++serial.current
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    try {
      const game = await requestGame(token, "", undefined, controller.signal)
      if (alive.current && version === serial.current && readToken() === token) {
        setState({ token, game, received: Date.now() })
        setError("")
      }
    } catch (reason) {
      if (alive.current && !controller.signal.aborted && version === serial.current)
        setError(reason instanceof Error ? reason.message : "Восстанавливаем связь с игрой…")
    }
  }, [readToken])
  useEffect(() => {
    alive.current = true
    const initial = window.setTimeout(() => {
      void refresh()
    }, 0)
    const poll = window.setInterval(() => {
      void refresh()
    }, 2000)
    const clock = window.setInterval(() => {
      setNow(Date.now())
    }, 250)
    const focus = () => {
      void refresh()
    }
    window.addEventListener("focus", focus)
    return () => {
      alive.current = false
      clearTimeout(initial)
      pending.current?.abort()
      clearInterval(poll)
      clearInterval(clock)
      window.removeEventListener("focus", focus)
    }
  }, [refresh])
  const act = async (path: string, text?: string) => {
    if (mutation.current) return false
    const token = readToken()
    if (!token) return false
    mutation.current = true
    setBusy(true)
    setError("")
    pending.current?.abort()
    const version = ++serial.current
    const controller = new AbortController()
    pending.current = controller
    try {
      const body = text !== undefined && state ? { id: state.game.id, round: state.game.round, text } : undefined
      const game = await requestGame(token, path, body, controller.signal)
      if (alive.current && version === serial.current && readToken() === token) {
        setState({ token, game, received: Date.now() })
        return true
      }
    } catch (reason) {
      if (alive.current && !controller.signal.aborted)
        setError(reason instanceof Error ? reason.message : "Не удалось отправить ответ.")
    } finally {
      mutation.current = false
      if (alive.current) setBusy(false)
    }
    return false
  }
  const game = state && state.token === readToken() ? state.game : null
  const serverNow = state ? Date.parse(state.game.server_time) + now - state.received : now
  const active = game && ["preparing", "active", "reveal"].includes(game.phase)
  return {
    game,
    error,
    busy,
    serverNow,
    visible: dismissed !== `${game?.id ?? ""}:${String(openVersion)}` && (openVersion > 0 || Boolean(active)),
    close: () => {
      setDismissed(`${game?.id ?? ""}:${String(openVersion)}`)
    },
    openVersion,
    open: () => {
      setOpenVersion((value) => value + 1)
      void refresh()
    },
    refresh: () => {
      void refresh()
    },
    start: () => {
      void act("/start")
    },
    answer: (text: string) => act("/answer", text),
  }
}
