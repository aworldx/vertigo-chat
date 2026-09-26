import { useState } from "react"
import { chatHelp as instructions, type HelpTopic } from "../../../shared/chatHelp"
import { useFeedContentEvent } from "./feedContent"

export function KarmikHelp({
  messageID,
  topics,
  onSettings,
}: {
  messageID: number
  topics: HelpTopic[]
  onSettings?: (() => void) | undefined
}) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const id = `karmik-help-${String(messageID)}`
  useFeedContentEvent(`${id}:${String(open)}:${String(dismissed)}`)
  if (dismissed) return null
  return (
    <aside
      id={id}
      aria-label="Подсказка Кармика"
      className="my-2 shrink-0 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-zinc-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Кармик заметил, что тебе нужна помощь</p>
          <p className="mt-1 text-xs text-zinc-500">Эту подсказку видишь только ты.</p>
        </div>
        <button
          id={`${id}-dismiss`}
          type="button"
          aria-label="Скрыть подсказку Кармика"
          onClick={() => {
            setDismissed(true)
          }}
          className="rounded px-2 py-1 hover:bg-amber-500/15"
        >
          ×
        </button>
      </div>
      <button
        id={`${id}-toggle`}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-details`}
        onClick={() => {
          setOpen(!open)
        }}
        className="mt-2 rounded text-left font-medium underline decoration-amber-500/50 underline-offset-4"
      >
        {open ? "Свернуть инструкцию" : "Раскрыть подробную инструкцию"}
      </button>
      {open && (
        <div id={`${id}-details`} className="mt-3 space-y-3">
          {[...new Set(topics)].map((topic) => (
            <div key={topic}>
              <p className="font-medium">{instructions[topic].title}</p>
              <p className="mt-1 leading-relaxed">{instructions[topic].body}</p>
            </div>
          ))}
          <a
            id={`${id}-guide`}
            href="/help#chat-guide"
            target="_blank"
            rel="noreferrer"
            className="block underline underline-offset-4"
          >
            Все возможности чата
          </a>
          {onSettings &&
            topics.some(
              (topic) => topic === "font" || topic === "colors" || topic === "appearance" || topic === "karma",
            ) && (
              <button
                id={`${id}-settings`}
                type="button"
                onClick={onSettings}
                className="rounded-lg border border-amber-500/40 px-3 py-2 hover:bg-amber-500/15"
              >
                Открыть настройки
              </button>
            )}
        </div>
      )}
    </aside>
  )
}
