import { Library } from "../features/library"
import { AccountBar, InlineLogin, useAccountSession } from "../features/accounts"
export function LibraryPage() {
  const { session, pending, signOut, refresh } = useAccountSession()
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
      <Library
        key={session?.principal?.user_id ?? 0}
        nickname={session?.principal?.nickname ?? ""}
        csrf={session?.csrf_token ?? ""}
        login={
          <InlineLogin
            id="library"
            onAuthenticated={() => {
              void refresh()
            }}
          />
        }
      />
    </>
  )
}
