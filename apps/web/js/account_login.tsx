import React, { useState } from "react"
import { createRoot } from "react-dom/client"

function csrfToken(): string {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? ""
}

function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [registering, setRegistering] = useState(false)

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const value = (name: string): string => {
      const item = form.get(name)
      return typeof item === "string" ? item : ""
    }
    const response = await fetch(registering ? "/account/register" : "/account/login", {
      method: "POST",
      headers: { "x-csrf-token": csrfToken() },
      body: new URLSearchParams({
        [`${registering ? "registration" : "account"}[nickname]`]: value("nickname"),
        [`${registering ? "registration" : "account"}[password]`]: value("password"),
        ...(registering ? { "registration[email]": value("email") } : {}),
        return_to: "/library",
      }),
    })
    if (response.redirected) {
      window.location.assign(response.url)
      return
    }
    setError(registering ? "Не удалось зарегистрироваться. Проверь данные." : "Не удалось войти. Проверь ник и пароль.")
    setPending(false)
  }

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
              autoComplete="current-password"
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
            disabled={pending}
          >
            {pending ? "Подождите…" : registering ? "Зарегистрироваться" : "Войти"}
          </button>
          <button
            className="w-full text-sm text-amber-200 underline"
            type="button"
            onClick={() => {
              setRegistering(!registering)
            }}
          >
            {registering ? "У меня уже есть аккаунт" : "Создать аккаунт"}
          </button>
        </form>
      </section>
    </main>
  )
}

const container = document.getElementById("react-account-login-root")
if (container) createRoot(container).render(<LoginPage />)
