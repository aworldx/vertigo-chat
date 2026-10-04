import { useRef } from "react"
import { useImageUpload } from "../model/useImageUpload"
export function CoverUpload({
  value,
  onChange,
  csrf,
  disabled,
  onBusy,
}: {
  value: string
  onChange: (url: string) => void
  csrf: string
  disabled: boolean
  onBusy: (busy: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const { upload, pending, error } = useImageUpload(csrf, onBusy)
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-zinc-200">Обложка — необязательно</p>
      <div className="library-cover-field">
        {value && <img src={value} alt="Обложка статьи" />}
        <div>
          <div className="library-reading-actions">
            <button
              id="library-cover-upload"
              type="button"
              className="library-action"
              disabled={disabled || pending}
              onClick={() => input.current?.click()}
            >
              {pending ? "Загружаем…" : value ? "Заменить обложку" : "Загрузить обложку"}
            </button>
            {value && (
              <button
                id="library-cover-remove"
                type="button"
                className="library-action"
                disabled={disabled || pending}
                onClick={() => {
                  onChange("")
                }}
              >
                Убрать обложку
              </button>
            )}
          </div>
          <p>JPEG или PNG, до 2 МБ.</p>
        </div>
      </div>
      <input
        ref={input}
        id="library-cover-file"
        className="library-upload-input"
        type="file"
        accept="image/jpeg,image/png"
        aria-label="Файл обложки"
        disabled={disabled || pending}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ""
          if (file)
            void upload(file).then((url) => {
              if (url) onChange(url)
            })
        }}
      />
      {error && (
        <p role="alert" className="library-feedback">
          {error}
        </p>
      )}
    </div>
  )
}
