import { Articles } from "../features/articles"
import { AccountBar, useAccountSession } from "../features/accounts"
export function ArticlesPage() {
  const { session, pending, signOut } = useAccountSession()
  return (
    <>
      {session?.principal && (
        <AccountBar
          principal={session.principal}
          pending={pending}
          onLogout={() => {
            void signOut()
          }}
        />
      )}
      <Articles path={window.location.pathname} />
    </>
  )
}
