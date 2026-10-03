import { RichTextEditor } from "./RichTextEditor"
import { ArticleText } from "./ArticleText"
import { articleBodyLimit } from "../model/articleText"
import { Icon } from "../../../shared/ui/Icon"
import { useEffect, useRef, useState, type SyntheticEvent } from "react"
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
    [workAuthor, setWorkAuthor] = useState(article?.work_author ?? ""),
    [body, setBody] = useState(article?.body ?? ""),
    [group, setGroup] = useState(article?.series ?? ""),
    [part, setPart] = useState(article?.part_number?.toString() ?? ""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [mobileView, setMobileView] = useState<"editor" | "preview">("editor"),
    [confirmClose, setConfirmClose] = useState(false)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmClose) keepEditingRef.current?.focus()
  }, [confirmClose])
  const changed =
    title !== (article?.title ?? "") ||
    workAuthor !== (article?.work_author ?? "") ||
    body !== (article?.body ?? "") ||
    group !== (article?.series ?? "") ||
    part !== (article?.part_number?.toString() ?? "")
  function requestClose() {
    if (pending) return
    if (confirmClose) {
      setConfirmClose(false)
      return
    }
    if (changed) {
      setConfirmClose(true)
      return
    }
    onClose()
  }
  async function submit(e: SyntheticEvent) {
    e.preventDefault()
    if (!body.trim() || Array.from(body).length > articleBodyLimit) {
      setError("Текст должен содержать от 1 до 12000 символов с форматированием.")
      return
    }
    setPending(true)
    setError("")
    try {
      await saveArticle(
        article?.id,
        { title, body, series: group, part_number: part ? Number(part) : null, work_author: workAuthor },
        csrf,
      )
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
      onClose={requestClose}
      className="library-editor-modal fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6"
    >
      <div className="relative mx-auto max-w-6xl rounded-2xl border border-amber-800/50 bg-stone-950 shadow-2xl">
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
            onClick={requestClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-stone-700 p-2 text-stone-400 transition hover:border-amber-400 hover:text-amber-200"
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
          <div className="col-span-full border-b border-stone-800 p-3 lg:hidden">
            <div role="tablist" aria-label="Режим редактора" className="grid grid-cols-2 rounded-xl bg-stone-900 p-1">
              <button
                id="library-editor-tab"
                type="button"
                role="tab"
                aria-selected={mobileView === "editor"}
                onClick={() => {
                  setMobileView("editor")
                }}
                className={`min-h-11 rounded-lg px-3 text-sm transition ${mobileView === "editor" ? "bg-amber-300 font-semibold text-stone-950 shadow" : "text-stone-300 hover:text-amber-100"}`}
              >
                Редактор
              </button>
              <button
                id="library-preview-tab"
                type="button"
                role="tab"
                aria-selected={mobileView === "preview"}
                onClick={() => {
                  setMobileView("preview")
                }}
                className={`min-h-11 rounded-lg px-3 text-sm transition ${mobileView === "preview" ? "bg-amber-300 font-semibold text-stone-950 shadow" : "text-stone-300 hover:text-amber-100"}`}
              >
                Предпросмотр
              </button>
            </div>
          </div>
          <div className={`space-y-6 p-5 pb-24 sm:p-7 lg:pb-7 ${mobileView === "preview" ? "hidden lg:block" : ""}`}>
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
            <Field
              id="article_work_author"
              label="Автор произведения — необязательно"
              maxLength={120}
              placeholder="Если текст написал другой автор"
              value={workAuthor}
              onChange={(e) => {
                setWorkAuthor(e.target.value)
              }}
            />
            <div className="library-editor-series grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
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
              className="hidden w-full rounded-xl bg-amber-300 px-5 py-3.5 font-semibold text-stone-950 shadow-lg shadow-amber-950/20 transition hover:-translate-y-0.5 hover:bg-amber-200 disabled:opacity-60 lg:block"
            >
              {pending ? "Сохраняем…" : "Сохранить статью"}
            </button>
          </div>
          <aside
            role="tabpanel"
            aria-labelledby="library-preview-tab"
            className={`library-editor-preview relative overflow-hidden border-t border-stone-800 bg-stone-950/95 p-5 text-stone-100 lg:border-l lg:border-t-0 sm:p-7 ${mobileView === "editor" ? "hidden lg:block" : ""}`}
          >
            <div className="relative z-10">
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Предпросмотр</p>
              <h3 className="library-preview-title mt-3 text-3xl leading-tight text-amber-50">
                {title || "Название статьи"}
              </h3>
              <p className="mt-3 text-xs text-stone-500">
                {workAuthor.trim() ? `Автор: ${workAuthor.trim()} · Опубликовал: ${nickname}` : nickname}
              </p>
              <p className="mt-1 text-xs text-stone-500">До 10 новых статей в сутки и 50 всего.</p>
              <div className="mt-6 font-serif text-base leading-8 text-stone-200">
                <ArticleText body={body || "Текст появится здесь по мере набора."} />
              </div>
            </div>
          </aside>
          <div className="fixed bottom-3 left-3 right-3 z-[55] rounded-2xl border border-amber-400/40 bg-stone-950/95 p-2 shadow-2xl backdrop-blur-md lg:hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <button
                id="save-library-article-mobile"
                disabled={pending || !body.trim() || Array.from(body).length > articleBodyLimit}
                className="min-h-11 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 disabled:opacity-60"
              >
                {pending ? "Сохраняем…" : "Сохранить статью"}
              </button>
              <button
                id="close-library-editor-mobile"
                type="button"
                onClick={requestClose}
                className="min-h-11 rounded-xl border border-stone-700 px-3 text-sm text-stone-300 transition hover:border-amber-400 hover:text-amber-100"
              >
                Закрыть
              </button>
            </div>
          </div>
        </form>
        {confirmClose && (
          <div
            className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/80 p-5 backdrop-blur-sm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="library-discard-title"
            aria-describedby="library-discard-description"
          >
            <div className="w-full max-w-md rounded-2xl border border-amber-800/60 bg-stone-950 p-6 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Несохранённые изменения</p>
              <h3 id="library-discard-title" className="mt-2 text-xl text-amber-50">
                Закрыть без сохранения?
              </h3>
              <p id="library-discard-description" className="mt-3 text-sm leading-6 text-stone-400">
                Изменения в тексте и полях статьи будут потеряны.
              </p>
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  id="keep-editing-library-article"
                  type="button"
                  ref={keepEditingRef}
                  onClick={() => {
                    setConfirmClose(false)
                  }}
                  className="min-h-11 rounded-xl border border-stone-700 px-4 text-sm text-stone-200 transition hover:border-amber-400 hover:text-amber-100"
                >
                  Продолжить редактирование
                </button>
                <button
                  id="discard-library-article"
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-xl bg-red-400 px-4 text-sm font-semibold text-stone-950 transition hover:bg-red-300"
                >
                  Закрыть без сохранения
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
