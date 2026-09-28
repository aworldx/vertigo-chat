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
export function useControls(enabled: boolean, send: (action: Action) => void) {
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
      if (
        !enabled ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return
      if (event.code === "Space" && event.target instanceof HTMLButtonElement) return
      const action = keys[event.code]
      if (!action) return
      event.preventDefault()
      if (!event.repeat) press(action)
    }
    const up = (event: KeyboardEvent) => {
      if (keys[event.code]) stop()
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", stop)
    return () => {
      stop()
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", stop)
    }
  }, [enabled, press, stop])
  return { press, stop }
}
