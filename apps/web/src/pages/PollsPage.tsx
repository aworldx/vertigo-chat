import { useAccountSession } from "../features/accounts"
import { readSession } from "../features/chat"
import { Polls } from "../features/polls"
export function PollsPage() {
  const account = useAccountSession()
  return <Polls token={readSession()?.resume_token ?? ""} csrf={account.session?.csrf_token ?? ""} />
}
