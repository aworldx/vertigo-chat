import { useState, type SyntheticEvent, type ReactNode } from "react"
import { Field } from "../../../shared/ui/Field"
import { uploadEmoji, adminError, type Emoji } from "../api/admin"
export function Emojis({
  emojis,
  csrf,
  selected,
  onSaved,
  navigate,
  children,
}: {
  children?: ReactNode
  emojis: Emoji[]
  csrf: string
  selected: number
  onSaved: (message: string) => void
  navigate: (url: string) => void
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false)
  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setPending(true)
    try {
      await uploadEmoji(new FormData(form), csrf)
      form.reset()
      setError("")
      onSaved("Смайл отправлен в очередь модерации.")
    } catch (e) {
      setError(adminError(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <section
      id="emojis"
      className="rounded-2xl border border-emerald-950 bg-[#162019] p-5 shadow-xl shadow-black/20 sm:p-6"
    >
      <p className="text-sm font-medium text-amber-300">Контент</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">Смайлы</h2>
      <form
        id="admin-emoji-form"
        onSubmit={(e) => {
          void submit(e)
        }}
        className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <Field id="emoji-code" name="code" label="Код без двоеточий" placeholder="гляжу_кота" required />
        <Field
          id="emoji-image"
          name="image"
          type="file"
          accept="image/png,image/webp,image/gif"
          label="PNG, WebP или GIF до 700 КБ, 100×100 px"
          required
        />
        <button
          id="admin-emoji-submit"
          disabled={pending}
          className="rounded-lg bg-amber-300 px-4 py-2.5 font-semibold text-stone-950 transition hover:bg-amber-200"
        >
          Добавить
        </button>
      </form>
      {error && (
        <p role="alert" className="text-red-300">
          {error}
        </p>
      )}
      <p className="mt-3 text-sm text-stone-400">
        {"\n            До 700 КБ и 100×100 px. Введите код без двоеточий: "}
        <code>кот_плачет</code>
        {". В сообщениях он будет выглядеть как "}
        <code>:кот_плачет:</code>
        {".\n          "}
      </p>
      <div id="admin-emojis-list" className="mt-5 space-y-6">
        {(
          [
            ["pending", "На модерации"],
            ["approved", "Одобренные"],
            ["rejected", "Отклонённые"],
          ] as const
        ).map(([status, title]) => {
          const items = emojis.filter((e) => e.status === status)
          return (
            items.length > 0 && (
              <section key={status} id={`admin-emojis-${status}`}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">{title}</h3>
                <div
                  id={`admin-emojis-${status}-grid`}
                  className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(6rem,1fr))]"
                >
                  {items.map((e) => (
                    <a
                      key={e.id}
                      id={`admin-emoji-${String(e.id)}`}
                      href={`/admin?section=emojis&emoji_id=${String(e.id)}`}
                      onClick={(event) => {
                        event.preventDefault()
                        navigate(event.currentTarget.href)
                      }}
                      aria-current={selected === e.id ? "true" : undefined}
                      className={`group flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border bg-[#111a14] p-2 text-center transition hover:border-amber-300 hover:bg-amber-300/10 ${selected === e.id ? "border-amber-300 ring-2 ring-amber-300/30" : "border-emerald-950"}`}
                    >
                      <img
                        src={`/api/v1/admin/emojis/${String(e.id)}/image`}
                        alt={e.code}
                        width={e.width}
                        height={e.height}
                        className="h-auto w-auto max-h-12 max-w-12 object-contain"
                      />
                      <span className="w-full truncate text-xs text-stone-300">{e.code.replaceAll(":", "")}</span>
                    </a>
                  ))}
                </div>
              </section>
            )
          )
        })}
      </div>
      {!emojis.length && <p className="mt-5 text-sm text-stone-500">Смайлов пока нет.</p>}
      {children}
    </section>
  )
}
