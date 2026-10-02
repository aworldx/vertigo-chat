import { useState, type ReactNode, type SyntheticEvent } from "react"
import { closePoll, createPoll, pollError, vote, type Poll } from "../api/polls"
import { usePolls } from "../model/usePolls"
function Results({ poll }: { poll: Poll }) {
  return (
    <div className="mt-4 space-y-2">
      {poll.options.map((o) => (
        <div key={o.id} className="rounded border border-zinc-700 p-3">
          <div className="flex justify-between gap-3">
            <span>
              {o.body}
              {poll.selectedOptionID === o.id && " · ваш выбор"}
            </span>
            <strong>{o.votes}</strong>
          </div>
          <div className="mt-2 h-1.5 rounded bg-zinc-800">
            <div
              className="h-full rounded bg-amber-300"
              style={{ width: `${String(poll.totalVotes ? Math.round((o.votes / poll.totalVotes) * 100) : 0)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-sm text-stone-400">Всего голосов: {poll.totalVotes}</p>
    </div>
  )
}
export function Polls({ token, csrf }: { token: string; csrf: string }) {
  const { data, error, refresh } = usePolls(token),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(0)
  const cast = async (p: Poll, o: number) => {
    setBusy(p.id)
    try {
      await vote(p.id, o, token, csrf)
      refresh()
    } catch (e) {
      setNotice(pollError(e))
    } finally {
      setBusy(0)
    }
  }
  return (
    <PollsLayout title="Опросы" error={error} notice={notice}>
      {!token && <p role="alert">Откройте эту страницу из активной вкладки чата, чтобы голосовать.</p>}
      {!data && !error && <p>Загружаем опросы…</p>}
      {data?.length === 0 && <p>Опросов пока нет.</p>}
      {data?.map((p) => (
        <article
          id={`poll-${String(p.id)}`}
          key={p.id}
          className="rounded-2xl border border-amber-900/40 bg-stone-950/80 p-5"
        >
          <h2 className="text-xl font-semibold text-amber-100">{p.question}</h2>
          {p.status === "closed" || p.selectedOptionID > 0 ? (
            <Results poll={p} />
          ) : (
            <div className="mt-4 space-y-2">
              {p.options.map((o) => (
                <button
                  key={o.id}
                  id={`poll-${String(p.id)}-option-${String(o.id)}`}
                  disabled={busy === p.id || !token || !csrf}
                  onClick={() => {
                    void cast(p, o.id)
                  }}
                  className="block w-full rounded border border-zinc-700 px-3 py-2 text-left hover:border-amber-300 disabled:opacity-50"
                >
                  {o.body}
                </button>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-stone-500">{p.status === "closed" ? "Опрос завершён" : "Опрос открыт"}</p>
        </article>
      ))}
    </PollsLayout>
  )
}
function PollsLayout({
  title,
  children,
  error,
  notice,
}: {
  title: string
  children: ReactNode
  error?: boolean
  notice?: string
}) {
  return (
    <section id="polls-page" className="chat-shell min-h-screen bg-zinc-950 text-stone-100">
      <header className="flex min-h-16 items-center border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
        <a href="/chat" className="vertigo-wordmark uppercase">
          Vertigo
        </a>
      </header>
      <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
        <h1 className="text-3xl font-semibold text-amber-100">{title}</h1>
        {notice && <p role="alert">{notice}</p>}
        {error && <p role="alert">Не удалось загрузить опросы.</p>}
        {children}
      </main>
    </section>
  )
}
export function AdminPolls({ csrf }: { csrf: string }) {
  const { data, error, refresh } = usePolls("", true),
    [question, setQuestion] = useState(""),
    [options, setOptions] = useState(["", ""]),
    [notice, setNotice] = useState("")
  const save = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      await createPoll(question, options, csrf)
      setQuestion("")
      setOptions(["", ""])
      refresh()
    } catch (e) {
      setNotice(pollError(e))
    }
  }
  return (
    <PollsLayout title="Опросы" error={error} notice={notice}>
      <form
        id="admin-polls-form"
        onSubmit={(e) => {
          void save(e)
        }}
        className="space-y-5 rounded-2xl border border-amber-900/40 bg-stone-950/80 p-5 sm:p-6"
      >
        <label className="block text-sm font-medium text-stone-200">
          <span>Вопрос</span>
          <textarea
            id="poll-question"
            required
            maxLength={500}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
            }}
            placeholder="Например, какую встречу провести следующей?"
            className="mt-2 block min-h-28 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
          />
        </label>
        {options.map((v, i) => (
          <label key={i} className="block text-sm font-medium text-stone-200">
            <span>Вариант {i + 1}</span>
            <input
              id={`poll-option-${String(i + 1)}`}
              required
              maxLength={200}
              value={v}
              onChange={(e) => {
                setOptions(options.map((x, n) => (n === i ? e.target.value : x)))
              }}
              placeholder={`Текст варианта ${String(i + 1)}`}
              className="mt-2 block h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-base text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
            />
          </label>
        ))}
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            id="add-poll-option"
            type="button"
            disabled={options.length === 10}
            onClick={() => {
              setOptions([...options, ""])
            }}
            className="min-h-11 rounded-lg border border-zinc-600 px-4 text-sm font-semibold text-stone-100 transition hover:border-amber-300 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Добавить вариант
          </button>
          <button
            id="create-poll"
            type="submit"
            className="min-h-11 rounded-lg bg-amber-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
          >
            Создать опрос
          </button>
        </div>
      </form>
      {data?.map((p) => (
        <article id={`admin-poll-${String(p.id)}`} key={p.id} className="rounded-xl border border-zinc-700 p-4">
          <h2 className="font-semibold">{p.question}</h2>
          <Results poll={p} />
          {p.status === "open" && (
            <button
              id={`close-poll-${String(p.id)}`}
              className="mt-3"
              onClick={() => {
                void closePoll(p.id, csrf)
                  .then(refresh)
                  .catch((e: unknown) => {
                    setNotice(pollError(e))
                  })
              }}
            >
              Завершить опрос
            </button>
          )}
        </article>
      ))}
    </PollsLayout>
  )
}
