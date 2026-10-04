import { useCallback, useEffect, useLayoutEffect, useRef } from "react"
import type { Action } from "../api/protocol"

const keys: Record<string, Action> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowUp: "rotate",
  Space: "drop",
  KeyZ: "counterrotate",
  KeyX: "rotate",
  KeyC: "hold",
  ShiftLeft: "hold",
  KeyP: "pause",
}
export function useControls(enabled: boolean, send: (action: Action) => void, keyboardWindow: Window = window) {
  const sendRef = useRef(send)
  useLayoutEffect(() => {
    sendRef.current = send
  }, [send])
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pressed = useRef<ReturnType<typeof setInterval> | null>(null)
  const stop = useCallback(() => {
    if (delay.current) clearTimeout(delay.current)
    delay.current = null
    if (pressed.current) clearInterval(pressed.current)
    pressed.current = null
  }, [])
  const press = useCallback(
    (action: Action) => {
      stop()
      if (!enabled) return
      sendRef.current(action)
      if (["left", "right", "down"].includes(action))
        delay.current = setTimeout(() => {
          sendRef.current(action)
          pressed.current = setInterval(() => {
            sendRef.current(action)
          }, 45)
        }, 150)
    },
    [enabled, stop],
  )
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const tag = event.target && "nodeName" in event.target ? event.target.nodeName : ""
      if (!enabled || ["INPUT", "SELECT", "TEXTAREA"].includes(String(tag))) return
      if (event.code === "Space" && tag === "BUTTON") return
      const action = keys[event.code]
      if (!action) return
      event.preventDefault()
      if (!event.repeat) press(action)
    }
    const up = (event: KeyboardEvent) => {
      if (keys[event.code]) stop()
    }
    const restoreGameFocus = (event: MouseEvent) => {
      if (enabled && event.detail > 0 && keyboardWindow.document.activeElement?.closest("#tetris-game button"))
        keyboardWindow.document.getElementById("tetris-keyboard")?.focus({ preventScroll: true })
    }
    keyboardWindow.addEventListener("click", restoreGameFocus)
    keyboardWindow.addEventListener("keydown", down)
    keyboardWindow.addEventListener("keyup", up)
    keyboardWindow.addEventListener("blur", stop)
    return () => {
      stop()
      keyboardWindow.removeEventListener("click", restoreGameFocus)
      keyboardWindow.removeEventListener("keydown", down)
      keyboardWindow.removeEventListener("keyup", up)
      keyboardWindow.removeEventListener("blur", stop)
    }
  }, [enabled, press, stop, keyboardWindow])
  return { press, stop }
}
