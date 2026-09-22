import { Icon } from "../../../shared/ui/Icon"
const links = [
  ["Хит-парад", "/music-chart", "vertigo-music-chart"],
  ["Анкеты", "/profiles", "vertigo-profiles"],
  ["Библиотека", "/library", "vertigo-library"],
  ["Фотоальбом", "/gallery", "vertigo-gallery"],
  ["Игры", "/games", "vertigo-games"],
  ["Кто был", "/visits", "vertigo-visits"],
] as const
export function TopMenu({
  registered,
  onRegister,
  onFeedback,
}: {
  registered: boolean
  onRegister: () => void
  onFeedback: () => void
}) {
  return (
    <header className="relative z-50 flex min-h-14 shrink-0 items-center justify-between overflow-visible border-b border-zinc-800 bg-zinc-900 px-4">
      <div id="chat-logo" className="flex items-center gap-3" aria-label="Vertigo">
        <span className="vertigo-mark" aria-hidden="true"></span>
        <span className="vertigo-wordmark uppercase">Vertigo</span>
      </div>

      <nav className="cinema-menu flex shrink-0 items-center gap-4 text-sm text-zinc-300" aria-label="Основное меню">
        <a href="/music-chart" target="vertigo-music-chart" className="hit-parade-button hidden lg:inline-flex">
          Хит-парад
        </a>
        <a
          href="/profiles"
          target="vertigo-profiles"
          className="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Анкеты
        </a>
        <a
          href="/library"
          target="vertigo-library"
          className="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Библиотека
        </a>
        <a
          href="/gallery"
          target="vertigo-gallery"
          className="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Фотоальбом
        </a>
        <details id="games-main-menu" className="relative hidden lg:block">
          <summary className="cursor-pointer whitespace-nowrap transition hover:text-amber-300 [&::-webkit-details-marker]:hidden">
            Игры
          </summary>
          <div className="absolute right-0 top-7 z-50 w-44 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/50">
            <a
              href="/games"
              target="vertigo-games"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Все игры
            </a>
            <a
              href="/checkers"
              target="vertigo-checkers"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Шашки
            </a>
            <a
              href="/games/battleship"
              target="vertigo-battleship"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Морской бой
            </a>
            <a
              href="/games/durak"
              target="vertigo-durak"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Дурак
            </a>
            <a
              href="/games/balda"
              target="vertigo-balda"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Балда
            </a>
          </div>
        </details>
        <a
          href="/visits"
          target="vertigo-visits"
          className="hidden whitespace-nowrap transition hover:text-amber-300 lg:inline"
        >
          Кто был
        </a>
        <details id="about-main-menu" className="relative hidden lg:block">
          <summary className="cursor-pointer whitespace-nowrap transition hover:text-amber-300 [&::-webkit-details-marker]:hidden">
            О чате
          </summary>
          <div className="absolute right-0 top-7 z-50 w-48 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/50">
            <a
              href="/articles"
              target="vertigo-articles"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Статьи
            </a>
            <a
              href="/help"
              target="vertigo-help"
              className="block rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Помощь
            </a>
            <button
              id="show-feedback"
              type="button"
              onClick={onFeedback}
              className="block w-full rounded-lg px-3 py-2 text-left font-inherit uppercase tracking-[0.09em] transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Обратная связь
            </button>
          </div>
        </details>
        <details id="mobile-main-menu" className="relative lg:hidden">
          <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-700 text-zinc-200 transition hover:border-amber-300 hover:text-amber-200 [&::-webkit-details-marker]:hidden">
            <Icon name="bars-3" className="size-5" />
            <span className="sr-only">Открыть меню</span>
          </summary>
          <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-2xl shadow-black/50">
            {links.map(([label, href, target]) => (
              <a
                key={target}
                id={`mobile-menu-${target}`}
                href={href}
                target={target}
                className="block rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200"
              >
                {label}
              </a>
            ))}
            <details id="mobile-about-menu" className="rounded-lg">
              <summary className="cursor-pointer list-none rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200 [&::-webkit-details-marker]:hidden">
                О чате
              </summary>
              <div className="border-l border-zinc-700 pl-2">
                <a
                  id="mobile-menu-articles"
                  href="/articles"
                  target="vertigo-articles"
                  className="block rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200"
                >
                  Статьи
                </a>
                <a
                  id="mobile-menu-help"
                  href="/help"
                  target="vertigo-help"
                  className="block rounded-lg px-3 py-2.5 transition hover:bg-zinc-800 hover:text-amber-200"
                >
                  Помощь
                </a>
                <button
                  id="mobile-show-feedback"
                  type="button"
                  onClick={onFeedback}
                  className="block w-full rounded-lg px-3 py-2.5 text-left font-inherit uppercase tracking-[0.09em] transition hover:bg-zinc-800 hover:text-amber-200"
                >
                  Обратная связь
                </button>
              </div>
            </details>
            <button
              hidden={registered}
              id="mobile-show-registration"
              type="button"
              onClick={onRegister}
              className="block w-full whitespace-nowrap rounded-lg px-3 py-2.5 text-left font-inherit uppercase tracking-[0.09em] transition hover:bg-zinc-800 hover:text-amber-200"
            >
              Регистрация
            </button>
          </div>
        </details>
        <div className="hidden items-center gap-4 lg:flex">
          <button
            hidden={registered}
            id="show-registration"
            type="button"
            onClick={onRegister}
            className="whitespace-nowrap font-inherit uppercase tracking-[0.09em] transition hover:text-amber-300"
          >
            Регистрация
          </button>
        </div>
      </nav>
    </header>
  )
}
