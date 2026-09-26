import { useState } from "react"
import { adminError } from "../api/admin"
export function useBotSave() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("")
  async function save(action: () => Promise<void>, onSaved: () => void) {
    if (pending) return
    setPending(true)
    setError("")
    setNotice("")
    try {
      await action()
      setNotice("Изменения сохранены.")
      onSaved()
    } catch (e) {
      setError(adminError(e))
    } finally {
      setPending(false)
    }
  }
  return { pending, error, notice, save }
}
