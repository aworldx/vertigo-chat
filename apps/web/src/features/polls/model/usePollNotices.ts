import { useEffect, useState } from "react"
import { loadPollNotices, type Poll } from "../api/polls"

const channelName = "vertigo-polls"

export function announcePollsChanged() {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) return
  const channel = new BroadcastChannel(channelName)
  channel.postMessage({ type: "changed" })
  channel.close()
}

export function usePollNotices(token: string) {
  const [notices, setNotices] = useState<Poll[]>([])
  useEffect(() => {
    if (!token) {
      return
    }
    let active = true
    const refresh = () => {
      const controller = new AbortController()
      void loadPollNotices(token, controller.signal)
        .then((value) => {
          if (active) setNotices(value)
        })
        .catch(() => {
          if (active) setNotices([])
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
    return () => {
      active = false
      request.abort()
      window.clearInterval(interval)
      channel?.removeEventListener("message", receive)
      channel?.close()
    }
  }, [token])
  return notices
}
