import { useState, type SubmitEvent } from "react"
import { enter, cancelEntrance } from "../api/entrance"
import { checkStorage, saveSession } from "./storage"
export function useEntrance(
  registering: boolean,
  getCsrf: () => Promise<string>,
  onPendingChange: (pending: boolean) => void,
) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    setPending(true)
    onPendingChange(true)
    setError("")
    try {
      try {
        checkStorage()
      } catch {
        throw new Error("Разреши хранение данных сайта в этой вкладке и повтори вход.")
      }
      const csrf = await getCsrf()
      const session = await enter(
        {
          nickname: textField(data, "nickname"),
          password: textField(data, "password"),
          ...(registering ? { email: textField(data, "email") } : {}),
        },
        registering,
        csrf,
      )
      try {
        saveSession(session)
      } catch {
        await cancelEntrance(session.resume_token)
        throw new Error(
          "Разреши хранение данных сайта в этой вкладке и повтори вход. Если ты зарегистрировался, ник уже сохранён — введи его и пароль.",
        )
      }
      const channel = new BroadcastChannel("vertigo-account")
      channel.postMessage("changed")
      channel.close()
      window.location.assign("/chat")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось войти.")
      setPending(false)
      onPendingChange(false)
    }
  }
  return { pending, error, submit }
}

function textField(data: FormData, key: string) {
  const value = data.get(key)
  return typeof value === "string" ? value : ""
}
