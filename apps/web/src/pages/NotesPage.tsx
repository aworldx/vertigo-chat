import { AccountBar, InlineLogin, useAccountSession } from "../features/accounts"
import { Notes } from "../features/notes"
export function NotesPage() {
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
      <Notes
        key={session?.principal?.user_id ?? 0}
        nickname={session?.principal?.nickname ?? ""}
        csrf={session?.csrf_token ?? ""}
        login={
          <InlineLogin
            id="notes"
            onAuthenticated={() => {
              void refresh()
            }}
          />
        }
      />
    </>
  )
}
