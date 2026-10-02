import { useEffect, useState } from "react"
import { loadPolls, type Poll } from "../api/polls"
export function usePolls(token: string, admin = false) {
  const [data, setData] = useState<Poll[]>(),
    [error, setError] = useState(false)
  const receive = (value: Poll[]) => {
    setData(value)
    setError(false)
  }
  const failed = () => {
    setError(true)
  }
  const refresh = () => {
    const c = new AbortController()
    void loadPolls(token, admin, c.signal).then(receive).catch(failed)
  }
  useEffect(() => {
    const c = new AbortController()
    void loadPolls(token, admin, c.signal).then(receive).catch(failed)
    return () => {
      c.abort()
    }
  }, [token, admin])
  return { data, error, refresh }
}
