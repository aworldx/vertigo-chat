import { Admin, AdminShell } from "../features/admin"
import { AdminLogin, useAccountSession } from "../features/accounts"
import { AdminPolls } from "../features/polls"
export function AdminPage() {
  const { session, refresh } = useAccountSession(),
    p = session?.principal,
    allowed = p && p.roles.length > 0
  if (!allowed)
    return (
      <AdminShell section="" isAdmin={false} navigate={() => undefined}>
        {p && <p role="alert">Недостаточно прав.</p>}
        <AdminLogin
          onAuthenticated={() => {
            void refresh()
          }}
        />
      </AdminShell>
    )
  return (
    <Admin
      key={p.user_id}
      nickname={p.nickname}
      isAdmin={p.roles.includes("admin")}
      csrf={session.csrf_token}
      polls={<AdminPolls csrf={session.csrf_token} />}
    />
  )
}
