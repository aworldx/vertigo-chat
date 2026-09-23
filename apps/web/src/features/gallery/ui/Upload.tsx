import { formText } from "../../../shared/api/form"
import { useState, type SyntheticEvent } from "react"
import { Field } from "../../../shared/ui/Field"
import { compress } from "../model/compress"
import { uploadPhoto, galleryError } from "../api/gallery"
export function Upload({ nickname, csrf, onSaved }: { nickname: string; csrf: string; onSaved: () => void }) {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("")
  async function submit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget,
      values = new FormData(form),
      file = values.get("image")
    if (!(file instanceof File) || !file.size) return
    setPending(true)
    setError("")
    try {
      const [image, thumbnail] = await compress(file)
      await uploadPhoto(image, thumbnail, formText(values, "caption"), csrf)
      form.reset()
      onSaved()
    } catch (e) {
      setError(galleryError(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <form
      id="gallery-upload-form"
      onSubmit={(e) => {
        void submit(e)
      }}
      className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/80 p-4"
    >
      <p className="mb-3 text-sm text-zinc-300">
        Загрузить как <strong className="text-amber-200">{nickname}</strong>
      </p>
      <Field
        id="gallery-photo-caption"
        name="caption"
        type="text"
        label="Название фотографии"
        maxLength={280}
        placeholder="Необязательно"
      />
      <div id="gallery-photo-compressor" className="mt-3 flex items-center gap-3">
        <input
          id="gallery-photo-file"
          aria-label="Фотография"
          type="file"
          name="image"
          accept=".jpg,.jpeg,.png,.webp"
          required
          disabled={pending}
          className="min-w-0 flex-1 text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-zinc-100"
        />
        <button
          id="upload-gallery-photo"
          disabled={pending}
          className="shrink-0 rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
        >
          {pending ? "Загрузка…" : "Добавить"}
        </button>
      </div>
      <p className="mt-2 text-xs text-zinc-500">JPG, PNG или WebP. Снимок будет уменьшен до 1600 px.</p>
      {error && (
        <div id="gallery-upload-error" className="mt-2 space-y-1 text-xs text-red-300" role="alert">
          <p>{error}</p>
        </div>
      )}
    </form>
  )
}
