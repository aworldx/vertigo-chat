import type { components } from "./generated/chat"

export type ChartQueueTrack = Pick<components["schemas"]["ChartTrack"], "id" | "title" | "author">
const channelName = "vertigo-chart-queue"
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
function track(value: unknown): value is ChartQueueTrack {
  return (
    record(value) &&
    typeof value.id === "number" &&
    Number.isSafeInteger(value.id) &&
    value.id > 0 &&
    typeof value.title === "string" &&
    typeof value.author === "string"
  )
}

export function receiveChartQueue(nickname: string, accept: (tracks: ChartQueueTrack[]) => boolean) {
  const channel = new BroadcastChannel(channelName)
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data
    if (
      !record(data) ||
      data.type !== "enqueue" ||
      data.nickname !== nickname ||
      typeof data.id !== "string" ||
      !Array.isArray(data.tracks) ||
      !data.tracks.length ||
      !data.tracks.every(track)
    )
      return
    channel.postMessage({ type: "reply", id: data.id, nickname, accepted: accept(data.tracks) })
  }
  return () => {
    channel.close()
  }
}

export function sendChartQueue(nickname: string, tracks: ChartQueueTrack[], signal: AbortSignal): Promise<void> {
  if (!nickname) return Promise.reject(new Error("Открой хит-парад из своей вкладки чата с включённым личным плеером."))
  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(channelName)
    const id = crypto.randomUUID()
    const finish = (error?: Error) => {
      clearTimeout(timer)
      signal.removeEventListener("abort", abort)
      channel.close()
      if (error) reject(error)
      else resolve()
    }
    const abort = () => {
      finish(new DOMException("Отменено", "AbortError"))
    }
    const timer = setTimeout(() => {
      finish(new Error("Не удалось связаться с плеером. Открой чат в этом браузере и попробуй ещё раз."))
    }, 3000)
    signal.addEventListener("abort", abort, { once: true })
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const data = event.data
      if (
        !record(data) ||
        data.type !== "reply" ||
        data.id !== id ||
        data.nickname !== nickname ||
        typeof data.accepted !== "boolean"
      )
        return
      finish(
        data.accepted
          ? undefined
          : new Error("Включи «Использовать плеер» в настройках чата на компьютере и попробуй ещё раз."),
      )
    }
    if (signal.aborted) abort()
    else channel.postMessage({ type: "enqueue", id, nickname, tracks })
  })
}
