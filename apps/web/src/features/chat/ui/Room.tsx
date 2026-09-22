import { useRef, useState } from "react"
import { MessageFeed } from "./MessageFeed"
import { useRoom } from "../model/useRoom"
export function Room() {
  const { state, connection } = useRoom()
  const [draft, setDraft] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const joined = state.status === "ready" || state.status === "reconnecting"
  return (
    <section
      id="chat-room"
      data-chat-theme="vertigo"
      data-chat-mode="dark"
      data-chat-joined={joined}
      className="chat-shell relative isolate flex h-dvh max-h-dvh min-h-0 flex-col overflow-hidden bg-zinc-950 text-zinc-100"
    >
      <header className="relative z-50 flex min-h-14 shrink-0 items-center justify-between overflow-visible border-b border-zinc-800 bg-zinc-900 px-4">
        <a href="/" id="chat-logo" className="flex items-center gap-3" aria-label="Vertigo">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
        <nav className="cinema-menu flex shrink-0 items-center gap-4 text-sm text-zinc-300" aria-label="Основное меню">
          <a href="/profiles" target="vertigo-profiles">
            Анкеты
          </a>
          {joined && (
            <button
              id="leave-chat"
              type="button"
              onClick={() => {
                connection.leave()
              }}
            >
              Выйти из чата
            </button>
          )}
        </nav>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_17rem]">
        {joined ? (
          <main
            id="dialogue-frame"
            className="relative flex min-h-0 flex-col border-b border-zinc-800 bg-zinc-950 md:border-b-0 md:border-r"
          >
            <p
              id="chat-connection-status"
              role="status"
              className={state.status === "ready" ? "sr-only" : "px-4 py-2 text-xs text-zinc-400"}
            >
              {state.nickname} · {state.status === "ready" ? "В чате" : "Восстанавливаем связь…"}
            </p>
            <MessageFeed
              messages={state.snapshot.messages}
              outbox={state.outbox}
              nickname={state.nickname}
              onAddress={(nickname) => {
                setDraft(`${nickname}, `)
                input.current?.focus()
              }}
              onRetry={(id) => {
                connection.retryMessage(id)
              }}
              onCancel={(id) => {
                connection.cancelMessage(id)
              }}
            />
          </main>
        ) : (
          <main
            id="chat-entrance-screen"
            className="flex min-h-0 flex-col items-center justify-center overflow-y-auto border-b border-zinc-800 bg-zinc-950 p-4 md:border-b-0 md:border-r"
          >
            <div className="w-full max-w-md text-center">
              <h1 className="text-3xl font-semibold">
                {state.status === "loading" ? "Восстанавливаем сессию…" : "Вход в чат"}
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {state.error || "Войди на главной странице, чтобы присоединиться к разговору."}
              </p>
              {state.status !== "loading" && (
                <a
                  id="chat-login-link"
                  href="/"
                  className="mt-6 inline-flex rounded bg-amber-300 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
                >
                  Войти на главной
                </a>
              )}
            </div>
          </main>
        )}
        <aside className="hidden min-h-0 flex-col overflow-y-auto bg-zinc-900/80 p-4 md:block md:flex">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold leading-5">Сейчас в чате</h2>
            <span className="rounded bg-emerald-500/15 px-2 py-1 text-sm text-emerald-300">
              {state.snapshot.peers.length}
            </span>
          </div>
          <div id="online-list" className="mt-4">
            {state.snapshot.peers.map((peer) => (
              <div key={peer.id} className="chat-online-row flex items-center gap-2 rounded px-2 py-0.5">
                <span className="chat-user-nickname min-w-0 flex-1 truncate text-sm font-medium">{peer.nickname}</span>
                {peer.status === "reconnecting" && <span className="text-xs text-zinc-500">Нет связи</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>
      {joined && (
        <form
          id="message-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (connection.send(draft)) setDraft("")
          }}
          className="relative z-20 shrink-0 border-t border-zinc-800 bg-zinc-900 p-3 shadow-[0_-14px_28px_rgb(9_9_11_/_0.42)] transition"
        >
          {state.error && (
            <p role="alert" className="mb-2 text-sm text-red-300">
              {state.error}
            </p>
          )}
          <div className="flex gap-3">
            <label htmlFor="message-body" className="sr-only">
              Сообщение
            </label>
            <input
              id="message-body"
              ref={input}
              name="body"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
              }}
              maxLength={1000}
              autoComplete="off"
              placeholder="Напиши сообщение…"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-base outline-none focus:border-amber-300"
            />
            <button
              id="send-message"
              type="submit"
              className="rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-200"
            >
              Отправить
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
