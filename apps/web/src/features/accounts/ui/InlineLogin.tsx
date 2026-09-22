import { useLoginForm } from "../model/useLoginForm"
export function InlineLogin({ id, onAuthenticated }: { id: string; onAuthenticated: () => void }) {
  const form = useLoginForm(false, onAuthenticated)
  return (
    <section
      id={`${id}-login-hint`}
      className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-5 text-zinc-100"
    >
      <h2 className="text-lg font-semibold">Вход на сайт</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">Войдите с зарегистрированным ником.</p>
      <form
        id={`${id}-account-login`}
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          void form.submit(event)
        }}
      >
        {(
          [
            ["nickname", "Ник", "text", "username"],
            ["password", "Пароль", "password", "current-password"],
          ] as const
        ).map(([name, label, type, autocomplete]) => (
          <div key={name} className="space-y-2">
            <label htmlFor={`${id}-account-${name}`} className="block text-sm font-medium text-zinc-200">
              {label}
            </label>
            <input
              id={`${id}-account-${name}`}
              name={name}
              type={type}
              autoComplete={autocomplete}
              required
              className="mt-2 block w-full rounded-xl border border-zinc-700 bg-zinc-950/90 px-3.5 py-2.5 text-sm text-zinc-100 shadow-sm outline-none transition [color-scheme:dark] placeholder:text-zinc-600 hover:border-zinc-600 focus:border-amber-300 focus:ring-4 focus:ring-amber-300/10 disabled:cursor-not-allowed disabled:bg-zinc-950/40 disabled:text-zinc-500"
            />
          </div>
        ))}
        {form.error && (
          <p role="alert" className="text-red-300">
            {form.error}
          </p>
        )}
        <button
          id={`${id}-account-submit`}
          disabled={form.pending}
          className="min-h-11 w-full rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          Войти
        </button>
      </form>
    </section>
  )
}
