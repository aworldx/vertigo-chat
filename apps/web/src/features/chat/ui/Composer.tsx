import { useState, type RefObject } from "react"
import { Icon } from "../../../shared/ui/Icon"
import { commands } from "../model/commands"
import type { Emoji } from "../api/emojis"
export function Composer({
  draft,
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
}: {
  draft: string
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
}) {
  const [picker, setPicker] = useState(false),
    [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(0),
    [mode, setMode] = useState("autosuggest"),
    [autosuggest, setAutosuggest] = useState(true)
  const [dismissed, setDismissed] = useState(false)
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
  return (
    <form
      id="message-form"
      onSubmit={(e) => {
        e.preventDefault()
        setMenu(false)
        onSend()
      }}
      className="relative z-20 shrink-0 border-t border-zinc-800 bg-zinc-900 p-3 shadow-[0_-14px_28px_rgb(9_9_11_/_0.42)] transition"
    >
      {error && (
        <p id="message-error" role="alert" className="mb-2 text-sm text-red-300">
          {error}
        </p>
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
                data-emoji-code={emoji.code}
                aria-label={`Вставить ${emoji.code}`}
                onClick={() => {
                  insert(emoji.code)
                }}
                className="flex size-10 shrink-0 items-center justify-center rounded-lg transition hover:bg-amber-300/15 hover:scale-110"
              >
                <img
                  src={`/emojis/${String(emoji.id)}`}
                  alt={emoji.code}
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
          className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] gap-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto]"
        >
          <button
            id="toggle-emoji-picker"
            type="button"
            aria-label="Выбрать смайл"
            aria-controls="emoji-picker"
            aria-expanded={picker}
            onClick={() => {
              setPicker((p) => !p)
            }}
            className="flex min-h-10 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 text-zinc-400 transition hover:border-amber-300 hover:text-amber-300"
          >
            <Icon name="face-smile" className="size-5" />
          </button>
          <button
            id="show-command-menu"
            type="button"
            aria-label="Открыть меню команд"
            aria-controls="command-autocomplete-menu"
            title="Команды"
            onClick={() => {
              setMenu((p) => !p)
              setSelected(0)
              setDismissed(false)
              input.current?.focus()
            }}
            className="col-start-2 row-start-2 flex min-h-10 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 font-mono text-base font-semibold text-zinc-400 transition hover:border-amber-300 hover:text-amber-300 sm:row-start-1"
          >
            / <span className="sr-only">Команды</span>
          </button>
          <div
            id="command-autocomplete"
            className="relative col-span-3 row-start-1 min-w-0 sm:col-span-1 sm:col-start-3"
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
              autoComplete="off"
              maxLength={1000}
              placeholder="Напиши сообщение..."
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-amber-300"
              onKeyDown={(e) => {
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
                className="absolute bottom-full left-0 z-40 mb-2 w-full overflow-hidden rounded-xl border border-amber-300/40 bg-zinc-900 shadow-2xl"
              >
                {filtered.map(([command, description], index) => (
                  <button
                    key={command}
                    type="button"
                    role="option"
                    aria-selected={selected === index}
                    data-command={command}
                    onClick={() => {
                      choose(command)
                    }}
                    className="command-autocomplete-item flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-amber-300/15"
                  >
                    <span className="font-semibold text-amber-200">{command}</span>
                    <span className="text-zinc-400">{description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            id="send-message"
            type="submit"
            aria-label="Отправить сообщение"
            title="Отправить сообщение"
            className="col-start-4 row-start-1 flex size-10 shrink-0 items-center justify-center rounded bg-amber-300 text-zinc-950 transition hover:bg-amber-200 sm:col-start-4"
          >
            <Icon name="paper-airplane" className="size-5" />
          </button>
          <div id="media-share-controls" className="col-start-3 row-start-2 shrink-0 sm:col-start-5 sm:row-start-1">
            <button
              id="attach-media"
              type="button"
              disabled={!registered}
              aria-label={registered ? "Прикрепить изображение или музыку" : "Вложения доступны после регистрации"}
              title={registered ? "Прикрепить изображение или аудиофайл" : "Только для зарегистрированных чатлан"}
              onClick={onAttach}
              className="flex min-h-10 items-center justify-center rounded border border-zinc-700 bg-zinc-950 px-3 text-zinc-400 transition hover:border-amber-300 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-400"
            >
              <Icon name="paper-clip" className="size-5" />
            </button>
          </div>
          <button
            id="leave-chat"
            type="button"
            onClick={onLeave}
            aria-label="Выйти из чата"
            className="col-start-4 row-start-2 flex shrink-0 items-center justify-center rounded border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 transition hover:border-red-300 hover:text-red-200 sm:col-start-6 sm:row-start-1 sm:px-4"
          >
            <Icon name="arrow-right-start-on-rectangle" className="size-5 sm:hidden" />
            <span className="hidden sm:inline">Выход</span>
          </button>
        </div>
      </fieldset>
    </form>
  )
}
