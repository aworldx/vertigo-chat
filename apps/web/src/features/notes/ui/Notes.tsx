import { useState, type ReactNode, type SyntheticEvent } from "react"
import { Notice } from "../../../shared/ui/Notice"
import { notesError, sendNote, type Note } from "../api/notes"
import { useNotes } from "../model/useNotes"

type NotesSection = "compose" | "incoming" | "outgoing"

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
    <section className="notes-section" aria-labelledby={`${outgoing ? "outgoing" : "incoming"}-notes-title`}>
      <div className="flex items-end justify-between gap-4">
        <h2 id={`${outgoing ? "outgoing" : "incoming"}-notes-title`} className="text-xl font-semibold text-amber-100">
          {title}
        </h2>
        {notes.length > 0 && <span className="notes-count">{notes.length}</span>}
      </div>
      <div className="mt-4 space-y-4">
        {notes.map((note) => (
          <article key={note.id} className={`note-paper ${outgoing ? "note-paper--outgoing" : "note-paper--incoming"}`}>
            <div className="flex items-start justify-between gap-4">
              <p className="note-paper__recipient">{outgoing ? `Кому: ${note.recipient}` : `От: ${note.sender}`}</p>
              {outgoing && (
                <span className={`note-paper__status ${note.read ? "note-paper__status--read" : ""}`}>
                  {note.read ? "прочитано" : "ждёт"}
                </span>
              )}
            </div>
            <p className="note-paper__body">{note.body}</p>
            <time className="note-paper__date" dateTime={note.inserted_at}>
              {new Date(note.inserted_at).toLocaleString("ru-RU")}
            </time>
          </article>
        ))}
        {notes.length === 0 && <p className="notes-empty">{empty}</p>}
      </div>
    </section>
  )
}
export function Notes({ nickname, csrf, login }: { nickname: string; csrf: string; login: ReactNode }) {
  const { data, error, refresh } = useNotes(),
    [recipient, setRecipient] = useState(""),
    [body, setBody] = useState(""),
    [notice, setNotice] = useState(""),
    [sending, setSending] = useState(false),
    [section, setSection] = useState<NotesSection>("compose")
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
        <a href="/chat" target="vertigo-chat" className="notes-back-link">
          Вернуться в чат
        </a>
      </header>
      <main className="notes-book mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="notes-intro">
          <p className="notes-kicker">Личная переписка</p>
          <h1 className="text-3xl font-semibold text-amber-100 sm:text-4xl">Записная книжка</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-300 sm:text-base">
            Личные записки не попадают в общий чат. Их получают только зарегистрированные чатланы после входа.
          </p>
        </div>
        {!nickname ? (
          <div className="notes-login mt-8">{login}</div>
        ) : (
          <>
            <nav className="notes-tabs mt-8" aria-label="Разделы записной книжки">
              {(
                [
                  ["compose", "Новая записка"],
                  ["incoming", "Входящие"],
                  ["outgoing", "Отправленные"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  id={`notes-tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={section === id}
                  aria-controls={`notes-panel-${id}`}
                  className="notes-tab"
                  onClick={() => {
                    setSection(id)
                  }}
                >
                  {label}
                  {id !== "compose" && data && data[id].length > 0 && <span>{data[id].length}</span>}
                </button>
              ))}
            </nav>
            {section === "compose" && (
              <form
                id="notes-panel-compose"
                role="tabpanel"
                aria-labelledby="notes-tab-compose"
                onSubmit={(event) => {
                  void submit(event)
                }}
                className="notes-compose mt-5"
              >
                <div className="notes-compose__heading">
                  <p className="notes-kicker">Новая страница</p>
                  <h2 className="text-2xl font-semibold text-amber-100">Оставить записку</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-400">
                    До 1000 знаков — коротко, бережно и только для адресата.
                  </p>
                </div>
                <label className="mt-6 block text-sm font-semibold text-stone-200" htmlFor="note-recipient">
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
                  className="notes-field mt-2 w-full"
                  placeholder="Ник чатланина"
                />
                <label className="mt-5 block text-sm font-semibold text-stone-200" htmlFor="note-body">
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
                  className="notes-field notes-field--body mt-2 w-full"
                  placeholder="Напиши, что хотел передать…"
                />
                <button id="send-note" disabled={sending} className="notes-send mt-5 min-h-11 disabled:opacity-50">
                  Оставить записку
                </button>
              </form>
            )}
            {error && (
              <p role="alert" className="notes-error mt-6">
                Не удалось загрузить записки. <button onClick={refresh}>Повторить</button>
              </p>
            )}
            {!data && !error && section !== "compose" && <p className="notes-loading mt-5">Перелистываем страницы…</p>}
            {data && section === "incoming" && (
              <div
                id="notes-panel-incoming"
                role="tabpanel"
                aria-labelledby="notes-tab-incoming"
                className="mt-5 max-w-3xl"
              >
                <NoteList title="Входящие" empty="Тут пока тихо." notes={data.incoming} />
              </div>
            )}
            {data && section === "outgoing" && (
              <div
                id="notes-panel-outgoing"
                role="tabpanel"
                aria-labelledby="notes-tab-outgoing"
                className="mt-5 max-w-3xl"
              >
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
