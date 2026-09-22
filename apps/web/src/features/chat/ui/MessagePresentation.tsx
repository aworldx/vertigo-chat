import type { CSSProperties } from "react"
import type { Message } from "../api/protocol"
export function appearanceStyle(appearance: Message["appearance"]): CSSProperties & Record<`--${string}`, string> {
  return {
    "--nick-dark": appearance.dark.nickname_color,
    "--text-dark": appearance.dark.text_color,
    "--nick-light": appearance.light.nickname_color,
    "--text-light": appearance.light.text_color,
  }
}
export function MessageTime({ message, className }: { message: Message; className: string }) {
  return (
    <time id={`message-time-${String(message.id)}`} dateTime={message.sent_at} className={className}>
      {new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
        new Date(message.sent_at),
      )}
    </time>
  )
}
