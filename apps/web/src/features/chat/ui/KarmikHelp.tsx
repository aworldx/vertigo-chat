import { Button } from "../../../shared/ui/Button"
import { DismissTool, ToolCard } from "./ToolCard"
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
    <ToolCard
      id={id}
      aria-label="Подсказка Кармика"
      className="my-2 shrink-0"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return
        event.stopPropagation()
        if (open) {
          setOpen(false)
          document.getElementById(`${id}-toggle`)?.focus()
        } else {
          setDismissed(true)
          document.getElementById("message-body")?.focus()
        }
      }}
      title="Кармик заметил, что тебе нужна помощь"
      description="Эту подсказку видишь только ты."
      actions={
        <DismissTool
          id={`${id}-dismiss`}
          label="Скрыть подсказку Кармика"
          onClick={() => {
            setDismissed(true)
            document.getElementById("message-body")?.focus()
          }}
        />
      }
    >
      <Button
        id={`${id}-toggle`}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-details`}
        onClick={() => {
          setOpen(!open)
        }}
        className="mt-3"
      >
        {open ? "Свернуть инструкцию" : "Раскрыть подробную инструкцию"}
      </Button>
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
              <Button id={`${id}-settings`} type="button" onClick={onSettings} variant="primary">
                Открыть настройки
              </Button>
            )}
        </div>
      )}
    </ToolCard>
  )
}
