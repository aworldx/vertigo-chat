import { Button } from "../../../../shared/ui/Button"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Icon } from "../../../../shared/ui/Icon"

export function VolumeControl({ volume, onChange }: { volume: number; onChange: (value: number) => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => {
      document.removeEventListener("pointerdown", outside)
    }
  }, [open])
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation()
      button.current?.focus()
      setOpen(false)
    }
  }
  return (
    <div
      ref={root}
      role="group"
      aria-label="Управление громкостью"
      className="chat-tv-volume"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setOpen(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false)
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <Button
        onKeyDown={onKeyDown}
        ref={button}
        id="chat-tv-volume-toggle"
        variant="quiet"
        className="ui-icon-button"
        type="button"
        aria-label="Громкость"
        aria-expanded={open}
        aria-controls="chat-tv-volume-popup"
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true)
        }}
        onClick={() => {
          setOpen((value) => !value)
        }}
      >
        <Icon name="speaker-wave" className="size-5" />
      </Button>
      <div id="chat-tv-volume-popup" className="chat-tv-volume-popup" hidden={!open}>
        <label className="chat-tv-volume-slider">
          <span className="sr-only">Громкость</span>
          <input
            onKeyDown={onKeyDown}
            id="chat-tv-volume"
            className="ui-focus-ring"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => {
              onChange(Number(event.target.value))
            }}
          />
        </label>
      </div>
    </div>
  )
}
