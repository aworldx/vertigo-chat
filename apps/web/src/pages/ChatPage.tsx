import { useCallback, useState } from "react"
import { Room } from "../features/chat"
import { useAccountSession } from "../features/accounts"
import { RoomProfileViewer } from "../features/profiles"
export function ChatPage() {
  const account = useAccountSession()
  const [profile, setProfile] = useState<{ nickname: string; editable: boolean } | null>(null)
  const closeProfile = useCallback(() => {
    setProfile(null)
  }, [])
  return (
    <Room
      csrf={account.session?.csrf_token ?? ""}
      onProfile={(nickname, editable) => {
        setProfile({ nickname, editable })
      }}
    >
      {profile && <RoomProfileViewer {...profile} onDismiss={closeProfile} />}
    </Room>
  )
}
