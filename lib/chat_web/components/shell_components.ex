# Назначение файла: UI-компоненты общего каркаса чата, включая верхнее меню.
defmodule ChatWeb.ShellComponents do
  use ChatWeb, :html

  attr :joined, :boolean, required: true
  attr :registered, :boolean, required: true

  def top_menu(assigns) do
    ~H"""
    <header class="relative z-50 flex min-h-14 shrink-0 items-center justify-between overflow-visible border-b border-zinc-800 bg-zinc-900 px-4">
      <div id="chat-logo" class="flex items-center gap-3" aria-label="Vertigo">
        <span class="vertigo-mark" aria-hidden="true"></span>
        <span class="vertigo-wordmark uppercase">Vertigo</span>
      </div>

      <nav
        class="cinema-menu flex shrink-0 items-center gap-4 text-sm text-zinc-300"
        aria-label="Основное меню"
      >
        <.link
          href={~p"/profiles"}
          target="vertigo-profiles"
          class="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Анкеты
        </.link>
        <.link
          href={~p"/library"}
          target="vertigo-library"
          class="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Библиотека
        </.link>
        <.link
          href={~p"/gallery"}
          target="vertigo-gallery"
          class="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Фотоальбом
        </.link>
        <details id="games-main-menu" class="relative hidden lg:block">
          <summary class="cursor-pointer whitespace-nowrap transition hover:text-amber-300 [&::-webkit-details-marker]:hidden">
            Игры
          </summary>
          <div class="absolute right-0 top-7 z-50 w-44 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/50">
            <.link
              href={~p"/games"}
              target="vertigo-games"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Все игры</.link>
            <.link
              href={~p"/checkers"}
              target="vertigo-checkers"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Шашки</.link>
            <.link
              href={~p"/games/battleship"}
              target="vertigo-battleship"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Морской бой</.link>
            <.link
              href={~p"/games/durak"}
              target="vertigo-durak"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Дурак</.link>
            <.link
              href={~p"/games/balda"}
              target="vertigo-balda"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Балда</.link>
          </div>
        </details>
        <.link
          href={~p"/visits"}
          target="vertigo-visits"
          class="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Кто был
        </.link>
        <details id="about-main-menu" class="relative hidden lg:block">
          <summary class="cursor-pointer whitespace-nowrap transition hover:text-amber-300 [&::-webkit-details-marker]:hidden">
            О чате
          </summary>
          <div class="absolute right-0 top-7 z-50 w-48 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/50">
            <.link
              href={~p"/articles"}
              target="vertigo-articles"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Статьи</.link>
            <.link
              href={~p"/help"}
              target="vertigo-help"
              class="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >Помощь</.link>
            <button
              id="show-feedback"
              type="button"
              phx-click="show_feedback"
              class="block w-full rounded-lg px-3 py-2 text-left font-inherit uppercase tracking-[0.09em] transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Обратная связь
            </button>
          </div>
        </details>
        <details id="mobile-main-menu" class="relative lg:hidden">
          <summary class="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 transition hover:border-amber-300 hover:text-amber-200 [&::-webkit-details-marker]:hidden">
            <.icon name="hero-bars-3" class="size-5" />
            <span class="sr-only">Открыть меню</span>
          </summary>
          <div class="absolute right-0 top-11 z-50 w-56 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/50">
            <.link
              :for={{label, href} <- mobile_menu_links()}
              href={href}
              class="block rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              {label}
            </.link>
            <details id="mobile-about-menu" class="rounded-lg">
              <summary class="cursor-pointer list-none rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200 [&::-webkit-details-marker]:hidden">
                О чате
              </summary>
              <div class="border-l border-zinc-700 pl-2">
                <.link
                  href={~p"/articles"}
                  class="block rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200"
                >Статьи</.link>
                <.link
                  href={~p"/help"}
                  class="block rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200"
                >Помощь</.link>
                <button
                  id="mobile-show-feedback"
                  type="button"
                  phx-click="show_feedback"
                  class="block w-full rounded-lg px-3 py-2.5 text-left font-inherit uppercase tracking-[0.09em] transition hover:bg-zinc-800 hover:text-amber-200"
                >
                  Обратная связь
                </button>
              </div>
            </details>
            <button
              :if={!@registered}
              id="mobile-show-registration"
              type="button"
              phx-click="show_registration"
              class="block w-full whitespace-nowrap rounded-lg px-3 py-2.5 text-left font-inherit uppercase tracking-[0.09em] transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Регистрация
            </button>
          </div>
        </details>
        <div class="hidden items-center gap-4 lg:flex">
          <button
            :if={!@registered}
            id="show-registration"
            type="button"
            phx-click="show_registration"
            class="whitespace-nowrap font-inherit uppercase tracking-[0.09em] transition hover:text-amber-300"
          >
            Регистрация
          </button>
        </div>
      </nav>
    </header>
    """
  end

  defp mobile_menu_links do
    [
      {"Анкеты", ~p"/profiles"},
      {"Библиотека", ~p"/library"},
      {"Фотоальбом", ~p"/gallery"},
      {"Игры", ~p"/games"},
      {"Кто был", ~p"/visits"}
    ]
  end
end
