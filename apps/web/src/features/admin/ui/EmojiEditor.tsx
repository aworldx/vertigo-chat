import { formText } from "../../../shared/api/form"
import { useState, type SyntheticEvent } from "react"
import { Field } from "../../../shared/ui/Field"
import { Modal } from "../../../shared/ui/Modal"
import { moderate, remove, adminError, type Emoji, type Tag } from "../api/admin"
export function EmojiEditor({
  emoji: e,
  tags,
  csrf,
  onClose,
  onSaved,
}: {
  emoji: Emoji
  tags: Tag[]
  csrf: string
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const [status, setStatus] = useState<Emoji["status"]>(e.status),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false)
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    const v = new FormData(event.currentTarget)
    setPending(true)
    try {
      await moderate(
        e.id,
        {
          code: formText(v, "code"),
          status,
          rejection_reason: formText(v, "reason"),
          tag_ids: v.getAll("tags").map(Number),
        },
        csrf,
      )
      onSaved("Смайл обновлён.")
    } catch (e) {
      setError(adminError(e))
      setPending(false)
    }
  }
  async function deleteEmoji() {
    setPending(true)
    try {
      await remove("emojis", e.id, csrf)
      onSaved("Смайл удалён.")
    } catch (e) {
      setError(adminError(e))
      setPending(false)
    }
  }
  return (
    <Modal
      id="admin-emoji-editor-modal"
      labelId="admin-emoji-editor-title"
      onClose={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button
        id="close-emoji-editor-backdrop"
        onClick={onClose}
        tabIndex={-1}
        aria-label="Закрыть редактор смайла"
        className="absolute inset-0"
      />
      <form
        id={`admin-emoji-editor-${String(e.id)}`}
        onSubmit={(event) => {
          void submit(event)
        }}
        className="relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-xl border border-amber-300/40 bg-[#111a14] p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4">
          <h3 id="admin-emoji-editor-title" className="text-lg font-semibold text-white">
            Редактирование смайла
          </h3>
          <button
            id="close-emoji-editor"
            type="button"
            onClick={onClose}
            className="rounded px-3 py-2 text-sm text-stone-300 transition hover:bg-emerald-950 hover:text-white"
          >
            Закрыть
          </button>
        </div>
        <img
          src={`/api/v1/admin/emojis/${String(e.id)}/image`}
          alt={e.code}
          width={e.width}
          height={e.height}
          className="h-auto w-auto max-h-24 max-w-24 self-center object-contain"
        />
        <div>
          <Field
            id={`emoji-code-${String(e.id)}`}
            name="code"
            defaultValue={e.code.replace(/^[:-]+|[:-]+$/gu, "")}
            label="Код смайла"
            placeholder="танцую"
            required
          />
          <p className="mt-2 text-xs text-stone-500">
            {e.width}×{e.height} · {e.content_type}
            {e.animated ? " · анимация" : ""}
            {e.author ? " · " + e.author : ""}
          </p>
        </div>
        <div>
          <details
            id={`emoji-tags-${String(e.id)}`}
            className="group rounded-lg border border-emerald-900 bg-[#162019]"
          >
            <summary className="cursor-pointer list-none px-3 py-2 text-sm text-stone-200 marker:hidden">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">Теги</span>
                <span className="truncate text-xs text-stone-400">
                  {tags
                    .filter((t) => e.tag_ids.includes(t.id))
                    .map((t) => t.name)
                    .join(", ") || "не выбраны"}
                </span>
              </span>
            </summary>
            <div className="max-h-44 overflow-y-auto border-t border-emerald-950 p-2">
              {tags.map((t) => (
                <label
                  key={t.id}
                  htmlFor={`emoji-${String(e.id)}-tag-${String(t.id)}`}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-stone-300 hover:bg-emerald-950"
                >
                  <input
                    id={`emoji-${String(e.id)}-tag-${String(t.id)}`}
                    name="tags"
                    type="checkbox"
                    value={t.id}
                    defaultChecked={e.tag_ids.includes(t.id)}
                    className="size-4 rounded border-emerald-700 bg-[#101612] text-amber-300 focus:ring-amber-300"
                  />
                  {t.name}
                </label>
              ))}
              {!tags.length && (
                <p className="px-2 py-1 text-sm text-stone-500">Сначала добавьте теги в разделе «Теги».</p>
              )}
            </div>
          </details>
        </div>
        <div className="space-y-2">
          <label htmlFor={`emoji-status-${String(e.id)}`} className="block text-sm font-medium text-zinc-200">
            Статус
          </label>
          <select
            id={`emoji-status-${String(e.id)}`}
            value={status}
            onChange={(event) => {
              const v = event.target.value
              if (v === "pending" || v === "approved" || v === "rejected") setStatus(v)
            }}
            className="block w-full rounded border border-emerald-900 bg-[#162019] px-3 py-2.5 text-sm text-stone-100"
          >
            {["pending", "approved", "rejected"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {status === "rejected" && (
          <Field
            id={`emoji-rejection-${String(e.id)}`}
            name="reason"
            defaultValue={e.rejection_reason}
            label="Причина отклонения"
          />
        )}
        {error && (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-emerald-950 pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              void deleteEmoji()
            }}
            className="whitespace-nowrap rounded border border-red-400/50 px-4 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-400/10"
          >
            Удалить
          </button>
          <button
            disabled={pending}
            className="whitespace-nowrap rounded bg-amber-300 px-4 py-2.5 text-sm font-semibold text-stone-950 hover:bg-amber-200"
          >
            Сохранить
          </button>
        </div>
      </form>
    </Modal>
  )
}
