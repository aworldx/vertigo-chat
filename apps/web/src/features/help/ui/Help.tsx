import { Icon } from "../../../shared/ui/Icon"
import { Commands } from "./Commands"
import { useRanks } from "../model/useRanks"
const formatNumber = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ")
export function Help() {
  const { ranks, loading, error, retry } = useRanks()
  return (
    <section
      id="help-page"
      className="chat-shell min-h-screen bg-zinc-950 text-zinc-100"
      data-chat-theme="vertigo"
      data-chat-mode="dark"
    >
      <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
        <a href="/chat" target="vertigo-chat" data-return-to-chat="" className="flex items-center gap-3">
          <span className="vertigo-mark" aria-hidden="true" />
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-8">
        <div className="border-b border-zinc-800 pb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-300">Карьера в Vertigo</p>
          <h1 className="mt-2 text-4xl font-semibold sm:text-5xl">Помощь</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Здесь собраны команды чата и система званий для зарегистрированных чатлан.
          </p>
        </div>

        <Commands />
        <section className="mt-12" aria-labelledby="ranks-title">
          <div className="border-b border-zinc-800 pb-5">
            <h2 id="ranks-title" className="text-2xl font-semibold">
              Система званий
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Звание получают зарегистрированные чатлане. Для каждого уровня нужно одновременно набрать указанное число
              публичных фраз и часов в чате.
            </p>
          </div>

          {error && (
            <p role="alert">
              {error}{" "}
              <button id="help-retry" type="button" onClick={retry}>
                Повторить
              </button>
            </p>
          )}
          {loading && <p role="status">Загрузка званий…</p>}
          <ol id="ranks-list" className="mt-8 grid gap-4 sm:grid-cols-2">
            {ranks.map((rank, index) => (
              <li
                key={rank.title}
                id={`rank-${String(index + 1)}`}
                data-rank-title={rank.title}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-lg transition hover:-translate-y-0.5 hover:border-amber-300/50"
              >
                <span
                  className="absolute right-5 top-4 text-5xl font-semibold leading-none text-zinc-800"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="relative flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
                    <img src={rank.icon_url} alt="" aria-hidden="true" className="chat-rank-icon size-6" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-zinc-100">{rank.title}</h2>
                    <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Icon name="chat-bubble-left-right" className="size-4 text-rose-300" />
                        <dt className="sr-only">Публичных фраз</dt>
                        <dd>{`${formatNumber(rank.messages)} фраз`}</dd>
                      </div>
                      <div className="flex items-center gap-2 text-zinc-300">
                        <Icon name="clock" className="size-4 text-sky-300" />
                        <dt className="sr-only">Часов в чате</dt>
                        <dd>{`${formatNumber(rank.hours)} ч.`}</dd>
                      </div>
                    </dl>
                    {rank.feature_unlock && (
                      <p className="mt-4 text-xs font-medium text-emerald-300">
                        <Icon name="lock-open" className="mr-1 inline size-4 align-text-bottom" />
                        {` ${rank.feature_unlock}`}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5 text-sm leading-6 text-zinc-300">
          <div className="flex gap-3">
            <Icon name="information-circle" className="mt-0.5 size-5 shrink-0 text-amber-300" />
            <p>
              В зачёт идут только успешно отправленные публичные сообщения. Личные сообщения и гостевые сессии не влияют
              на прогресс.
            </p>
          </div>
        </aside>

        <p id="rank-icons-credit" className="mt-5 text-center text-xs text-zinc-500">
          Иконки:{" "}
          <a
            href="https://tabler.io/icons"
            className="transition hover:text-amber-300"
            target="_blank"
            rel="noreferrer"
          >
            Tabler Icons
          </a>{" "}
          · лицензия MIT
        </p>
      </main>
    </section>
  )
}
