import { RegistrationModal } from "./RegistrationModal"
import { FeedbackModal } from "./FeedbackModal"
import { Modal } from "../../../shared/ui/Modal"
import { Icon } from "../../../shared/ui/Icon"
import type { useRoomForm } from "../model/useRoomForm"
const input =
  "w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-amber-300"
export function RoomForms({
  form,
  nickname,
  registered,
}: {
  form: ReturnType<typeof useRoomForm>
  nickname: string
  registered: boolean
}) {
  if (!form.kind) return null
  if (form.kind === "register") return <RegistrationModal form={form} nickname={nickname} />
  if (form.kind === "feedback") return <FeedbackModal form={form} nickname={nickname} registered={registered} />
  const title = {
    register: "Регистрация",
    feedback: "Обратная связь",
    emoji: "Загрузить смайлик",
    attachment: "Прикрепить файл",
  }[form.kind]
  return (
    <Modal
      id={`${form.kind}-modal`}
      labelId="room-form-title"
      onClose={form.close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button type="button" onClick={form.close} className="absolute inset-0" aria-label="Закрыть" />
      <section className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <header className="mb-5 flex items-center justify-between">
          <h2 id="room-form-title" className="text-xl font-semibold">
            {title}
          </h2>
          <button type="button" aria-label="Закрыть окно" onClick={form.close}>
            <Icon name="x-mark" className="size-5" />
          </button>
        </header>
        {form.success ? (
          <p role="status">{form.success}</p>
        ) : (
          <form
            id="room-action-form"
            onSubmit={(event) => {
              event.preventDefault()
              void form.submit(new FormData(event.currentTarget))
            }}
            className="space-y-4"
          >
            <fieldset disabled={form.busy} className="space-y-4 disabled:opacity-60">
              {form.kind === "emoji" && (
                <>
                  <p className="text-sm text-zinc-400">
                    PNG, GIF или WebP, до 100 × 100 пикселей и 700 КБ. После проверки смайлик появится в общей палитре.
                  </p>
                  <label className="block text-sm">
                    Код
                    <input name="code" placeholder=":smile:" required maxLength={32} className={input} />
                  </label>
                  <label className="block text-sm">
                    Файл
                    <input
                      name="image"
                      type="file"
                      accept="image/png,image/gif,image/webp"
                      required
                      className={input}
                    />
                  </label>
                </>
              )}
              {form.kind === "attachment" && (
                <>
                  <p className="text-sm text-zinc-400">
                    Прямая передача собеседникам в комнате: изображения до 5 МБ, аудио до 50 МБ. Оставайся в чате до
                    завершения передачи.
                  </p>
                  <input
                    name="file"
                    aria-label="Прикрепить файл"
                    type="file"
                    required
                    accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac"
                    className={input}
                  />
                </>
              )}
              {form.error && (
                <p role="alert" className="text-sm text-red-300">
                  {form.error}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded bg-amber-300 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-200"
              >
                {form.busy ? "Сохраняем…" : "Отправить"}
              </button>
            </fieldset>
          </form>
        )}
      </section>
    </Modal>
  )
}
