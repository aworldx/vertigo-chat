import { Icon } from "../../../shared/ui/Icon"
export function Commands() {
  return (
    <section className="mt-8" aria-labelledby="commands-title">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
          <Icon name="command-line" className="size-5" />
        </span>
        <div>
          <h2 id="commands-title" className="text-2xl font-semibold">
            Команды
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Начинай сообщение со знака <code className="text-amber-200">/</code>.
          </p>
        </div>
      </div>

      <dl id="commands-list" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/помощь</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Показывает список команд.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/кто</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">
            Показывает до 10 чатлан онлайн; на ник можно нажать для обращения.
          </dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/выход</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Выводит из чата.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/инфо ник</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Открывает анкету чатланина.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/игнор ник</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Скрывает сообщения чатланина; повтор команды возвращает их.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/игноры</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Показывает список игнорируемых чатлан.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/очистить</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Очищает окно чата только у тебя.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/гиф запрос</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">Ищет GIF, которую можно выбрать и отправить в чат.</dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/музыка запрос</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">
            Ищет 10 треков: прослушай вариант и отправь его в общую комнату.
          </dd>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
          <dt>
            <code className="font-semibold text-amber-200">/ютуб ссылка или запрос</code>
          </dt>
          <dd className="mt-2 text-sm text-zinc-400">
            По запросу покажет до пяти коротких роликов; по ссылке сразу отправит компактный плеер.
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Ответы на команды видны только тебе, оформлены как служебные сообщения и не влияют на прогресс звания.
      </p>
    </section>
  )
}
