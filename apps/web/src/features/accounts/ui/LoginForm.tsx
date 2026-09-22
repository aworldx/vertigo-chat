import { useLoginForm } from "../model/useLoginForm"

export function LoginForm({
  registering: initialRegistering,
  onAuthenticated,
}: {
  registering: boolean
  onAuthenticated: () => void
}) {
  const { registering, error, pending, submit, toggle } = useLoginForm(initialRegistering, onAuthenticated)
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 text-zinc-100">
      <section className="mx-auto w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <a className="text-sm text-amber-200 underline" href="/">
          ← На главную
        </a>
        <h1 className="mt-6 text-2xl font-semibold">{registering ? "Регистрация" : "Вход на сайт"}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {registering ? "Создай зарегистрированный аккаунт." : "Войди с зарегистрированным ником."}
        </p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            void submit(event)
          }}
          id="react-account-login-form"
        >
          <label className="block text-sm font-medium" htmlFor="react-account-nickname">
            Ник
            <input
              className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2"
              id="react-account-nickname"
              name="nickname"
              autoComplete="username"
              required
            />
          </label>
          {registering ? (
            <label className="block text-sm font-medium" htmlFor="react-account-email">
              Email (необязательно)
              <input
                className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2"
                id="react-account-email"
                name="email"
                type="email"
                autoComplete="email"
              />
            </label>
          ) : null}
          <label className="block text-sm font-medium" htmlFor="react-account-password">
            Пароль
            <input
              className="mt-1 block w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2"
              id="react-account-password"
              name="password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="w-full rounded-lg bg-amber-300 px-4 py-2 font-semibold text-zinc-950 disabled:opacity-60"
            type="submit"
            id="react-account-submit"
            disabled={pending}
          >
            {pending ? "Подождите…" : registering ? "Зарегистрироваться" : "Войти"}
          </button>
          <button
            className="w-full text-sm text-amber-200 underline"
            type="button"
            id="react-account-toggle"
            disabled={pending}
            onClick={() => {
              toggle()
            }}
          >
            {registering ? "У меня уже есть аккаунт" : "Создать аккаунт"}
          </button>
        </form>
      </section>
    </main>
  )
}
