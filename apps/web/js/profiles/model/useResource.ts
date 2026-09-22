import { useCallback, useEffect, useState } from "react"
import { APIError } from "../api/profiles"

type Resource<T> = { loading: boolean; data: T | null; error: string | null; retry: () => void }

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>): Resource<T> {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ key: string; loading: boolean; data: T | null; error: string | null }>({
    key,
    loading: true,
    data: null,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      controller.abort()
    }, 15_000)
    void load(controller.signal)
      .then((data) => {
        setState({ key, loading: false, data, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            key,
            loading: false,
            data: null,
            error:
              error instanceof APIError
                ? error.message
                : "Не удалось загрузить анкеты. Проверь соединение и попробуй ещё раз.",
          })
        }
      })
      .finally(() => {
        window.clearTimeout(timeout)
      })
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt, key, load])

  return {
    ...(state.key === key ? state : { loading: true, data: null, error: null }),
    retry: useCallback(() => {
      setAttempt((value) => value + 1)
    }, []),
  }
}
