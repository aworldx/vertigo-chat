import { useEffect, useMemo, useReducer, type ReactNode } from "react"
import { PlayerContext } from "../../model/player/context"
import { initialPlayer, playerReducer } from "../../model/player/queue"
import { receiveChartQueue } from "../../../../shared/chartQueue"
export function PlayerProvider({
  children,
  enabled = true,
  nickname = "",
}: {
  children: ReactNode
  enabled?: boolean
  nickname?: string
}) {
  const [state, dispatch] = useReducer(playerReducer, initialPlayer)
  useEffect(() => {
    if (!nickname || typeof BroadcastChannel === "undefined") return
    return receiveChartQueue(nickname, (tracks) => {
      if (!enabled) return false
      dispatch({
        type: "enqueue-many",
        tracks: tracks.map((track) => ({
          source: `/music-chart/tracks/${String(track.id)}`,
          title: track.title,
          author: track.author,
          kind: "music",
        })),
      })
      return true
    })
  }, [nickname, enabled])
  useEffect(() => {
    if (!enabled) dispatch({ type: "mode", mode: "off" })
  }, [enabled])
  const value = useMemo(() => ({ state, dispatch }), [state])
  return <PlayerContext.Provider value={enabled ? value : null}>{children}</PlayerContext.Provider>
}
