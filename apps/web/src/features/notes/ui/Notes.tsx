import { useState, type ReactNode, type SyntheticEvent } from "react"
import { Notice } from "../../../shared/ui/Notice"
import { notesError, sendNote, type Note } from "../api/notes"
import { useNotes } from "../model/useNotes"

function NoteList({
  title,
  empty,
  notes,
  outgoing,
}: {
  title: string
  empty: string
  notes: Note[]
  outgoing?: boolean
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-amber-100">{title}</h2>
      <div className="mt-3 space-y-3">
        {notes.map((note) => (
          <article key={note.id} className="rounded-xl border border-amber-900/40 bg-stone-950/80 p-4">
            <p className="font-semibold text-amber-200">{outgoing ? `Кому: ${note.recipient}` : note.sender}</p>
            <p className="mt-2 whitespace-pre-wrap text-stone-200">{note.body}</p>
            <p className="mt-3 text-xs text-stone-500">
              {new Date(note.inserted_at).toLocaleString("ru-RU")}
              {outgoing && ` · ${note.read ? "прочитано" : "ещё не прочитано"}`}
            </p>
          </article>
        ))}
        {notes.length === 0 && (
          <p className="rounded-xl border border-dashed border-amber-900/40 p-6 text-stone-500">{empty}</p>
        )}
      </div>
    </section>
  )
}
export function Notes({ nickname, csrf, login }: { nickname: string; csrf: string; login: ReactNode }) {
  const { data, error, refresh } = useNotes(),
    [recipient, setRecipient] = useState(""),
    [body, setBody] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false)
  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSending(true)
    try {
      await sendNote(recipient, body, csrf)
      setRecipient("")
      setBody("")
      setNotice("Записка оставлена. Адресат увидит её при следующем входе.")
      refresh()
    } catch (reason) {
      setNotice(notesError(reason))
    } finally {
      setSending(false)
    }
  }
  return (
    <section id="notes-page" className="chat-shell min-h-screen bg-zinc-950 text-stone-100">
      <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
        <a href="/chat" target="vertigo-chat" className="flex items-center gap-3">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="text-3xl font-semibold text-amber-100">Записная книжка</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
          Личные записки не попадают в общий чат. Их получают только зарегистрированные чатланы после входа.
        </p>
        {!nickname ? (
          <div className="mt-6">{login}</div>
        ) : (
          <>
            <form
              onSubmit={(event) => {
                void submit(event)
              }}
              className="mt-7 rounded-2xl border border-amber-900/40 bg-stone-950/80 p-5"
            >
              <h2 className="text-lg font-semibold text-amber-100">Оставить записку</h2>
              <label className="mt-4 block text-sm text-stone-300" htmlFor="note-recipient">
                Кому
              </label>
              <input
                id="note-recipient"
                required
                maxLength={40}
                value={recipient}
                onChange={(event) => {
                  setRecipient(event.target.value)
                }}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="Ник чатлана"
              />
              <label className="mt-4 block text-sm text-stone-300" htmlFor="note-body">
                Записка
              </label>
              <textarea
                id="note-body"
                required
                maxLength={1000}
                value={body}
                onChange={(event) => {
                  setBody(event.target.value)
                }}
                className="mt-1 min-h-28 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="Напиши, что хотел передать…"
              />
              <button
                id="send-note"
                disabled={sending}
                className="mt-4 rounded bg-amber-300 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-50"
              >
                Оставить записку
              </button>
            </form>
            {error && (
              <p role="alert" className="mt-5 text-red-300">
                Не удалось загрузить записки. <button onClick={refresh}>Повторить</button>
              </p>
            )}
            {!data && !error && <p className="mt-5">Загружаем записки…</p>}
            {data && (
              <div className="mt-8 grid gap-8 lg:grid-cols-2">
                <NoteList title="Входящие" empty="Тут пока тихо." notes={data.incoming} />
                <NoteList title="Отправленные" empty="Ты ещё не оставлял записок." notes={data.outgoing} outgoing />
              </div>
            )}
          </>
        )}
      </main>
      <Notice
        message={notice}
        onClose={() => {
          setNotice("")
        }}
      />
    </section>
  )
}
