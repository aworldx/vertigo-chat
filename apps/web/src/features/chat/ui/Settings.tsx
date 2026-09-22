import { Icon } from "../../../shared/ui/Icon"
import { Modal } from "../../../shared/ui/Modal"
import { fonts, themes, type Preferences } from "../api/preferences"
import type { CSSProperties } from "react"
const selectClass =
  "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-amber-300"
export function Settings({
  value,
  nickname,
  onChange,
  onClose,
  onSave,
  saving,
  error,
}: {
  value: Preferences
  nickname: string
  onChange: (p: Preferences) => void
  onClose: () => void
  onSave: () => Promise<void>
  saving: boolean
  error: string
}) {
  const appearance = value.appearance
  const style: CSSProperties & Record<`--${string}`, string> = {
    "--nick-dark": appearance.dark.nickname_color,
    "--text-dark": appearance.dark.text_color,
    "--nick-light": appearance.light.nickname_color,
    "--text-light": appearance.light.text_color,
  }
  return (
    <Modal
      id="settings-modal"
      labelId="settings-modal-title"
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button
        id="settings-modal-backdrop"
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Закрыть настройки"
      />
      <section className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Личный стиль</p>
            <h2 id="settings-modal-title" className="mt-1 text-2xl font-semibold text-zinc-100">
              Настройки
            </h2>
            <p className="mt-1 text-sm text-zinc-400">Настрой чат под себя.</p>
          </div>
          <button
            id="close-settings"
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            aria-label="Закрыть настройки"
          >
            <Icon name="x-mark" className="size-5" />
          </button>
        </div>
        <div className="p-5 sm:p-6">
          <form
            id="preferences-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void onSave()
            }}
          >
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Icon name="swatch" className="size-4 text-amber-300" />
                <h3 className="text-sm font-semibold text-zinc-100">Интерфейс</h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-zinc-400">Тема</span>
                  <select
                    id="theme-id"
                    className={selectClass}
                    value={value.theme_id}
                    onChange={(e) => {
                      const theme = themes.find((t) => t.id === e.target.value)
                      if (theme) onChange({ ...value, theme_id: theme.id })
                    }}
                  >
                    {themes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-zinc-400">Вид сообщений</span>
                  <select
                    id="message-frame"
                    className={selectClass}
                    value={String(appearance.message_frame)}
                    onChange={(e) => {
                      onChange({ ...value, appearance: { ...appearance, message_frame: e.target.value === "true" } })
                    }}
                  >
                    <option value="true">В рамке · с реакциями</option>
                    <option value="false">Строкой · без реакций</option>
                  </select>
                </label>
              </div>
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Icon name="chat-bubble-left-right" className="size-4 text-amber-300" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">Мои сообщения</h3>
                  <p className="text-xs text-zinc-500">Шрифт увидят только собеседники в твоих сообщениях.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-400">Шрифт</span>
                  <select
                    id="font-id"
                    className={selectClass}
                    value={value.font_id}
                    onChange={(e) => {
                      const font = fonts.find((f) => f.id === e.target.value)
                      if (font) onChange({ ...value, font_id: font.id })
                    }}
                  >
                    {fonts.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-zinc-400">Начертание</span>
                  <select
                    id="font-style"
                    className={selectClass}
                    value={value.font_style}
                    onChange={(e) => {
                      onChange({ ...value, font_style: e.target.value === "italic" ? "italic" : "normal" })
                    }}
                  >
                    <option value="normal">Обычный</option>
                    <option value="italic">Курсив</option>
                  </select>
                </label>
              </div>
            </section>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
              <label
                htmlFor="message-sound-enabled"
                aria-label="Звук новых сообщений"
                className="flex cursor-pointer items-center gap-3"
              >
                <input
                  id="message-sound-enabled"
                  type="checkbox"
                  className="peer sr-only"
                  checked={value.message_sound_enabled}
                  onChange={(e) => {
                    onChange({ ...value, message_sound_enabled: e.target.checked })
                  }}
                />
                <span className="relative flex h-6 w-11 shrink-0 rounded-full bg-zinc-700 transition peer-checked:bg-amber-300 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-zinc-100">Звуковые уведомления</span>
                  <span className="mt-0.5 block text-xs leading-4 text-zinc-500">
                    Личные сообщения и обращения по нику.
                  </span>
                </span>
              </label>
            </section>
            <details id="appearance-colors" className="group rounded-2xl border border-zinc-800 bg-zinc-950/70">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-100 marker:content-none">
                <Icon name="paint-brush" className="size-4 text-amber-300" />
                Цвета моих сообщений<span className="ml-auto text-xs font-normal text-zinc-500">Дополнительно</span>
                <Icon name="chevron-down" className="size-4 text-zinc-500 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 border-t border-zinc-800 p-4">
                <p className="text-xs leading-4 text-zinc-500">Отдельные цвета для светлых и тёмных тем.</p>
                {(["dark", "light"] as const).map((mode) => (
                  <div key={mode} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                    <p className="mb-2 text-xs font-semibold text-zinc-400">
                      {mode === "dark" ? "Тёмный фон" : "Светлый фон"}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["nickname", "text"] as const).map((field) => (
                        <label key={field} className="block text-sm">
                          <span className="mb-1 block text-zinc-400">{field === "nickname" ? "Ник" : "Текст"}</span>
                          <input
                            id={`${mode}-${field}-color`}
                            type="color"
                            value={appearance[mode][`${field}_color`]}
                            onChange={(e) => {
                              onChange({
                                ...value,
                                appearance: {
                                  ...appearance,
                                  [mode]: { ...appearance[mode], [`${field}_color`]: e.target.value },
                                },
                              })
                            }}
                            className="h-9 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </details>
            <section
              className={`chat-message-entry rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm ${appearance.message_frame ? "" : "border-transparent bg-transparent px-0"}`}
              data-message-font={value.font_id}
              data-message-font-style={value.font_style}
            >
              <p className="mb-1 text-xs font-medium text-zinc-500">Предпросмотр</p>
              <span className="chat-preview-nickname font-semibold" style={style}>
                {nickname}
                {appearance.message_frame ? "" : ":"}{" "}
              </span>{" "}
              <span className="chat-preview-text" style={style}>
                {" "}
                пример текста
              </span>
            </section>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <button
              id="save-preferences"
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-amber-300 px-3 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200 disabled:opacity-60"
            >
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </form>
        </div>
      </section>
    </Modal>
  )
}
