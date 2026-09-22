import { Modal } from "../../../shared/ui/Modal"
import type { useRoomForm } from "../model/useRoomForm"
export function RegistrationModal({ form, nickname }: { form: ReturnType<typeof useRoomForm>; nickname: string }) {
  return (
    <Modal
      id="registration-modal"
      labelId="registration-modal-title"
      onClose={form.close}
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-sm"
    >
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="w-full max-w-md">
          <p className="text-sm text-zinc-400">Новый чатланин</p>
          <h1 id="registration-modal-title" className="mt-2 text-3xl font-semibold">
            Регистрация
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Зарегистрируй текущий ник и продолжай общение без повторного входа.
          </p>
          {form.error && (
            <p
              id="registration-error"
              role="alert"
              className="mt-4 rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {form.error}
            </p>
          )}
          <form
            id="registration-form"
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              void form.submit(new FormData(e.currentTarget))
            }}
          >
            {(
              [
                ["nickname", "Ник", "text", "nickname", "например, Scottie"],
                ["password", "Пароль", "password", "new-password", "минимум 6 символов"],
                ["email", "Email для форума (необязательно)", "email", "email", "you@example.com"],
              ] as const
            ).map(([name, label, type, autoComplete, placeholder]) => (
              <div className="space-y-2" key={name}>
                <label htmlFor={`registration-${name}`} className="block">
                  <span className="block text-sm font-medium text-zinc-200">{label}</span>
                  <input
                    id={`registration-${name}`}
                    name={name}
                    type={type}
                    autoComplete={autoComplete}
                    placeholder={placeholder}
                    readOnly={name === "nickname"}
                    defaultValue={name === "nickname" ? nickname : ""}
                    required={name !== "email"}
                    minLength={name === "password" ? 6 : undefined}
                    maxLength={name === "nickname" ? 24 : 254}
                    className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-amber-300"
                  />
                </label>
              </div>
            ))}
            <p id="registration-email-hint" className="-mt-2 text-xs leading-5 text-zinc-500">
              Другие пользователи не увидят этот адрес. Он нужен только для форума, уведомлений и восстановления
              доступа.
            </p>
            <button
              id="register-user"
              type="submit"
              disabled={form.busy}
              className="w-full rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
            >
              {form.busy ? "Создаём аккаунт…" : "Зарегистрироваться"}
            </button>
            <button
              id="close-registration"
              type="button"
              onClick={form.close}
              className="w-full rounded border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-amber-300 hover:text-amber-300"
            >
              Остаться в чате
            </button>
          </form>
        </div>
      </div>
    </Modal>
  )
}
