import { useEffect, type Dispatch } from "react"
import type { PlayerAction, PlayerState } from "./queue"
export function usePlayerPanel(mode: PlayerState["mode"], dispatch: Dispatch<PlayerAction> | undefined) {
  useEffect(() => {
    if (mode !== "expanded") return
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.activeElement?.closest("#chat-tv, #chat-tv-toggle")) {
        event.stopPropagation()
        dispatch?.({ type: "mode", mode: "compact" })
        requestAnimationFrame(() => {
          document.getElementById("chat-tv-expand")?.focus()
        })
      }
    }
    const focus = () => {
      if (window.matchMedia("(max-width: 767px)").matches && document.activeElement?.id === "message-body")
        dispatch?.({ type: "mode", mode: "compact" })
    }
    const keyboardOpened = document.activeElement?.matches(":focus-visible")
    const frame = requestAnimationFrame(() => {
      if (keyboardOpened) document.getElementById("chat-tv-collapse")?.focus({ preventScroll: true })
    })
    document.addEventListener("keydown", keyboard)
    document.addEventListener("focusin", focus)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("keydown", keyboard)
      document.removeEventListener("focusin", focus)
    }
  }, [mode, dispatch])
}
