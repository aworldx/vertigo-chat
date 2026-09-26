import { useRemote } from "../../../shared/model/useRemote"
import { loadBots } from "../api/bots"
import { adminError } from "../api/admin"
import { BotBudget } from "./BotBudget"
import { BotStyleEditor } from "./BotStyleEditor"
export function Bots({ csrf }: { csrf: string }) {
  const { data, error, refresh } = useRemote("bots", loadBots, adminError)
  return (
    <div id="admin-bots" className="space-y-6">
      <header>
        <p className="text-sm font-medium text-amber-300">Управление</p>
        <h2 className="mt-1 text-2xl font-semibold text-white">Боты</h2>
        <p className="mt-2 text-sm text-stone-400">
          Лимиты действуют без перезапуска. Стиль применяется к новым сообщениям и никам в списке участников.
        </p>
      </header>
      {error ? (
        <div role="alert">
          {error}{" "}
          <button id="retry-bots" className="underline" onClick={refresh}>
            Повторить
          </button>
        </div>
      ) : !data ? (
        <p role="status">Загружаем настройки ботов…</p>
      ) : (
        <>
          <BotBudget data={data} csrf={csrf} onSaved={refresh} />
          {data.bots.map((bot) => (
            <BotStyleEditor key={bot.id} bot={bot} csrf={csrf} onSaved={refresh} />
          ))}
        </>
      )}
    </div>
  )
}
