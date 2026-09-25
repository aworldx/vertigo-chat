import { RichTextEditor } from "./RichTextEditor"
import { ArticleText } from "./ArticleText"
import { articleBodyLimit } from "../model/articleText"
import { Icon } from "../../../shared/ui/Icon"
import { useState, type SyntheticEvent } from "react"
import { Field } from "../../../shared/ui/Field"
import { Modal } from "../../../shared/ui/Modal"
import { saveArticle, libraryError, type Article, type Series } from "../api/library"
export function Editor({
  article,
  nickname,
  csrf,
  series,
  onClose,
  onSaved,
}: {
  article: Article | null
  nickname: string
  csrf: string
  series: Series[]
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState(article?.title ?? ""),
    [body, setBody] = useState(article?.body ?? ""),
    [group, setGroup] = useState(article?.series ?? ""),
    [part, setPart] = useState(article?.part_number?.toString() ?? ""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false)
  async function submit(e: SyntheticEvent) {
    e.preventDefault()
    if (!body.trim() || Array.from(body).length > articleBodyLimit) {
      setError("Текст должен содержать от 1 до 12000 символов с форматированием.")
      return
    }
    setPending(true)
    setError("")
    try {
      await saveArticle(article?.id, { title, body, series: group, part_number: part ? Number(part) : null }, csrf)
      onSaved()
    } catch (e) {
      setError(libraryError(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal
      id="library-editor"
      labelId="library-editor-title"
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/90 p-3 backdrop-blur-md sm:p-6"
    >
      <div className="mx-auto max-w-6xl rounded-2xl border border-amber-800/50 bg-stone-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-800 px-5 py-4 sm:px-7">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-400">Авторский стол</p>
            <h2 id="library-editor-title" className="mt-1 text-2xl text-amber-50">
              {article ? "Редактирование" : "Новая статья"}
            </h2>
          </div>
          <button
            id="cancel-library-editor"
            type="button"
            aria-label="Закрыть редактор"
            onClick={onClose}
            className="rounded-lg border border-stone-700 p-2 text-stone-400 transition hover:border-amber-400 hover:text-amber-200"
          >
            <Icon name="x-mark" className="size-5" />
          </button>
        </div>
        <form
          id="library-article-form"
          onSubmit={(e) => {
            void submit(e)
          }}
          className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]"
        >
          <div className="space-y-6 p-5 sm:p-7">
            <Field
              id="article_title"
              label="Название"
              maxLength={160}
              placeholder="Название статьи"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
              }}
              required
            />
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <Field
                id="article_series"
                label="Серия — необязательно"
                maxLength={120}
                placeholder="Например, Хроники Vertigo"
                list="library-series-suggestions"
                value={group}
                onChange={(e) => {
                  setGroup(e.target.value)
                }}
              />
              <Field
                id="article_part_number"
                type="number"
                label="Номер части"
                min={1}
                max={999}
                placeholder="1"
                value={part}
                onChange={(e) => {
                  setPart(e.target.value)
                }}
              />
            </div>
            <datalist id="library-series-suggestions">
              {[...new Set(series.map((s) => s.name))].map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <div>
              <RichTextEditor initialBody={article?.body ?? ""} onChange={setBody} disabled={pending} />
              <div className="mt-2 flex items-center justify-between gap-4 text-xs">
                <span className="text-stone-500">
                  Лимит включает форматирование. Большой текст можно разделить на части.
                </span>
                <span id="article-character-count" className="text-stone-400">
                  {`${String(Array.from(body).length)} / 12000`}
                </span>
              </div>
            </div>
            {error && (
              <p role="alert" className="text-red-300">
                {error}
              </p>
            )}
            <button
              id="save-library-article"
              disabled={pending || !body.trim() || Array.from(body).length > articleBodyLimit}
              className="w-full rounded-xl bg-amber-300 px-5 py-3.5 font-semibold text-stone-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-60"
            >
              {pending ? "Сохраняем…" : "Сохранить статью"}
            </button>
          </div>
          <aside className="border-t border-stone-800 bg-[#f0e2c3] p-5 text-stone-900 lg:border-l lg:border-t-0 sm:p-7">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Предпросмотр</p>
            <h3 className="mt-3 font-serif text-3xl leading-tight">{title || "Название статьи"}</h3>
            <p className="mt-3 text-xs text-stone-500">{nickname}</p>
            <p className="mt-1 text-xs text-stone-600">До 10 новых статей в сутки и 50 всего.</p>
            <div className="mt-6 font-serif text-base leading-8">
              <ArticleText body={body || "Текст появится здесь по мере набора."} />
            </div>
          </aside>
        </form>
      </div>
    </Modal>
  )
}
