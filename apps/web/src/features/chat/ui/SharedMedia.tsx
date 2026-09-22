import { ListeningAudio } from "./ListeningAudio"
import type { SharedFile } from "../model/mediaTransfer"
export function SharedMedia({ file, onRequest }: { file: SharedFile; onRequest: () => void }) {
  return (
    <article
      id={`shared-media-${file.id}`}
      className="chat-message-entry relative rounded border border-zinc-800 bg-zinc-900 px-3 pb-2 pt-5"
    >
      <span className="absolute -top-2 left-2 rounded-full border border-zinc-700 bg-zinc-950 px-2 text-xs text-amber-200">
        {file.author}
      </span>
      <p className="mb-2 text-sm text-zinc-300">{file.name}</p>
      {file.status !== "ready" ? (
        <div>
          <p role="status">
            {file.error ||
              (file.status === "loading"
                ? `Получаем файл… ${String(file.progress)}%`
                : "Файл хранится на устройстве автора и доступен 15 минут.")}
          </p>
          {!file.url && (
            <button
              type="button"
              disabled={file.status === "loading"}
              onClick={onRequest}
              className="mt-2 rounded bg-amber-300 px-3 py-2 text-zinc-950"
            >
              {file.type.startsWith("image/") ? "Показать изображение" : "Слушать"}
            </button>
          )}
        </div>
      ) : file.type.startsWith("image/") ? (
        <a href={file.url} target="_blank" rel="noreferrer">
          <img src={file.url} alt={file.name} className="max-h-80 max-w-full rounded object-contain" />
        </a>
      ) : null}
      {file.type.startsWith("audio/") && file.url && (
        <ListeningAudio title={file.name} controls src={file.url} className="max-w-full">
          <track kind="captions" label="Субтитры" />
        </ListeningAudio>
      )}
    </article>
  )
}
