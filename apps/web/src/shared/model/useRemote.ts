import { useCallback, useEffect, useState } from "react"
export function useRemote<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  message: (error: unknown) => string,
) {
  const [attempt, setAttempt] = useState(0),
    [state, setState] = useState<{ key: string; data: T | null; error: string }>({ key, data: null, error: "" })
  useEffect(() => {
    const c = new AbortController()
    void load(c.signal)
      .then((data) => {
        if (!c.signal.aborted) setState({ key, data, error: "" })
      })
      .catch((e: unknown) => {
        if (!c.signal.aborted) setState({ key, data: null, error: message(e) })
      })
    return () => {
      c.abort()
    }
  }, [key, load, message, attempt])
  const refresh = useCallback(() => {
    setAttempt((a) => a + 1)
  }, [])
  return { data: state.key === key ? state.data : null, error: state.key === key ? state.error : "", refresh }
}
