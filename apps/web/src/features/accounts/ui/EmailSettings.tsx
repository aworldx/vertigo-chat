import { Icon } from "../../../shared/ui/Icon"
import { useEmailSettings } from "../model/useEmailSettings"

export function EmailSettings({ csrf, onSessionChanged }: { csrf: string; onSessionChanged: () => void }) {
  const model = useEmailSettings(csrf, onSessionChanged)
  return (
    <>
      <section id="account-settings-page" className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100 sm:px-8">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300">Аккаунт</p>
          <h1 className="mt-2 text-3xl font-semibold">Email для форума</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Другие пользователи не увидят этот адрес. Он нужен только для входа на форум, уведомлений и восстановления
            доступа.
          </p>
          {model.loading ? (
            <p role="status" className="mt-6 text-sm text-zinc-400">
              Загрузка настроек…
            </p>
          ) : model.loadError ? (
            <p role="alert" className="mt-6 text-sm text-red-300">
              {model.loadError}{" "}
              <button id="account-settings-retry" type="button" onClick={model.retry}>
                Повторить
              </button>
            </p>
          ) : (
            <form
              id="forum-email-form"
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                void model.submit()
              }}
            >
              <div className="space-y-2">
                <label htmlFor="forum-email" className="block">
                  <span className="block text-sm font-medium text-zinc-200">Email</span>
                  <input
                    id="forum-email"
                    name="forum_email[email]"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@example.com"
                    value={model.email}
                    readOnly={model.saving}
                    onChange={(event) => {
                      model.setEmail(event.target.value)
                    }}
                    aria-invalid={model.error ? true : undefined}
                    aria-describedby={model.error ? "forum-email-error" : undefined}
                    className={`mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 shadow-sm outline-none transition [color-scheme:dark] placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:bg-zinc-950/40 disabled:text-zinc-500 ${model.error ? "border-red-400 focus:border-red-400 focus:ring-red-400/10" : ""}`}
                  />
                </label>
                {model.error && (
                  <p
                    id="forum-email-error"
                    role="alert"
                    className="mt-1.5 flex items-center gap-2 text-sm text-red-300"
                  >
                    <Icon name="exclamation-circle" className="size-5" />
                    {model.error}
                  </p>
                )}
              </div>
              <button
                id="save-forum-email"
                type="submit"
                disabled={model.saving}
                className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
              >
                {model.saving ? "Сохраняем…" : "Сохранить email"}
              </button>
            </form>
          )}
        </div>
      </section>
      {model.notice && (
        <div id="flash-group" aria-live="polite">
          <div
            id="flash-info"
            role="alert"
            className="fixed right-4 top-4 z-[100] w-full max-w-[calc(100vw-2rem)] sm:right-6 sm:top-6 sm:max-w-sm"
          >
            <div className="flex w-full items-start gap-3 rounded-xl border border-sky-400/50 bg-sky-950/95 p-4 text-sm text-sky-100 shadow-2xl backdrop-blur-sm">
              <Icon name="information-circle" className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p>Email сохранён. Форум подтвердит его при первом входе.</p>
              </div>
              <div className="flex-1" />
              <button
                id="account-notice-close"
                type="button"
                className="group self-start cursor-pointer"
                aria-label="close"
                onClick={model.dismiss}
              >
                <Icon name="x-mark" className="size-5 opacity-40 group-hover:opacity-70" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
