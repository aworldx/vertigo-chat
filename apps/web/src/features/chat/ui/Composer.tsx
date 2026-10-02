import { PlayerToggle } from "./player/PlayerToggle"
import { Button } from "../../../shared/ui/Button"
import { useState, type DragEvent, type RefObject } from "react"
import { Icon } from "../../../shared/ui/Icon"
import { commands } from "../model/commands"
import { emojiToken, type Emoji } from "../api/emojis"
import type { Message } from "../api/protocol"
export function Composer({
  draft,
  reply,
  onCancelReply,
  onDraft,
  input,
  onSend,
  onLeave,
  registered,
  error,
  emojis,
  emojiError,
  onEmojiRetry,
  onUploadEmoji,
  onAttach,
  onAttachFile,
}: {
  draft: string
  reply: Message | null
  onCancelReply: () => void
  onDraft: (text: string) => void
  input: RefObject<HTMLInputElement | null>
  onSend: () => void
  onLeave: () => void
  registered: boolean
  error: string
  emojis: Emoji[]
  emojiError: string
  onEmojiRetry: () => void
  onUploadEmoji: () => void
  onAttach: () => void
  onAttachFile: (file: File) => void
}) {
  const [picker, setPicker] = useState(false),
    [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(0),
    [mode, setMode] = useState("autosuggest"),
    [autosuggest, setAutosuggest] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [frequency, setFrequency] = useState<Record<string, number>>({})
  const query = draft.toLocaleLowerCase().split(/\s+/u).at(-1) ?? ""
  const ordered = [...emojis].sort((a, b) => {
    if (mode === "frequency") return (frequency[b.code] ?? 0) - (frequency[a.code] ?? 0)
    if (!autosuggest || query.length < 2) return 0
    const score = (e: Emoji) =>
      e.code.includes(query) || e.terms.some((term) => term.toLocaleLowerCase().includes(query)) ? 1 : 0
    return score(b) - score(a)
  })
  const filtered = commands.filter(([command]) => menu || (draft.startsWith("/") && command.startsWith(draft)))
  const showCommands = !dismissed && (menu || (draft.startsWith("/") && !draft.includes(" ") && filtered.length > 0))
  const choose = (command: string) => {
    onDraft(command)
    setMenu(false)
    setDismissed(true)
    input.current?.focus()
  }
  const insert = (code: string) => {
    setFrequency((value) => ({ ...value, [code]: (value[code] ?? 0) + 1 }))
    const start = input.current?.selectionStart ?? draft.length,
      end = input.current?.selectionEnd ?? start
    onDraft(draft.slice(0, start) + code + draft.slice(end))
    requestAnimationFrame(() => {
      input.current?.focus()
      input.current?.setSelectionRange(start + code.length, start + code.length)
    })
  }
  const hasFiles = (event: DragEvent<HTMLFormElement>) => Array.from(event.dataTransfer.types).includes("Files")
  return (
    <form
      id="message-form"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setMenu(false)
          setDismissed(true)
          setPicker(false)
        }
      }}
      onSubmit={(e) => {
        e.preventDefault()
        setMenu(false)
        onSend()
      }}
      onDragEnter={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        if (registered) setDragDepth((depth) => depth + 1)
      }}
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault()
      }}
      onDragLeave={(event) => {
        if (!hasFiles(event) || !registered) return
        setDragDepth((depth) => Math.max(0, depth - 1))
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return
        event.preventDefault()
        setDragDepth(0)
        const [file] = Array.from(event.dataTransfer.files)
        if (registered && file) onAttachFile(file)
      }}
      className={`chat-composer relative shrink-0 border-t border-zinc-800 bg-zinc-900 p-3 shadow-[0_-14px_28px_rgb(9_9_11_/_0.42)] transition ${
        dragDepth > 0 ? "ring-2 ring-inset ring-amber-300" : ""
      }`}
    >
      {dragDepth > 0 && (
        <div
          id="attachment-drop-target"
          aria-live="polite"
          className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/85 text-sm font-semibold text-amber-100"
        >
          Отпусти файл, чтобы прикрепить
        </div>
      )}
      {error && (
        <p id="message-error" role="alert" className="mb-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {reply && (
        <div
          id="message-reply-preview"
          className="mb-2 flex min-w-0 items-center gap-2 border-l-2 border-amber-300 bg-zinc-950/70 px-3 py-2"
        >
          <div className="min-w-0 flex-1 text-xs leading-4">
            <strong className="block truncate text-amber-200">Ответ для {reply.author}</strong>
            <span className="block truncate text-zinc-300">{reply.body}</span>
          </div>
          <Button
            id="cancel-message-reply"
            type="button"
            aria-label="Отменить ответ"
            title="Отменить ответ"
            onClick={onCancelReply}
            className="ui-icon-button shrink-0"
          >
            <Icon name="x-mark" className="size-4" />
          </Button>
        </div>
      )}
      <fieldset
        id="emoji-input-controls"
        className="flex min-w-0 flex-col gap-3 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <div
          id="emoji-picker"
          className={`${picker ? "" : "emoji-picker-closed"} w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-inner`}
        >
          <div
            id="emoji-picker-list"
            className="flex min-h-11 w-full min-w-0 touch-pan-x gap-2 overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch]"
          >
            {ordered.map((emoji) => (
              <button
                key={emoji.id}
                type="button"
                data-emoji-code={emojiToken(emoji.code)}
                aria-label={`Вставить ${emojiToken(emoji.code)}`}
                onClick={() => {
                  insert(emojiToken(emoji.code))
                }}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-300/15 hover:scale-110"
              >
                <img
                  src={`/emojis/${String(emoji.id)}`}
                  alt={emojiToken(emoji.code)}
                  width={emoji.width}
                  height={emoji.height}
                  className="h-auto w-auto max-h-8 max-w-8 object-contain"
                />
              </button>
            ))}
            {emojiError ? (
              <button type="button" onClick={onEmojiRetry} className="px-2 py-2 text-sm text-red-300">
                {emojiError} Повторить
              </button>
            ) : (
              emojis.length === 0 && <p className="px-2 py-2 text-sm text-zinc-400">Смайлы появятся после модерации.</p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-2 text-xs text-zinc-400">
            <div className="flex flex-wrap items-center gap-3">
              {registered ? (
                <div
                  id="emoji-order-mode"
                  className="flex items-center gap-1"
                  role="radiogroup"
                  aria-label="Порядок смайлов"
                >
                  {(["autosuggest", "frequency"] as const).map((value) => (
                    <label
                      key={value}
                      className="cursor-pointer rounded px-2 py-1 has-[:checked]:bg-amber-300/15 has-[:checked]:text-amber-100"
                    >
                      <input
                        id={`emoji-${value}`}
                        type="radio"
                        name="emoji-order-mode"
                        value={value}
                        checked={mode === value}
                        onChange={() => {
                          setMode(value)
                        }}
                        className="sr-only"
                      />{" "}
                      {value === "autosuggest" ? "Автоподбор" : "Частые"}
                    </label>
                  ))}
                </div>
              ) : (
                <label className="flex items-center gap-2">
                  <input
                    id="emoji-autosuggest"
                    type="checkbox"
                    checked={autosuggest}
                    onChange={(e) => {
                      setAutosuggest(e.target.checked)
                    }}
                  />
                  Автоподбор
                </label>
              )}
            </div>
            {registered && (
              <button
                id="open-emoji-submission"
                type="button"
                onClick={onUploadEmoji}
                className="text-amber-200 transition hover:text-amber-100"
              >
                Загрузить
              </button>
            )}
          </div>
        </div>
        <div
          id="emoji-composer-controls"
          className="grid min-w-0 items-center grid-cols-[auto_auto_auto_minmax(0,1fr)_auto] gap-3 md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto_auto]"
        >
          <Button
            id="toggle-emoji-picker"
            type="button"
            aria-label="Выбрать смайл"
            aria-controls="emoji-picker"
            aria-expanded={picker}
            onClick={() => {
              setMenu(false)
              setDismissed(true)
              setPicker((p) => !p)
            }}
            className="ui-icon-button col-start-1 row-start-2 md:row-start-1"
          >
            <Icon name="face-smile" className="size-5" />
          </Button>
          <Button
            id="show-command-menu"
            type="button"
            aria-label="Открыть меню команд"
            aria-controls="command-autocomplete-menu"
            aria-expanded={showCommands}
            title="Команды"
            onClick={() => {
              setPicker(false)
              setMenu((p) => !p)
              setSelected(0)
              setDismissed(false)
              input.current?.focus()
            }}
            className="ui-icon-button col-start-2 row-start-2 md:row-start-1"
          >
            / <span className="sr-only">Команды</span>
          </Button>
          <div
            id="command-autocomplete"
            className="relative col-span-4 row-start-1 min-w-0 md:col-span-1 md:col-start-3"
          >
            <label htmlFor="message-body" className="sr-only">
              Сообщение
            </label>
            <input
              id="message-body"
              ref={input}
              name="body"
              value={draft}
              onChange={(e) => {
                onDraft(e.target.value)
                setSelected(0)
                setDismissed(false)
              }}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showCommands}
              aria-controls="command-autocomplete-menu"
              aria-activedescendant={showCommands ? `command-option-${String(selected)}` : undefined}
              autoComplete="off"
              maxLength={1000}
              placeholder="Напиши сообщение..."
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-amber-300"
              onKeyDown={(e) => {
                if (e.key === "Escape" && reply) {
                  e.preventDefault()
                  onCancelReply()
                  return
                }
                if (!showCommands) return
                if (e.key === "Escape") {
                  setDismissed(true)
                  setMenu(false)
                  e.preventDefault()
                } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault()
                  setSelected((i) => (i + (e.key === "ArrowDown" ? 1 : filtered.length - 1)) % filtered.length)
                } else if (e.key === "Tab" || (e.key === "Enter" && menu)) {
                  const command = filtered[selected]
                  if (command) {
                    e.preventDefault()
                    choose(command[0])
                  }
                }
              }}
            />
            {showCommands && (
              <div
                id="command-autocomplete-menu"
                role="listbox"
                aria-label="Команды чата"
                className="chat-command-menu absolute bottom-full left-0 z-40 mb-2 w-full max-h-64 overflow-y-auto shadow-2xl"
              >
                {filtered.map(([command, description], index) => (
                  <button
                    key={command}
                    id={`command-option-${String(index)}`}
                    type="button"
                    role="option"
                    aria-selected={selected === index}
                    data-command={command}
                    onClick={() => {
                      choose(command)
                    }}
                    className="chat-command-option command-autocomplete-item flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm"
                  >
                    <span className="shrink-0 whitespace-nowrap font-semibold text-amber-200">{command}</span>
                    <span className="min-w-0 flex-1 whitespace-normal">{description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            id="send-message"
            variant="primary"
            type="submit"
            aria-label="Отправить сообщение"
            title="Отправить сообщение"
            className="ui-icon-button col-start-5 row-start-1 md:col-start-4"
          >
            <Icon name="paper-airplane" className="size-5" />
          </Button>
          <div id="media-share-controls" className="col-start-3 row-start-2 shrink-0 md:col-start-5 md:row-start-1">
            <Button
              id="attach-media"
              type="button"
              disabled={!registered}
              aria-label={registered ? "Прикрепить изображение или музыку" : "Вложения доступны после регистрации"}
              title={registered ? "Прикрепить изображение или аудиофайл" : "Только для зарегистрированных чатлан"}
              onClick={onAttach}
              className="ui-icon-button"
            >
              <Icon name="paper-clip" className="size-5" />
            </Button>
          </div>
          <PlayerToggle className="col-start-4 row-start-2 justify-self-start md:col-start-6 md:row-start-1" />
          <Button
            id="leave-chat"
            type="button"
            onClick={onLeave}
            aria-label="Выйти из чата"
            className="ui-icon-button col-start-5 row-start-2 md:col-start-7 md:row-start-1"
          >
            <Icon name="arrow-right-start-on-rectangle" className="size-5 md:hidden" />
            <span className="hidden md:inline">Выход</span>
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
