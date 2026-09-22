import { Modal } from "../../../shared/ui/Modal"
import { Icon } from "../../../shared/ui/Icon"
import type { useRoomForm } from "../model/useRoomForm"
export function FeedbackModal({
  form,
  nickname,
  registered,
}: {
  form: ReturnType<typeof useRoomForm>
  nickname: string
  registered: boolean
}) {
  return (
    <Modal
      id="feedback-modal"
      labelId="feedback-modal-title"
      onClose={form.close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
    >
      <button
        id="feedback-modal-backdrop"
        type="button"
        onClick={form.close}
        className="absolute inset-0 cursor-default"
        aria-label="Закрыть форму обратной связи"
      />
      <section className="relative z-10 w-full max-w-lg rounded-3xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Vertigo</p>
            <h2 id="feedback-modal-title" className="mt-1 text-2xl font-semibold text-white">
              Обратная связь
            </h2>
            <p className="mt-2 text-sm leading-5 text-zinc-400">Расскажи, что стоит улучшить в чате.</p>
          </div>
          <button
            id="close-feedback"
            type="button"
            onClick={form.close}
            className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
            aria-label="Закрыть форму обратной связи"
          >
            <Icon name="x-mark" className="size-5" />
          </button>
        </div>
        {form.success ? (
          <p role="status">{form.success}</p>
        ) : (
          <form
            id="feedback-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.submit(new FormData(e.currentTarget))
            }}
          >
            {registered ? (
              <p className="text-sm text-zinc-400">
                Отправим от имени <span className="font-semibold text-zinc-100">{nickname}</span>.
              </p>
            ) : (
              <div className="space-y-2">
                <label htmlFor="feedback-name" className="block">
                  <span className="block text-sm font-medium text-zinc-200">Твоё имя</span>
                  <input
                    id="feedback-name"
                    name="name"
                    defaultValue=""
                    autoComplete="name"
                    maxLength={40}
                    required
                    className="mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 shadow-sm outline-none transition [color-scheme:dark] placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10"
                  />
                </label>
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="feedback-body" className="block">
                <span className="block text-sm font-medium text-zinc-200">Пожелание</span>
                <textarea
                  id="feedback-body"
                  name="body"
                  maxLength={2000}
                  required
                  placeholder="Например: добавьте поиск по сообщениям…"
                  className="mt-2 block min-h-28 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-3 text-sm leading-6 text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10"
                />
              </label>
            </div>
            {form.error && (
              <p role="alert" className="text-sm text-red-300">
                {form.error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                id="cancel-feedback"
                type="button"
                onClick={form.close}
                className="rounded-lg px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
              >
                Отмена
              </button>
              <button
                id="submit-feedback"
                type="submit"
                disabled={form.busy}
                className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
              >
                Отправить
              </button>
            </div>
          </form>
        )}
      </section>
    </Modal>
  )
}
