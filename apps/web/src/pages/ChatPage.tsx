import { GameNavigation } from "../shared/gameNavigation"
import { TetrisGame, useTetrisLauncher } from "../features/tetris"
import { useCallback, useEffect, useState } from "react"
import { Room, readSession } from "../features/chat"
import { useAccountSession } from "../features/accounts"
import { RoomProfileViewer } from "../features/profiles"
import { useNotesSummary } from "../features/notes"
import { usePollNotices } from "../features/polls"
function chatToken() {
  return readSession()?.resume_token ?? ""
}
export function ChatPage({ initialGame = "" }: { initialGame?: string }) {
  const tetris = useTetrisLauncher(chatToken)
  const openGame = tetris.open
  useEffect(() => {
    if (initialGame) openGame(initialGame, false)
  }, [initialGame, openGame])
  const account = useAccountSession()
  const unreadNotes = useNotesSummary(Boolean(account.session?.principal))
  const pollNotices = usePollNotices(chatToken(), readSession()?.nickname ?? "")
  const [profile, setProfile] = useState<{ nickname: string; editable: boolean } | null>(null)
  const closeProfile = useCallback(() => {
    setProfile(null)
  }, [])
  return (
    <GameNavigation.Provider value={tetris.open}>
      <Room
        onGame={tetris.command}
        csrf={account.session?.csrf_token ?? ""}
        unreadNotes={unreadNotes}
        pollNotices={pollNotices.notices}
        onDismissPoll={pollNotices.dismiss}
        onProfile={(nickname, editable) => {
          setProfile({ nickname, editable })
        }}
      >
        {profile && (
          <RoomProfileViewer {...profile} csrfToken={account.session?.csrf_token ?? ""} onDismiss={closeProfile} />
        )}
        {(tetris.error || tetris.busy) && (
          <div
            className="fixed bottom-20 left-4 z-50 max-w-sm rounded-xl bg-zinc-800 p-4 text-sm text-zinc-100"
            role="status"
          >
            {tetris.error || "Открываем игру…"}
          </div>
        )}
        {tetris.selection && (
          <TetrisGame
            key={`${tetris.selection.id}:${tetris.selection.popup?.id ?? "inline"}`}
            {...tetris.selection}
            token={chatToken()}
            onClose={tetris.close}
            onRematch={() => {
              if (tetris.selection) tetris.command(tetris.selection.id, true)
            }}
          />
        )}
      </Room>
    </GameNavigation.Provider>
  )
}
