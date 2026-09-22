import { useState, type SyntheticEvent } from "react"
import { authenticate, getSession } from "../api/accounts"

export function useLoginForm(initialRegistering: boolean, onAuthenticated: () => void) {
  const [registering, setRegistering] = useState(initialRegistering)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    const value = (name: string) => {
      const entry = fields.get(name)
      return typeof entry === "string" ? entry : ""
    }
    setPending(true)
    setError(null)
    try {
      const session = await getSession()
      await authenticate(
        registering,
        { nickname: value("nickname"), password: value("password"), email: value("email") },
        session.csrf_token,
      )
      const channel = new BroadcastChannel("vertigo-account")
      channel.postMessage("changed")
      channel.close()
      onAuthenticated()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти. Попробуй ещё раз.")
    } finally {
      setPending(false)
    }
  }
  return {
    registering,
    error,
    pending,
    submit,
    toggle: () => {
      setRegistering((value) => !value)
      setError(null)
    },
  }
}
