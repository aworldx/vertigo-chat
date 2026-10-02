import { useEffect, useState } from "react"
import { loadNotes, type Notes } from "../api/notes"
export function useNotes() {
  const [data, setData] = useState<Notes | null>(null)
  const [error, setError] = useState("")
  const receive = (value: Notes) => {
    setData(value)
    setError("")
  }
  const failed = () => {
    setError("unavailable")
  }
  const refresh = () => {
    const controller = new AbortController()
    void loadNotes(controller.signal).then(receive).catch(failed)
  }
  useEffect(() => {
    const controller = new AbortController()
    void loadNotes(controller.signal).then(receive).catch(failed)
    return () => {
      controller.abort()
    }
  }, [])
  return { data, error, refresh }
}
