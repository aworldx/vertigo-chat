import type { Principal } from "../api/accounts"

export function AccountBar({
  principal,
  pending,
  onLogout,
}: {
  principal: Principal
  pending: boolean
  onLogout: () => void
}) {
  return (
    <div
      id="site-account"
      className="relative z-10 flex flex-wrap items-center justify-end gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-300"
    >
      <span id="site-account-nickname">{principal.nickname}</span>
      <a
        id="site-account-settings"
        href="/account"
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        Настройки аккаунта
      </a>
      <form
        id="site-account-logout"
        className="flex items-center"
        onSubmit={(event) => {
          event.preventDefault()
          onLogout()
        }}
      >
        <button
          id="site-account-logout-submit"
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 transition hover:bg-zinc-800 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          Выйти с сайта
        </button>
      </form>
    </div>
  )
}
