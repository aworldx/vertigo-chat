import { formText } from "../../../shared/api/form"
import { useState, type SyntheticEvent } from "react"
import { Field, TextField } from "../../../shared/ui/Field"
import { saveTag, remove, adminError, type Tag } from "../api/admin"
function TagForm({ tag, csrf, onSaved }: { tag: Tag | null; csrf: string; onSaved: (message: string) => void }) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false)
  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget,
      v = new FormData(form)
    setPending(true)
    try {
      await saveTag(tag?.id ?? 0, formText(v, "name"), formText(v, "triggers"), csrf)
      if (!tag) form.reset()
      setError("")
      onSaved(tag ? "Тег обновлён." : "Тег добавлен.")
    } catch (e) {
      setError(adminError(e))
    } finally {
      setPending(false)
    }
  }
  async function deleteTag() {
    if (!tag) return
    setPending(true)
    try {
      await remove("emoji-tags", tag.id, csrf)
      onSaved("Тег удалён.")
    } catch (e) {
      setError(adminError(e))
      setPending(false)
    }
  }
  const suffix = tag ? `-${String(tag.id)}` : ""
  return (
    <>
      <form
        id={tag ? `edit-emoji-tag-${String(tag.id)}` : "admin-emoji-tag-form"}
        onSubmit={(e) => {
          void submit(e)
        }}
        className={
          tag ? "grid gap-3" : "mt-5 grid max-w-3xl gap-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"
        }
      >
        <Field
          id={`emoji-tag-name${suffix}`}
          name="name"
          defaultValue={tag?.name ?? ""}
          label={tag ? "Тег" : "Новый тег"}
          placeholder={tag ? undefined : "грусть"}
          required
        />
        <TextField
          id={`emoji-tag-triggers${suffix}`}
          name="triggers"
          defaultValue={tag?.triggers.join("\n") ?? ""}
          rows={tag ? 4 : 3}
          label={tag ? "Триггеры — по одному на строку" : "Триггеры — необязательно"}
          placeholder={tag ? "Например: печаль, грустно, 😢" : "По одному на строку: печаль, грустно, 😢"}
        />
        <button
          disabled={pending}
          className={
            tag
              ? "justify-self-start rounded bg-amber-300 px-3 py-2 text-xs font-semibold text-stone-950 hover:bg-amber-200"
              : "shrink-0 rounded-lg bg-amber-300 px-4 py-2.5 font-semibold text-stone-950 hover:bg-amber-200"
          }
        >
          {tag ? "Сохранить" : "Добавить"}
        </button>
      </form>
      {tag && (
        <div className="mt-3">
          <button
            id={`delete-emoji-tag-${String(tag.id)}`}
            disabled={pending}
            onClick={() => {
              void deleteTag()
            }}
            className="text-xs text-red-300 hover:text-red-200"
          >
            Удалить тег
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
    </>
  )
}
export function Tags({ tags, csrf, onSaved }: { tags: Tag[]; csrf: string; onSaved: (message: string) => void }) {
  return (
    <section
      id="emoji-tags"
      className="rounded-2xl border border-emerald-950 bg-[#162019] p-5 shadow-xl shadow-black/20 sm:p-6"
    >
      <p className="text-sm font-medium text-amber-300">Справочник</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">Теги смайлов</h2>
      <TagForm tag={null} csrf={csrf} onSaved={onSaved} />
      <p className="mt-3 max-w-3xl text-sm text-stone-400">
        Тег и его триггеры используются для автоподбора. Триггером может быть слово, эмодзи или целая фраза; указывайте
        по одному на строку.
      </p>
      <div id="admin-emoji-tags-list" className="mt-6 grid gap-3 sm:grid-cols-2">
        {tags.map((t) => (
          <details
            key={t.id}
            id={`admin-emoji-tag-${String(t.id)}`}
            className="group rounded-lg border border-emerald-950 bg-[#111a14] text-sm text-stone-200"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 marker:hidden hover:bg-emerald-950/40">
              <span className="min-w-0">
                <span className="font-medium text-stone-100">{t.name}</span>{" "}
                {t.triggers.length > 0 && (
                  <span className="ml-2 text-xs text-stone-500">{t.triggers.slice(0, 3).join(" · ")}</span>
                )}
              </span>
              <span className="shrink-0 text-xs text-stone-400">{t.triggers.length} триггеров · изменить</span>
            </summary>
            <div className="border-t border-emerald-950 p-3">
              <TagForm tag={t} csrf={csrf} onSaved={onSaved} />
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
