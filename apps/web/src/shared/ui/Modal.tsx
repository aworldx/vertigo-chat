import { useLayoutEffect, useRef, type PropsWithChildren } from "react"

export function Modal({
  id,
  labelId,
  onClose,
  className,
  children,
}: PropsWithChildren<{ id: string; labelId: string; onClose: () => void; className: string }>) {
  const ref = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => {
    close.current = onClose
  }, [onClose])
  useLayoutEffect(() => {
    const previous = document.activeElement
    const root = ref.current
    if (!root) return
    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]',
        ),
      ).filter((e) => e.tabIndex >= 0 && e.getClientRects().length > 0)
    focusable()[0]?.focus({ preventScroll: true })
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        close.current()
      }
      if (event.key !== "Tab") return
      const elements = focusable(),
        first = elements[0],
        last = elements.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    root.addEventListener("keydown", key)
    return () => {
      root.removeEventListener("keydown", key)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return (
    <div ref={ref} id={id} role="dialog" aria-modal="true" aria-labelledby={labelId} className={className}>
      {children}
    </div>
  )
}
