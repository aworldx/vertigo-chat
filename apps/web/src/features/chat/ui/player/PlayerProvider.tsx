import { useEffect, useMemo, useReducer, type ReactNode } from "react"
import { PlayerContext } from "../../model/player/context"
import { initialPlayer, playerReducer } from "../../model/player/queue"
export function PlayerProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [state, dispatch] = useReducer(playerReducer, initialPlayer)
  useEffect(() => {
    if (!enabled) dispatch({ type: "mode", mode: "off" })
  }, [enabled])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <PlayerContext.Provider value={enabled ? value : null}>{children}</PlayerContext.Provider>
}
