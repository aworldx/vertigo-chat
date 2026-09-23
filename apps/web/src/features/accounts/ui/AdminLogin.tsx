import { useLoginForm } from "../model/useLoginForm"
import { Field } from "../../../shared/ui/Field"
export function AdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const form = useLoginForm(false, onAuthenticated)
  return (
    <section
      id="admin-login-required"
      className="mx-auto max-w-md rounded-2xl border border-emerald-900 bg-[#162019] p-6 shadow-xl shadow-black/20"
    >
      <p className="text-sm text-amber-300">Закрытая зона</p>
      <h2 className="mt-1 text-2xl font-semibold text-white">Вход в админку</h2>
      <p className="mt-2 text-sm leading-5 text-zinc-400">Доступ есть у администраторов и модераторов смайлов.</p>
      <form
        id="admin-login-form"
        onSubmit={(e) => {
          void form.submit(e)
        }}
        className="mt-6 space-y-4"
      >
        <Field id="admin-login-nickname" name="nickname" label="Ник" autoComplete="username" required />
        <Field
          id="admin-login-password"
          name="password"
          type="password"
          label="Пароль"
          autoComplete="current-password"
          required
        />
        {form.error && (
          <p role="alert" className="text-red-300">
            {form.error}
          </p>
        )}
        <button
          id="admin-login-submit"
          disabled={form.pending}
          className="w-full rounded-lg bg-amber-300 px-4 py-2.5 font-semibold text-stone-950 transition hover:bg-amber-200"
        >
          Войти
        </button>
      </form>
    </section>
  )
}
