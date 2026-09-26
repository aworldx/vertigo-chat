import { useState } from "react"
import { Field } from "../../../shared/ui/Field"
import { saveBotLimits, type AdminBots } from "../api/bots"
import { useBotSave } from "../model/useBotSave"
import { botPanel, botButton, BotSaveStatus } from "./BotSaveStatus"
const number = (v: number) => v.toLocaleString("ru-RU")
export function BotBudget({ data, csrf, onSaved }: { data: AdminBots; csrf: string; onSaved: () => void }) {
  const [limit, setLimit] = useState(String(data.limits.daily_tokens)),
    [percent, setPercent] = useState(String(data.limits.stop_percent)),
    status = useBotSave()
  const threshold = Math.ceil((Number(limit) * Number(percent)) / 100)
  const offset = data.utc_offset_minutes,
    timezone = `UTC${offset >= 0 ? "+" : "−"}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0")}:${String(Math.abs(offset) % 60).padStart(2, "0")}`
  return (
    <section id="admin-bot-budget" className={botPanel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-white">Общий бюджет токенов</h3>
        <button
          id="refresh-bot-usage"
          type="button"
          onClick={onSaved}
          className="text-sm text-amber-200 underline underline-offset-4 hover:text-amber-100"
        >
          Обновить расход
        </button>
      </div>
      <p className="mt-2 text-sm text-stone-400">
        Общий расход Хичкока, Клэр и Кармика: ответы, фоновые диалоги, память и оценки кармы. Новый день начинается в
        00:00 ({timezone}).
      </p>
      <dl className="my-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Использовано сегодня", number(data.used_tokens)],
          ["Суточный лимит", data.limits.daily_tokens === 0 ? "Без лимита" : number(data.limits.daily_tokens)],
          [
            "Осталось до остановки",
            data.limits.daily_tokens === 0 ? "Без лимита" : number(Math.max(0, data.stop_threshold - data.used_tokens)),
          ],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-black/20 p-4">
            <dt className="text-xs text-stone-400">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-amber-200">{value}</dd>
          </div>
        ))}
      </dl>
      <form
        id="bot-budget-form"
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void status.save(
            () => saveBotLimits({ daily_tokens: Number(limit), stop_percent: Number(percent) }, csrf),
            onSaved,
          )
        }}
      >
        <fieldset disabled={status.pending} className="grid gap-4 sm:grid-cols-2">
          <Field
            id="bot-daily-tokens"
            label="Токенов в сутки"
            type="number"
            min={0}
            max={1000000000}
            step={1}
            required
            value={limit}
            onChange={(e) => {
              setLimit(e.target.value)
            }}
          />
          <Field
            id="bot-stop-percent"
            label="Останавливать при расходе, %"
            type="number"
            min={1}
            max={100}
            step={1}
            required
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value)
            }}
          />
        </fieldset>
        <p className="text-sm text-stone-400">
          {Number(limit) === 0
            ? "0 — без ограничения токенов."
            : `Новые запросы остановятся после ${number(threshold)} токенов. Текущий запрос может превысить порог.`}{" "}
          Изменение лимита не сбрасывает расход.
        </p>
        <BotSaveStatus error={status.error} notice={status.notice} />
        <button id="save-bot-budget" className={botButton} disabled={status.pending}>
          {status.pending ? "Сохраняем…" : "Сохранить лимиты"}
        </button>
      </form>
    </section>
  )
}
