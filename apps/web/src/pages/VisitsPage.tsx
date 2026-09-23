import { Visits } from "../features/visits"
import { AccountBar, useAccountSession } from "../features/accounts"
export function VisitsPage() {
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
      <Visits />
    </>
  )
}
