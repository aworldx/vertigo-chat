export type Track = {
  source: string
  title: string
  author: string
  kind: "music" | "video"
  messageID?: number
  prepare?: boolean
}
export type QueueEntry = Track & { key: number }
export type PlayerState = {
  current: QueueEntry | null
  queue: QueueEntry[]
  mode: "off" | "compact" | "expanded"
  requested: boolean
  serial: number
}
export const initialPlayer: PlayerState = { current: null, queue: [], mode: "off", requested: false, serial: 0 }
export type PlayerAction =
  | { type: "play" | "enqueue"; track: Track }
  | { type: "enqueue-many"; tracks: Track[] }
  | { type: "mode"; mode: PlayerState["mode"] }
  | { type: "request"; value: boolean }
  | { type: "next" }
  | { type: "select" | "remove"; key: number }
  | { type: "move"; key: number; direction: -1 | 1 }
export function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "enqueue-many": {
      const sources = new Set([...state.queue, ...(state.current ? [state.current] : [])].map((entry) => entry.source))
      let serial = state.serial
      const additions = action.tracks
        .filter((entry) => {
          if (sources.has(entry.source)) return false
          sources.add(entry.source)
          return true
        })
        .map((entry) => ({ ...entry, key: ++serial }))
      return additions.length
        ? {
            ...state,
            serial,
            queue: [...state.queue, ...additions],
            mode: state.mode === "off" ? "compact" : state.mode,
          }
        : state
    }
    case "play":
    case "enqueue": {
      const track = { ...action.track, key: state.serial + 1 }
      return action.type === "play"
        ? {
            ...state,
            current: track,
            serial: track.key,
            requested: true,
            mode: state.mode === "off" ? "compact" : state.mode,
          }
        : {
            ...state,
            queue: [...state.queue, track],
            serial: track.key,
            mode: state.mode === "off" ? "compact" : state.mode,
          }
    }
    case "mode":
      return { ...state, mode: action.mode, requested: action.mode === "off" ? false : state.requested }
    case "request":
      if (!state.current && action.value) return playerReducer(state, { type: "next" })
      return { ...state, requested: action.value }
    case "next": {
      const [current, ...queue] = state.queue
      return current ? { ...state, current, queue, requested: true } : { ...state, requested: false }
    }
    case "select": {
      const current = state.queue.find((entry) => entry.key === action.key)
      return current
        ? { ...state, current, queue: state.queue.filter((entry) => entry.key !== action.key), requested: true }
        : state
    }
    case "remove":
      return { ...state, queue: state.queue.filter((entry) => entry.key !== action.key) }
    case "move": {
      const queue = [...state.queue],
        index = queue.findIndex((entry) => entry.key === action.key)
      const item = queue[index],
        other = queue[index + action.direction]
      if (!item || !other) return state
      queue[index] = other
      queue[index + action.direction] = item
      return { ...state, queue }
    }
  }
}
