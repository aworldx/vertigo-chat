import { ArticlesIndex } from "./ArticlesIndex"
import { ChatsArticle } from "./ChatsArticle"
import { HistoryArticle } from "./HistoryArticle"
import { TechnologyArticle } from "./TechnologyArticle"
export function Articles({ path }: { path: string }) {
  return (
    <main id="articles-page" className="min-h-dvh bg-zinc-950 text-zinc-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="/about" className="flex items-center gap-3" aria-label="Vertigo — о чате">
          <span className="vertigo-mark" aria-hidden="true"></span>
          <span className="vertigo-wordmark uppercase">Vertigo</span>
        </a>
        <nav className="flex items-center gap-5 text-sm font-semibold" aria-label="Основная навигация">
          <a href="/articles" className="text-amber-200 transition hover:text-amber-100">
            Статьи
          </a>
          <a
            id="articles-enter-chat"
            href="/"
            className="rounded-lg border border-amber-300/70 px-4 py-2 text-amber-100 transition hover:bg-amber-300 hover:text-zinc-950"
          >
            Войти в чат
          </a>
        </nav>
      </header>

      {path === "/articles/chats-vs-messengers" ? (
        <ChatsArticle />
      ) : path === "/articles/chat-platforms-russia" ? (
        <HistoryArticle />
      ) : path === "/articles/how-vertigo-chat-works" ? (
        <TechnologyArticle />
      ) : (
        <ArticlesIndex />
      )}
    </main>
  )
}
