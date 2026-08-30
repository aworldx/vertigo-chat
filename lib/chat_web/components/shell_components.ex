# Назначение файла: UI-компоненты общего каркаса чата, включая верхнее меню.
defmodule ChatWeb.ShellComponents do
  use ChatWeb, :html

  attr :joined, :boolean, required: true
  attr :registered, :boolean, required: true

  def top_menu(assigns) do
    ~H"""
    <header class="flex min-h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4">
      <a href="/" class="flex items-center gap-3">
        <span class="vertigo-mark" aria-hidden="true"></span>
        <span class="vertigo-wordmark uppercase">Vertigo</span>
      </a>

      <nav
        class="cinema-menu flex items-center gap-4 text-sm text-zinc-300"
        aria-label="Основное меню"
      >
        <.link
          href={~p"/profiles"}
          target="vertigo-profiles"
          class="hidden transition hover:text-amber-300 sm:inline"
        >
          Анкеты
        </.link>
        <.link
          href={~p"/library"}
          target="vertigo-library"
          class="hidden transition hover:text-amber-300 sm:inline"
        >
          Библиотека
        </.link>
        <.link
          href={~p"/gallery"}
          target="vertigo-gallery"
          class="hidden transition hover:text-amber-300 sm:inline"
        >
          Фотоальбом
        </.link>
        <.link
          href={~p"/checkers"}
          target="vertigo-checkers"
          class="hidden transition hover:text-amber-300 sm:inline"
        >
          Шашки
        </.link>
        <.link
          href={~p"/visits"}
          target="vertigo-visits"
          class="hidden transition hover:text-amber-300 sm:inline"
        >
          Кто был
        </.link>
        <.link
          href={~p"/help"}
          target="vertigo-help"
          class="hidden transition hover:text-amber-300 lg:inline"
        >
          Помощь
        </.link>
        <%= if !@registered do %>
          <button
            id="show-registration"
            type="button"
            phx-click="show_registration"
            class="text-amber-300 transition hover:text-amber-200"
          >
            Регистрация
          </button>
        <% end %>
      </nav>
    </header>
    """
  end
end
