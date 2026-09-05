# Назначение файла: UI-компоненты входа и регистрации чатланина.
defmodule ChatWeb.AuthComponents do
  use ChatWeb, :html

  attr :entrance_error, :string, default: nil
  attr :nickname_form, :any, required: true

  def login_screen(assigns) do
    ~H"""
    <div class="w-full max-w-md">
      <p class="text-sm text-zinc-400">Добро пожаловать</p>
      <h1 class="mt-2 text-3xl font-semibold">Вход в чат</h1>
      <p class="mt-3 text-sm leading-6 text-zinc-400">
        Введи ник, чтобы войти в общую комнату. Если ник зарегистрирован — нужен пароль.
        Если пароль не вводить, вход будет гостевым.
      </p>

      <%= if @entrance_error do %>
        <p class="mt-4 rounded border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
          {@entrance_error}
        </p>
      <% end %>

      <.form for={@nickname_form} id="entrance-form" phx-submit="enter_chat" class="mt-6 space-y-4">
        <.auth_text_input
          field={@nickname_form[:nickname]}
          id="entrance-nickname"
          label="Ник"
          autocomplete="nickname"
          maxlength="24"
          placeholder="например, Scottie"
        />
        <.auth_text_input
          field={@nickname_form[:password]}
          id="entrance-password"
          type="password"
          label="Пароль"
          autocomplete="current-password"
          placeholder="оставь пустым для гостевого входа"
        />

        <button
          id="enter-chat"
          type="submit"
          phx-disable-with="Входим…"
          class="w-full rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
        >
          Войти
        </button>
      </.form>
    </div>
    """
  end

  attr :registration_error, :string, default: nil
  attr :registration_form, :any, required: true
  attr :in_chat, :boolean, default: false

  def registration_screen(assigns) do
    ~H"""
    <div class="w-full max-w-md">
      <p class="text-sm text-zinc-400">Новый чатланин</p>
      <h1 id={if(@in_chat, do: "registration-modal-title")} class="mt-2 text-3xl font-semibold">
        Регистрация
      </h1>
      <p class="mt-3 text-sm leading-6 text-zinc-400">
        <%= if @in_chat do %>
          Зарегистрируй текущий ник и продолжай общение без повторного входа.
        <% else %>
          Зарегистрированный ник нельзя занять гостем. После регистрации вернём тебя на вход.
        <% end %>
      </p>

      <%= if @registration_error do %>
        <p class="mt-4 rounded border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {@registration_error}
        </p>
      <% end %>

      <.form
        for={@registration_form}
        id="registration-form"
        phx-submit="register_user"
        class="mt-6 space-y-4"
      >
        <.auth_text_input
          field={@registration_form[:nickname]}
          id="registration-nickname"
          label="Ник"
          autocomplete="nickname"
          maxlength="24"
          placeholder="например, Scottie"
          readonly={@in_chat}
        />
        <.auth_text_input
          field={@registration_form[:password]}
          id="registration-password"
          type="password"
          label="Пароль"
          autocomplete="new-password"
          placeholder="минимум 6 символов"
        />

        <button
          id="register-user"
          type="submit"
          class="w-full rounded bg-amber-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-200"
        >
          Зарегистрироваться
        </button>

        <button
          id={if(@in_chat, do: "close-registration", else: "show-login")}
          type="button"
          phx-click={if(@in_chat, do: "close_registration", else: "show_login")}
          class="w-full rounded border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-amber-300 hover:text-amber-300"
        >
          {if(@in_chat, do: "Остаться в чате", else: "Уже есть ник? Войти")}
        </button>
      </.form>
    </div>
    """
  end

  attr :field, :any, required: true
  attr :id, :string, required: true
  attr :label, :string, required: true
  attr :type, :string, default: "text"
  attr :autocomplete, :string, default: nil
  attr :maxlength, :string, default: nil
  attr :placeholder, :string, default: nil
  attr :readonly, :boolean, default: false

  defp auth_text_input(assigns) do
    ~H"""
    <label class="block text-sm">
      <span class="mb-1 block text-zinc-300">{@label}</span>
      <input
        id={@id}
        type={@type}
        name={@field.name}
        value={@field.value}
        autocomplete={@autocomplete}
        maxlength={@maxlength}
        placeholder={@placeholder}
        readonly={@readonly}
        class="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-amber-300"
      />
    </label>
    """
  end
end
