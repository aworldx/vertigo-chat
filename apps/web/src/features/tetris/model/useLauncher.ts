import { useCallback, useEffect, useRef, useState } from "react"
import { record } from "../../../shared/api/json"
import { openGame } from "../api/games"
import { createGameWindow, type GameWindow } from "./useGameWindow"

type Selection = { id: string; join: boolean; popup?: GameWindow | null | undefined }
function storedSelection(): Selection | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem("vertigo.tetris") ?? "null")
    return record(value) &&
      typeof value.id === "string" &&
      /^[a-f0-9]{32}$/u.test(value.id) &&
      typeof value.join === "boolean"
      ? { id: value.id, join: value.join }
      : null
  } catch {
    return null
  }
}
export function useTetrisLauncher(token: () => string) {
  const [selection, setSelection] = useState<Selection | null>(storedSelection)
  useEffect(() => {
    try {
      if (selection)
        sessionStorage.setItem("vertigo.tetris", JSON.stringify({ id: selection.id, join: selection.join }))
      else sessionStorage.removeItem("vertigo.tetris")
    } catch {
      /* Reconnection still works through the game code when storage is unavailable. */
    }
  }, [selection])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const pendingWindow = useRef<Window | null>(null)
  useEffect(
    () => () => {
      controller.current?.abort()
      pendingWindow.current?.close()
    },
    [],
  )
  const open = useCallback((id: string, join: boolean) => {
    controller.current?.abort()
    pendingWindow.current?.close()
    pendingWindow.current = null
    setSelection({ id, join, popup: createGameWindow() })
    setError("")
  }, [])
  const command = useCallback(
    (argument: string, rematch = false) => {
      if (argument.toLowerCase() === "топ") {
        window.open("/games/tetris/leaderboard", "_blank", "noopener")
        return
      }
      controller.current?.abort()
      pendingWindow.current?.close()
      // Reserve during the click/command gesture, before the API request resolves.
      const popup = createGameWindow()
      pendingWindow.current = popup?.window ?? null
      const active = new AbortController()
      controller.current = active
      setBusy(true)
      setError("")
      void openGame(token(), argument, active.signal, rematch)
        .then((game) => {
          if (!active.signal.aborted)
            setSelection({ id: game.id, join: !game.self, popup: popup?.window.closed ? undefined : popup })
        })
        .catch((reason: unknown) => {
          popup?.window.close()
          if (!active.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось открыть игру.")
        })
        .finally(() => {
          if (active.signal.aborted) popup?.window.close()
          if (pendingWindow.current === popup?.window) pendingWindow.current = null
          if (!active.signal.aborted) setBusy(false)
        })
    },
    [token],
  )
  const close = useCallback(() => {
    setSelection(null)
  }, [])
  return { selection, error, busy, command, open, close }
}
