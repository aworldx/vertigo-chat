import { ChatPage } from "./ChatPage"
import { TetrisLeaderboard } from "../features/tetris"

export function TetrisPage() {
  const id = decodeURIComponent(window.location.pathname.split("/")[3] ?? "")
  if (id === "leaderboard") return <TetrisLeaderboard />
  return <ChatPage initialGame={id} />
}
