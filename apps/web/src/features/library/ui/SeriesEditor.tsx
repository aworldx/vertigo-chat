import { useState, type SyntheticEvent } from "react"
import { Modal } from "../../../shared/ui/Modal"
import { libraryError, type Series } from "../api/library"
import { saveSeries } from "../api/reading"
export function SeriesEditor({
  series,
  csrf,
  onClose,
  onSaved,
}: {
  series: Series
  csrf: string
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const [name, setName] = useState(series.name)
  const [description, setDescription] = useState(series.description)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function submit(event: SyntheticEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      await saveSeries({ original_name: series.name, name, description }, csrf)
      onSaved(name.trim())
    } catch (error) {
      setError(libraryError(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal
      id="library-series-editor"
      labelId="library-series-editor-title"
      className="library-series-modal"
      onClose={() => {
        if (!pending) onClose()
      }}
    >
      <div className="library-series-dialog">
        <h2 id="library-series-editor-title">Редактирование серии</h2>
        <form
          id="library-series-form"
          onSubmit={(event) => {
            void submit(event)
          }}
        >
          <label htmlFor="library-series-name">
            Название серии
            <input
              id="library-series-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
              }}
              maxLength={120}
              required
              disabled={pending}
            />
          </label>
          <label htmlFor="library-series-description">
            Описание серии
            <textarea
              id="library-series-description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
              }}
              maxLength={2000}
              disabled={pending}
            />
          </label>
          {error && (
            <p role="alert" className="library-feedback">
              {error}
            </p>
          )}
          <div className="library-reading-actions">
            <button
              id="cancel-library-series"
              type="button"
              className="library-action"
              disabled={pending}
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              id="save-library-series"
              type="submit"
              className="library-action"
              disabled={pending || !name.trim()}
            >
              {pending ? "Сохраняем…" : "Сохранить серию"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}
