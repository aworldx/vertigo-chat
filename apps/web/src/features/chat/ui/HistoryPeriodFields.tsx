import { useRef } from "react"
import { historyPreset, type HistoryPreset } from "../model/historyPeriod"

function DateTimeField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  value: string
  min?: string
  max: string
  onChange: (value: string) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="grid min-w-0 flex-1 basis-64 gap-1 text-sm">
      <label htmlFor={id}>{label}</label>
      <div className="flex min-w-0 gap-2">
        <input
          ref={input}
          id={id}
          type="datetime-local"
          required
          step="60"
          value={value}
          min={min}
          max={max}
          aria-describedby="history-time-help"
          onChange={(event) => {
            onChange(event.target.value)
          }}
          className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 p-2 [color-scheme:dark] focus:border-amber-300 focus:outline-none"
        />
        <button
          type="button"
          id={`${id}-picker`}
          aria-label={`Выбрать дату и время: ${label}`}
          onClick={() => {
            try {
              input.current?.showPicker()
            } catch {
              input.current?.focus()
            }
          }}
          className="rounded border border-zinc-700 px-2 text-xs hover:border-amber-300 focus-visible:outline-amber-300"
        >
          Календарь
        </button>
      </div>
    </div>
  )
}

export function HistoryPeriodFields({
  from,
  through,
  onFrom,
  onThrough,
}: {
  from: string
  through: string
  onFrom: (value: string) => void
  onThrough: (value: string) => void
}) {
  const endOfToday = historyPreset("today").through
  const presets: { value: HistoryPreset; label: string }[] = [
    { value: "hour", label: "Последний час" },
    { value: "today", label: "Сегодня" },
    { value: "yesterday", label: "Вчера" },
  ]
  return (
    <div className="grid w-full gap-3">
      <div className="flex flex-wrap gap-3">
        <DateTimeField id="history-from" label="С" value={from} max={through || endOfToday} onChange={onFrom} />
        <DateTimeField
          id="history-through"
          label="По"
          value={through}
          min={from}
          max={endOfToday}
          onChange={onThrough}
        />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Быстрый выбор периода">
        {presets.map((preset) => (
          <button
            key={preset.value}
            id={`history-preset-${preset.value}`}
            type="button"
            onClick={() => {
              const period = historyPreset(preset.value)
              onFrom(period.from)
              onThrough(period.through)
            }}
            className="rounded-full border border-zinc-700 px-3 py-1 text-xs hover:border-amber-300 hover:text-amber-300 focus-visible:outline-amber-300"
          >
            {preset.label}
          </button>
        ))}
      </div>
      <p id="history-time-help" className="text-xs text-zinc-400">
        Дата и время по Москве. Последняя выбранная минута включена целиком. Затем нажми «Показать историю».
      </p>
    </div>
  )
}
