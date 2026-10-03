import { useState, type ReactNode, type SyntheticEvent } from "react"
import { closePoll, createPoll, pollError, vote, type Poll } from "../api/polls"
import { announcePollsChanged } from "../model/usePollNotices"
import { usePolls } from "../model/usePolls"

function Results({ poll }: { poll: Poll }) {
  return (
    <div className="mt-6 space-y-4">
      {poll.options.map((option) => (
        <div key={option.id} className="poll-result" data-selected={poll.selectedOptionID === option.id}>
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 font-medium text-stone-200">
              {option.body}
              {poll.selectedOptionID === option.id && (
                <span className="ml-2 text-xs font-semibold text-amber-200">Ваш выбор</span>
              )}
            </span>
            <span className="shrink-0 text-stone-400">
              <strong className="font-semibold text-stone-100">{option.votes}</strong> ·{" "}
              {poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden bg-zinc-800" aria-hidden="true">
            <div
              className="h-full bg-amber-300 transition-[width] duration-300"
              style={{ width: `${String(poll.totalVotes ? Math.round((option.votes / poll.totalVotes) * 100) : 0)}%` }}
            />
          </div>
        </div>
      ))}
      <p className="border-t border-zinc-800 pt-4 text-sm text-stone-400">
        Всего голосов <strong className="ml-1 font-semibold text-stone-100">{poll.totalVotes}</strong>
      </p>
    </div>
  )
}

function PollCard({
  poll,
  busy,
  token,
  csrf,
  onVote,
}: {
  poll: Poll
  busy: boolean
  token: string
  csrf: string
  onVote: (optionID: number) => void
}) {
  const answered = poll.selectedOptionID > 0
  const closed = poll.status === "closed"
  return (
    <article
      id={`poll-${String(poll.id)}`}
      className="poll-card"
      data-poll-state={closed ? "closed" : answered ? "answered" : "open"}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
        <span className={closed ? "text-stone-500" : "text-amber-200"}>
          <span
            aria-hidden="true"
            className={`mr-2 inline-block h-2 w-2 rounded-full ${closed ? "bg-stone-600" : "bg-amber-300"}`}
          />
          {closed ? "Завершён" : answered ? "Ваш голос принят" : "Открыт"}
        </span>
        <span className="text-zinc-500">
          {new Date(poll.createdAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      <h2 className="mt-4 max-w-3xl font-serif text-2xl leading-tight text-stone-100 sm:text-3xl">{poll.question}</h2>
      {closed || answered ? (
        <Results poll={poll} />
      ) : (
        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-end lg:gap-8">
          <div className="space-y-2">
            <p className="text-sm text-stone-400">Выберите один вариант</p>
            {poll.options.map((option, index) => (
              <button
                key={option.id}
                id={`poll-${String(poll.id)}-option-${String(option.id)}`}
                disabled={busy || !token || !csrf}
                onClick={() => {
                  onVote(option.id)
                }}
                className="poll-option group"
              >
                <span className="poll-option__number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">{option.body}</span>
                <span
                  aria-hidden="true"
                  className="text-amber-300 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  →
                </span>
              </button>
            ))}
          </div>
          <p className="border-l border-zinc-800 pl-5 text-sm leading-6 text-stone-400 lg:pb-1">
            Один голос от текущего ника. Результаты откроются сразу после ответа.
          </p>
        </div>
      )}
    </article>
  )
}

export function Polls({ token, csrf }: { token: string; csrf: string }) {
  const { data, error, refresh } = usePolls(token)
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(0)
  const cast = async (poll: Poll, optionID: number) => {
    setBusy(poll.id)
    try {
      await vote(poll.id, optionID, token, csrf)
      announcePollsChanged()
      refresh()
    } catch (reason) {
      setNotice(pollError(reason))
    } finally {
      setBusy(0)
    }
  }
  return (
    <PollsLayout title="Опросы" error={error} notice={notice}>
      {!token && (
        <p role="alert" className="poll-alert">
          Откройте эту страницу из активной вкладки чата, чтобы голосовать.
        </p>
      )}
      {!data && !error && <p className="poll-loading">Загружаем опросы…</p>}
      {data?.length === 0 && <p className="poll-loading">Опросов пока нет.</p>}
      {data?.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          busy={busy === poll.id}
          token={token}
          csrf={csrf}
          onVote={(optionID) => {
            void cast(poll, optionID)
          }}
        />
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
      <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
        <a href="/chat" target="vertigo-chat" className="flex items-center gap-3">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
        <a href="/chat" target="vertigo-chat" className="notes-back-link">
          Вернуться в чат
        </a>
      </header>
      <main className="polls-book mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="polls-intro">
          <p className="notes-kicker">Мнение сообщества</p>
          <h1 className="font-serif text-4xl leading-none text-amber-100 sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-300 sm:text-base">
            Здесь мы принимаем решения вместе. Выберите вариант — и сразу увидите, как ответило сообщество.
          </p>
        </div>
        {notice && (
          <p role="alert" className="poll-alert mt-7">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="poll-alert mt-7">
            Не удалось загрузить опросы.
          </p>
        )}
        <div className="mt-8 space-y-5">{children}</div>
      </main>
    </section>
  )
}

export function AdminPolls({ csrf }: { csrf: string }) {
  const { data, error, refresh } = usePolls("", true)
  const [question, setQuestion] = useState("")
  const [options, setOptions] = useState(["", ""])
  const [notice, setNotice] = useState("")
  const save = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await createPoll(question, options, csrf)
      announcePollsChanged()
      setQuestion("")
      setOptions(["", ""])
      refresh()
    } catch (reason) {
      setNotice(pollError(reason))
    }
  }
  return (
    <PollsLayout title="Опросы" error={error} notice={notice}>
      <form
        id="admin-polls-form"
        onSubmit={(event) => {
          void save(event)
        }}
        className="poll-card space-y-5"
      >
        <label className="block text-sm font-medium text-stone-200">
          <span>Вопрос</span>
          <textarea
            id="poll-question"
            required
            maxLength={500}
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value)
            }}
            placeholder="Например, какую встречу провести следующей?"
            className="mt-2 block min-h-28 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-base leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-300 focus:ring-1 focus:ring-amber-300"
          />
        </label>
        {options.map((option, index) => (
          <label key={index} className="block text-sm font-medium text-stone-200">
            <span>Вариант {index + 1}</span>
            <input
              id={`poll-option-${String(index + 1)}`}
              required
              maxLength={200}
              value={option}
              onChange={(event) => {
                setOptions(options.map((value, optionIndex) => (optionIndex === index ? event.target.value : value)))
              }}
              placeholder={`Текст варианта ${String(index + 1)}`}
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
      {data?.map((poll) => (
        <article id={`admin-poll-${String(poll.id)}`} key={poll.id} className="poll-card">
          <h2 className="font-serif text-2xl text-stone-100">{poll.question}</h2>
          <Results poll={poll} />
          {poll.status === "open" && (
            <button
              id={`close-poll-${String(poll.id)}`}
              className="mt-5 text-sm font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-4 hover:text-amber-100"
              onClick={() => {
                void closePoll(poll.id, csrf)
                  .then(() => {
                    announcePollsChanged()
                    refresh()
                  })
                  .catch((reason: unknown) => {
                    setNotice(pollError(reason))
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
