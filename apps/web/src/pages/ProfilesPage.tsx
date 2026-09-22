import Profiles from "../features/profiles"
import { AccountBar, useAccountSession } from "../features/accounts"

export function ProfilesPage() {
  const { session, error, pending, refresh, signOut } = useAccountSession()
  return (
    <main data-account-page={session?.principal ? "true" : undefined}>
      {session?.principal && (
        <AccountBar
          principal={session.principal}
          pending={pending}
          onLogout={() => {
            void signOut()
          }}
        />
      )}
      {error && (
        <div role="alert" className="bg-zinc-950 p-4 text-rose-300">
          {error}{" "}
          <button
            id="account-session-retry"
            onClick={() => {
              void refresh()
            }}
          >
            Повторить
          </button>
        </div>
      )}
      <section
        id="profiles-page"
        className="chat-shell min-h-screen bg-zinc-950 text-zinc-100"
        data-chat-theme="vertigo"
        data-chat-mode="dark"
      >
        <header className="flex min-h-16 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 sm:px-8">
          <a
            href="/chat"
            target="vertigo-chat"
            className="flex min-h-11 items-center gap-3"
            aria-label="Vertigo — в чат"
          >
            <span className="vertigo-mark" aria-hidden="true"></span>
            <span className="vertigo-wordmark uppercase">Vertigo</span>
          </a>
        </header>
        <div id="react-profiles-root">
          {session ? (
            <Profiles key={session.principal?.user_id ?? "guest"} csrfToken={session.csrf_token} />
          ) : (
            <p role="status" className="p-8 text-zinc-400">
              Загружаем анкеты…
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
