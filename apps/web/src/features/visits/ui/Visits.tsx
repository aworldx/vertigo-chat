import { useVisits } from "../model/useVisits"
import { VisitRow } from "./VisitRow"
export function Visits() {
  const { visits, loading, error, retry } = useVisits()
  return (
    <section
      id="visits-page"
      className="chat-shell min-h-screen bg-zinc-950 text-zinc-100"
      data-chat-theme="vertigo"
      data-chat-mode="dark"
    >
      <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
        <a
          id="visits-return-to-chat"
          href="/chat"
          target="vertigo-chat"
          data-return-to-chat=""
          className="flex items-center gap-3"
        >
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="border-b border-zinc-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">История присутствия</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Кто был</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Входы и выходы чатлан за последние 48 часов. Время указано по Москве.
          </p>
        </div>
        {loading ? (
          <p role="status" className="mt-8 text-sm text-zinc-400">
            Загрузка истории…
          </p>
        ) : error ? (
          <p role="alert" className="mt-8 text-sm text-red-300">
            {error}{" "}
            <button id="visits-retry" className="underline" type="button" onClick={retry}>
              Повторить
            </button>
          </p>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 shadow-2xl">
            <div id="visits-scroll" className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left">
                <thead className="border-b border-zinc-700 bg-zinc-900 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    <th scope="col" className="px-5 py-4 font-medium sm:px-7">
                      Ник
                    </th>
                    <th scope="col" className="px-5 py-4 font-medium sm:px-7">
                      Дата входа
                    </th>
                    <th scope="col" className="hidden px-5 py-4 font-medium sm:table-cell sm:px-7">
                      Дата выхода
                    </th>
                  </tr>
                </thead>
                <tbody id="visits" className="divide-y divide-zinc-800">
                  {visits.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} />
                  ))}
                  <tr id="visits-empty" className="hidden only:table-row">
                    <td colSpan={3} className="px-6 py-16 text-center text-sm text-zinc-500">
                      За последние двое суток входов пока не было.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </section>
  )
}
