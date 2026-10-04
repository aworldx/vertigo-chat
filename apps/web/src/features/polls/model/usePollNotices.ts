import { readDismissedNotices, saveDismissedNotices } from "./dismissedNotices"
import { useEffect, useMemo, useState } from "react"
import { loadPollNotices, type Poll } from "../api/polls"

const channelName = "vertigo-polls"

export function announcePollsChanged() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return
  const channel = new BroadcastChannel(channelName)
  channel.postMessage({ type: "changed" })
  channel.close()
}

export function usePollNotices(token: string, nickname: string) {
  const [result, setResult] = useState<{ token: string; polls: Poll[] }>({ token: "", polls: [] })
  const [dismissed, setDismissed] = useState(() => ({ nickname, ids: readDismissedNotices(nickname) }))
  const ids = useMemo(
    () => (dismissed.nickname === nickname ? dismissed.ids : readDismissedNotices(nickname)),
    [dismissed, nickname],
  )
  const notices = useMemo(
    () => (result.token === token && token ? result.polls.filter((poll) => !ids.includes(poll.id)) : []),
    [result, token, ids],
  )
  const dismiss = (id: number) => {
    const next = [...new Set([...ids, id])]
    setDismissed({ nickname, ids: next })
    saveDismissedNotices(nickname, next)
  }
  useEffect(() => {
    if (!token) {
      return
    }
    let active = true
    const refresh = () => {
      const controller = new AbortController()
      void loadPollNotices(token, controller.signal)
        .then((value) => {
          if (active && !controller.signal.aborted) setResult({ token, polls: value })
        })
        .catch((reason: unknown) => {
          if (active && !controller.signal.aborted && reason instanceof Error && reason.message === "forbidden")
            setResult({ token, polls: [] })
        })
      return controller
    }
    let request = refresh()
    const interval = window.setInterval(() => {
      request.abort()
      request = refresh()
    }, 15_000)
    const channel = "BroadcastChannel" in window ? new BroadcastChannel(channelName) : undefined
    const receive = () => {
      request.abort()
      request = refresh()
    }
    channel?.addEventListener("message", receive)
    window.addEventListener("focus", receive)
    return () => {
      active = false
      request.abort()
      window.clearInterval(interval)
      window.removeEventListener("focus", receive)
      channel?.removeEventListener("message", receive)
      channel?.close()
    }
  }, [token])
  return { notices, dismiss }
}
