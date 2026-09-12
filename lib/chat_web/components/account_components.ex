defmodule ChatWeb.AccountComponents do
  use ChatWeb, :html

  attr :id, :string, required: true
  attr :return_to, :string, required: true

  def account_login(assigns) do
    assigns = assign(assigns, :form, to_form(%{}, as: :account))

    ~H"""
    <section
      id={@id <> "-login-hint"}
      class="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900/90 p-5 text-zinc-100"
    >
      <h2 class="text-lg font-semibold">Вход на сайт</h2>
      <p class="mt-2 text-sm leading-6 text-zinc-400">Войдите с зарегистрированным ником.</p>
      <.form
        for={@form}
        id={@id <> "-account-login"}
        action={~p"/account/login"}
        method="post"
        class="mt-4 space-y-3"
      >
        <input type="hidden" name="return_to" value={@return_to} />
        <.input
          field={@form[:nickname]}
          id={@id <> "-account-nickname"}
          label="Ник"
          required
          autocomplete="username"
        />
        <.input
          field={@form[:password]}
          id={@id <> "-account-password"}
          type="password"
          label="Пароль"
          required
          autocomplete="current-password"
        />
        <button
          id={@id <> "-account-submit"}
          type="submit"
          class="min-h-11 w-full rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 phx-submit-loading:opacity-60"
        >Войти</button>
      </.form>
    </section>
    """
  end
end
