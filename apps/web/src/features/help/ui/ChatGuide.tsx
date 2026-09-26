import { useState } from "react"
import { chatHelp } from "../../../shared/chatHelp"
export function ChatGuide() {
  const [query, setQuery] = useState("")
  const search = query.trim().toLocaleLowerCase("ru")
  const topics = Object.entries(chatHelp).filter(([, topic]) =>
    `${topic.title} ${topic.body}`.toLocaleLowerCase("ru").includes(search),
  )
  return (
    <section id="chat-guide" className="mt-12" aria-labelledby="chat-guide-title">
      <h2 id="chat-guide-title" className="text-2xl font-semibold">
        Все возможности чата
      </h2>
      <p className="mt-2 text-sm text-zinc-400">
        Этими же инструкциями пользуется Кармик, когда ты задаёшь вопрос в чате.
      </p>
      <label htmlFor="chat-guide-search" className="mt-5 block text-sm text-zinc-300">
        Найти инструкцию
      </label>
      <input
        id="chat-guide-search"
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
        }}
        placeholder="Например: видео, шрифт, звание"
        className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100"
      />
      <div id="chat-guide-topics" className="mt-4 grid gap-3 sm:grid-cols-2">
        {topics.map(([key, topic]) => (
          <details id={`help-topic-${key}`} key={key} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <summary className="cursor-pointer font-medium text-amber-200">{topic.title}</summary>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{topic.body}</p>
          </details>
        ))}
      </div>
      {topics.length === 0 && (
        <p role="status" className="mt-4 text-sm text-zinc-400">
          Ничего не найдено. Попробуй другое название функции.
        </p>
      )}
    </section>
  )
}
