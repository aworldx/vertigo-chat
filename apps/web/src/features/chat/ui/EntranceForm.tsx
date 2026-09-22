import { useEntrance } from "../model/useEntrance"
function Field({
  id,
  label,
  type = "text",
  placeholder,
  autoComplete,
  maxLength,
}: {
  id: string
  label: string
  type?: string
  placeholder: string
  autoComplete: string
  maxLength?: number
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block">
        <span className="block text-sm font-medium text-zinc-200">{label}</span>
        <input
          id={id}
          name={id.slice(id.indexOf("-") + 1)}
          type={type}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          className="mt-2 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-amber-300"
        />
      </label>
    </div>
  )
}
export function EntranceForm({
  registering,
  onRegister,
  onLogin,
  getCsrf,
}: {
  registering: boolean
  onRegister: () => void
  onLogin: () => void
  getCsrf: () => Promise<string>
}) {
  const { pending, error, submit } = useEntrance(registering, getCsrf)
  const prefix = registering ? "registration" : "entrance"
  return (
    <>
      <div className="w-full max-w-md">
        <p className="text-sm text-zinc-400">{registering ? "Новый чатланин" : "Добро пожаловать"}</p>
        <h2 className="mt-2 text-3xl font-semibold">{registering ? "Регистрация" : "Вход в чат"}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          {registering
            ? "Только ник и пароль. После регистрации сразу откроется чат."
            : "Введи ник, чтобы войти в общую комнату. Если ник зарегистрирован — нужен пароль. Если пароль не вводить, вход будет гостевым."}
        </p>
        {error && (
          <p
            id={`${prefix}-error`}
            role="alert"
            className={
              registering
                ? "mt-4 rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                : "mt-4 rounded border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100"
            }
          >
            {error}
          </p>
        )}
        <form
          id={`${prefix}-form`}
          onSubmit={(event) => {
            void submit(event)
          }}
          className="mt-6 space-y-4"
        >
          <Field
            id={`${prefix}-nickname`}
            label="Ник"
            autoComplete="nickname"
            maxLength={24}
            placeholder="например, Scottie"
          />
          <Field
            id={`${prefix}-password`}
            label="Пароль"
            type="password"
            autoComplete={registering ? "new-password" : "current-password"}
            placeholder={registering ? "минимум 6 символов" : "оставь пустым для гостевого входа"}
          />
          {registering && (
            <>
              <Field
                id="registration-email"
                label="Email для форума (необязательно)"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="you@example.com"
              />
              <p id="registration-email-hint" className="-mt-2 text-xs leading-5 text-zinc-500">
                Другие пользователи не увидят этот адрес. Он нужен только для форума, уведомлений и восстановления
                доступа.
              </p>
            </>
          )}
          <button
            id={registering ? "register-user" : "enter-chat"}
            type="submit"
            disabled={pending}
            className="w-full rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
          >
            {pending ? (registering ? "Создаём аккаунт…" : "Входим…") : registering ? "Зарегистрироваться" : "Войти"}
          </button>
          {registering && (
            <button
              id="show-login"
              type="button"
              disabled={pending}
              onClick={onLogin}
              className="w-full rounded border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-amber-300 hover:text-amber-300"
            >
              Уже есть ник? Войти
            </button>
          )}
        </form>
      </div>
      {!registering && (
        <p className="landing-form-footer">
          Хочешь сохранить свой ник?{" "}
          <button id="landing-show-registration" type="button" disabled={pending} onClick={onRegister}>
            Зарегистрируйся
          </button>
        </p>
      )}
    </>
  )
}
