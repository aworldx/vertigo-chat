import { useCallback, useEffect, useState } from "react"

export type GameWindow = { id: string; window: Window; container: HTMLElement }
const blocked = "Браузер заблокировал окно. Разреши всплывающие окна для сайта и попробуй снова."

export function createGameWindow(): GameWindow | null | undefined {
  if (!window.matchMedia("(min-width: 768px) and (pointer: fine)").matches) return undefined
  const child = window.open("about:blank", "_blank", "popup,width=620,height=820,resizable=yes,scrollbars=yes")
  if (!child) return null
  child.document.title = "Тетрис · Vertigo"
  child.document.documentElement.lang = "ru"
  child.document.documentElement.className = document.documentElement.className
  child.document.body.className = document.body.className
  const viewport = child.document.createElement("meta")
  viewport.name = "viewport"
  viewport.content = "width=device-width, initial-scale=1"
  child.document.head.append(viewport)
  for (const style of document.querySelectorAll('link[rel="stylesheet"], style')) {
    const clone = style.cloneNode(true)
    if (style instanceof HTMLLinkElement && clone instanceof HTMLLinkElement) clone.href = style.href
    child.document.head.append(clone)
  }
  const container = child.document.createElement("div")
  child.document.body.append(container)
  return { id: crypto.randomUUID(), window: child, container }
}

export function useGameWindow(initialWindow?: GameWindow | null) {
  const [active, setActive] = useState(initialWindow ?? null)
  const [error, setError] = useState(initialWindow === null ? blocked : "")
  useEffect(() => {
    if (!active) return
    const closed = () => {
      setActive(null)
    }
    const close = () => {
      active.window.close()
    }
    active.window.addEventListener("beforeunload", closed)
    window.addEventListener("pagehide", close)
    active.window.focus()
    return () => {
      active.window.removeEventListener("beforeunload", closed)
      window.removeEventListener("pagehide", close)
      close()
    }
  }, [active])
  const open = useCallback(() => {
    if (active && !active.window.closed) {
      active.window.focus()
      return
    }
    const next = createGameWindow()
    if (next === undefined) return
    setActive(next)
    setError(next ? "" : blocked)
  }, [active])
  const focus = useCallback(() => {
    active?.window.focus()
  }, [active])
  return { container: active?.container ?? null, error, open, focus }
}
