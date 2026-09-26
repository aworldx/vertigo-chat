import { chatCommands } from "../../../shared/chatCommands"
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
        {chatCommands.map((command) => (
          <div key={command.input} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <dt>
              <code className="font-semibold text-amber-200">{command.label}</code>
            </dt>
            <dd className="mt-2 text-sm text-zinc-400">{command.description}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs leading-5 text-zinc-500">
        Ответы на команды видны только тебе, оформлены как служебные сообщения и не влияют на прогресс звания.
      </p>
    </section>
  )
}
