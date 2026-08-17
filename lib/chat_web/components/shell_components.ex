# Назначение файла: UI-компоненты общего каркаса чата, включая верхнее меню.
defmodule ChatWeb.ShellComponents do
  use ChatWeb, :html

  attr :joined, :boolean, required: true

  def top_menu(assigns) do
    ~H"""
    <header class="flex min-h-14 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4">
      <a href="/" class="flex items-center gap-3">
        <svg class="vertigo-mark" viewBox="0 0 50 50" fill="none" aria-hidden="true">
          <path
            d="M5 25C5 13.4 14.4 4 26 4s20 9.4 20 21-9.4 21-21 21S7 37.9 7 27 15.1 9 26 9s18 8.1 18 18-7.2 16-17 16-15-6.2-15-15 0-14 14-14 14 5.4 14 13-5.4 12-13 12-11-4.6-11-11 4.6-10 11-10 8 3.6 8 8-3.6 7-8 7-5-2.6-5-6 2.6-5 6-5 4 1.8 4 4-1.8 3-4 3-2 0-3-1.3-3-3"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="vertigo-wordmark uppercase">Vertigo</span>
      </a>

      <nav class="hidden items-center gap-4 text-sm text-zinc-300 sm:flex">
        <.link
          href={~p"/profiles"}
          target="_blank"
          rel="noopener"
          class="transition hover:text-amber-300"
        >
          Анкеты
        </.link>
        <span>Записная книжка</span>
        <.link
          href={~p"/gallery"}
          target="_blank"
          rel="noopener"
          class="transition hover:text-amber-300"
        >
          Фотоальбом
        </.link>
        <span>Кто был</span>
        <%= if !@joined do %>
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
