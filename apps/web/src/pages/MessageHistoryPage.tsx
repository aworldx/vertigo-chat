import { MessageHistory } from "../features/chat"
import { useAccountSession } from "../features/accounts"
export function MessageHistoryPage() {
  const { session } = useAccountSession()
  return <MessageHistory csrf={session?.principal?.roles.includes("admin") ? session.csrf_token : undefined} />
}
