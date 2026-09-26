import { useState } from "react"
import { inputClass } from "../../../shared/ui/Field"
import { botFonts, saveBotStyle, type BotStyle, type AdminBot } from "../api/bots"
import { useBotSave } from "../model/useBotSave"
import { botPanel, botButton, BotSaveStatus } from "./BotSaveStatus"
function ColorPreview({
  bot,
  value,
  mode,
  onChange,
}: {
  bot: AdminBot
  value: BotStyle
  mode: "dark" | "light"
  onChange: (v: BotStyle) => void
}) {
  return (
    <section className="space-y-3 rounded-xl border border-emerald-950 p-3">
      <h4 className="text-sm font-medium text-stone-300">{mode === "dark" ? "Тёмная тема" : "Светлая тема"}</h4>
      <div className="grid grid-cols-2 gap-3">
        {(["nickname_color", "text_color"] as const).map((field) => (
          <label key={field} className="text-xs text-stone-400" htmlFor={`${bot.id}-${mode}-${field}`}>
            {field === "nickname_color" ? "Цвет ника" : "Цвет сообщения"}
            <input
              id={`${bot.id}-${mode}-${field}`}
              className="mt-2 block h-10 w-full cursor-pointer rounded border border-zinc-700 bg-transparent"
              type="color"
              value={value[mode][field]}
              onChange={(e) => {
                onChange({ ...value, [mode]: { ...value[mode], [field]: e.target.value } })
              }}
            />
          </label>
        ))}
      </div>
      <div
        id={`${bot.id}-preview-${mode}`}
        className={`chat-message-entry rounded-lg p-4 text-sm ${mode === "dark" ? "bg-zinc-950" : "bg-stone-100"}`}
        data-message-font={value.font_id}
        data-message-font-style={value.font_style}
      >
        <span className="font-semibold" style={{ color: value[mode].nickname_color }}>
          {bot.name}:{" "}
        </span>
        <span style={{ color: value[mode].text_color }}>Привет! Как проходит твой день?</span>
      </div>
    </section>
  )
}
export function BotStyleEditor({ bot, csrf, onSaved }: { bot: AdminBot; csrf: string; onSaved: () => void }) {
  const [value, setValue] = useState(bot.style),
    status = useBotSave()
  return (
    <section id={`admin-bot-${bot.id}`} className={botPanel}>
      <h3 className="text-xl font-semibold text-white">{bot.name}</h3>
      <form
        id={`${bot.id}-style-form`}
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void status.save(() => saveBotStyle(bot.id, value, csrf), onSaved)
        }}
      >
        <fieldset disabled={status.pending} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-stone-300" htmlFor={`${bot.id}-font`}>
              Шрифт
              <select
                id={`${bot.id}-font`}
                className={inputClass}
                value={value.font_id}
                onChange={(e) => {
                  const font = botFonts.find((f) => f.id === e.target.value)
                  if (font) setValue({ ...value, font_id: font.id })
                }}
              >
                {botFonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-stone-300" htmlFor={`${bot.id}-font-style`}>
              Начертание
              <select
                id={`${bot.id}-font-style`}
                className={inputClass}
                value={value.font_style}
                onChange={(e) => {
                  setValue({ ...value, font_style: e.target.value === "italic" ? "italic" : "normal" })
                }}
              >
                <option value="normal">Обычный</option>
                <option value="italic">Курсив</option>
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["dark", "light"] as const).map((mode) => (
              <ColorPreview key={mode} bot={bot} value={value} mode={mode} onChange={setValue} />
            ))}
          </div>
        </fieldset>
        <BotSaveStatus error={status.error} notice={status.notice} />
        <button id={`save-${bot.id}-style`} className={botButton} disabled={status.pending}>
          {status.pending ? "Сохраняем…" : "Сохранить стиль"}
        </button>
      </form>
    </section>
  )
}
