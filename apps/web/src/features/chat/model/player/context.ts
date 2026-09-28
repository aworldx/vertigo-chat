import { createContext, useContext, type Dispatch } from "react"
import type { PlayerAction, PlayerState } from "./queue"
export const PlayerContext = createContext<{ state: PlayerState; dispatch: Dispatch<PlayerAction> } | null>(null)
export function usePlayer() {
  return useContext(PlayerContext)
}
