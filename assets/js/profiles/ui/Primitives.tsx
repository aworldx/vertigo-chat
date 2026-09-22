import { useLayoutEffect, useRef, useState, type PropsWithChildren } from "react"
import type { Profile } from "../api/profiles"

export const buttonClass =
  "min-h-11 rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-50"
const iconPaths = {
  close: "M6 18 18 6M6 6l12 12",
  user: "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z",
  search: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
  expand:
    "M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15",
} as const

export function Icon({ name, className }: { name: keyof typeof iconPaths; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="1.5"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      className={`inline-block shrink-0 align-middle ${className}`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={iconPaths[name]} />
    </svg>
  )
}
export function ErrorNotice({ message, retry, id }: { message: string; retry: () => void; id: string }) {
  return (
    <div id={id} className="rounded-xl border border-rose-300/40 bg-zinc-900 p-6">
      <p role="alert" className="text-rose-200">
        {message}
      </p>
      <button id={`${id}-retry`} type="button" onClick={retry} className={`${buttonClass} mt-4`}>
        Попробовать ещё раз
      </button>
    </div>
  )
}
export function Photo({
  src,
  nickname,
  className,
  placeholderClass = "",
}: {
  src: string | null
  nickname: string
  className: string
  placeholderClass?: string
}) {
  const [failed, setFailed] = useState(false)
  if (!src || failed)
    return (
      <div
        className={`flex min-h-48 items-center justify-center bg-zinc-950 text-zinc-700 ${className} ${placeholderClass}`}
      >
        <Icon name="user" className="size-20" />
        <span className="sr-only">Фото недоступно</span>
      </div>
    )
  return (
    <img
      src={src}
      alt={`Фото ${nickname}`}
      loading="lazy"
      className={className}
      onError={() => {
        setFailed(true)
      }}
    />
  )
}
export function Rank({ rank, className = "text-sm" }: { rank: Profile["rank"]; className?: string }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 font-medium text-amber-200 ${className}`}>
      <img src={rank.icon_url} alt="" className="chat-rank-icon size-4 shrink-0" />
      <span>{rank.title}</span>
    </span>
  )
}
export function genderLabel(value: Profile["gender"]): string {
  if (value === null) return "Не указан"
  return { male: "Мужской", female: "Женский", other: "Другой" }[value]
}
export function birthDate(value: string | null): string {
  return value ? value.split("-").reverse().join(".") : "Не указана"
}
export function Modal({
  id,
  labelId,
  onDismiss,
  children,
  photo = false,
}: PropsWithChildren<{ id: string; labelId: string; onDismiss: () => void; photo?: boolean }>) {
  const ref = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const dialog = ref.current
    if (!dialog) return
    dialog.showModal()
    document.body.style.overflow = "hidden"
    return () => {
      dialog.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    }
  }, [])
  return (
    // Native dialog backdrop click has no keyboard analogue; Escape is handled by onCancel below.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={labelId}
      onCancel={(event) => {
        event.preventDefault()
        onDismiss()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss()
      }}
      className={
        photo
          ? "fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center overflow-hidden border-0 bg-transparent p-4 text-zinc-100 outline-none backdrop:bg-zinc-950/90 backdrop:backdrop-blur-md open:flex sm:p-8"
          : "m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-0 text-zinc-100 shadow-2xl backdrop:bg-zinc-950/85 backdrop:backdrop-blur-sm"
      }
    >
      {children}
    </dialog>
  )
}
