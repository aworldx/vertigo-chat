import { Help } from "../features/help"
import { AccountBar, useAccountSession } from "../features/accounts"
export function HelpPage() {
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
      <Help />
    </>
  )
}
