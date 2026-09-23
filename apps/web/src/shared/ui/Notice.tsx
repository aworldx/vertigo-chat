import { createPortal } from "react-dom"
import { Icon } from "./Icon"
export function Notice({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null
  return createPortal(
    <div id="flash-group" aria-live="polite">
      <div
        id="flash-info"
        role="alert"
        className="fixed right-4 top-4 z-[100] w-full max-w-[calc(100vw-2rem)] sm:right-6 sm:top-6 sm:max-w-sm"
      >
        <div className="flex w-full items-start gap-3 rounded-xl border border-sky-400/50 bg-sky-950/95 p-4 text-sm text-sky-100 shadow-2xl backdrop-blur-sm">
          <Icon name="information-circle" className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p>{message}</p>
          </div>
          <div className="flex-1" />
          <button
            id="community-notice-close"
            type="button"
            className="group self-start cursor-pointer"
            aria-label="close"
            onClick={onClose}
          >
            <Icon name="x-mark" className="size-5 opacity-40 group-hover:opacity-70" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
