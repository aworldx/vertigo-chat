import { AccountBar, EmailSettings, LoginForm, useAccountSession } from "../features/accounts"
export function AccountPage() {
  const { session, error, pending, refresh, signOut } = useAccountSession()
  if (!session)
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        {error ? (
          <p role="alert">
            {error}{" "}
            <button
              id="account-session-retry"
              onClick={() => {
                void refresh()
              }}
            >
              Повторить
            </button>
          </p>
        ) : (
          <p role="status">Загрузка аккаунта…</p>
        )}
      </main>
    )
  if (!session.principal)
    return (
      <LoginForm
        registering={false}
        onAuthenticated={() => {
          void refresh()
        }}
      />
    )
  return (
    <>
      <AccountBar
        principal={session.principal}
        pending={pending}
        onLogout={() => {
          void signOut()
        }}
      />
      {error && (
        <p role="alert" className="bg-zinc-950 p-4 text-red-300">
          {error}
        </p>
      )}
      <EmailSettings
        key={session.principal.user_id}
        csrf={session.csrf_token}
        onSessionChanged={() => {
          void refresh()
        }}
      />
    </>
  )
}
