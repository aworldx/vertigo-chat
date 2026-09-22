import { useRef, useState } from "react"
import type { MediaItem } from "../api/media"
import { commands, type CommandResult } from "./commands"
import type { Message, Peer } from "../api/protocol"
export function useRoomCommands(
  messages: Message[],
  peers: Peer[],
  onProfile: (nickname: string) => void,
  onLeave: () => void,
  search: (kind: MediaItem["kind"], query: string) => void,
) {
  const sequence = useRef(0)
  const [results, setResults] = useState<CommandResult[]>([]),
    [ignored, setIgnored] = useState<string[]>([]),
    [cleared, setCleared] = useState<number[]>([])
  const notice = (command: string, title: string, body: string, items: CommandResult["items"] = []) => {
    setResults((list) => [...list, { id: ++sequence.current, command, title, body, items }].slice(-10))
  }
  const execute = (body: string) => {
    const text = body.trim()
    if (!text.startsWith("/")) return false
    const [rawCommand, ...args] = text.split(/\s+/u),
      argument = args.join(" ")
    const command =
      rawCommand === "/music"
        ? "/музыка"
        : rawCommand === "/gif"
          ? "/гиф"
          : rawCommand === "/youtube"
            ? "/ютуб"
            : rawCommand
    if (argument && ["/помощь", "/кто", "/выход", "/игноры", "/очистить"].includes(command ?? "")) {
      notice("error", "Команда не выполнена", "Неизвестная команда. Напиши /помощь, чтобы увидеть список команд.")
      return true
    }
    switch (command) {
      case "/музыка":
      case "/гиф":
      case "/ютуб":
        if (!argument) notice("error", "Поиск", "Добавь поисковый запрос после команды.")
        else search(command === "/гиф" ? "gif" : command === "/ютуб" ? "youtube" : "music", argument)
        break
      case "/помощь":
        notice(
          "help",
          "Команды",
          "Доступные текстовые команды:",
          commands.map(([label, description]) => ({ label, description })),
        )
        break
      case "/кто":
        notice(
          "who",
          "Сейчас онлайн",
          peers.length ? "Нажми на ник, чтобы обратиться к чатланину." : "Сейчас никого нет онлайн.",
          peers.slice(0, 10).map((peer) => ({ nickname: peer.nickname })),
        )
        break
      case "/выход":
        onLeave()
        break
      case "/очистить":
        setCleared(messages.map((m) => m.id))
        setResults([])
        break
      case "/инфо":
        if (/^[\p{L}\p{N}_-]{3,24}$/u.test(argument)) {
          onProfile(argument)
          notice("info", "Анкета", `Открыта анкета чатланина ${argument}.`)
        } else notice("error", "Команда не выполнена", "Укажи ник: /инфо ник или /игнор ник.")
        break
      case "/игнор":
        if (/^[\p{L}\p{N}_-]{3,24}$/u.test(argument)) {
          const restore = ignored.includes(argument)
          setIgnored((list) => (restore ? list.filter((n) => n !== argument) : [...list, argument]))
          notice(
            "ignore",
            "Игнор",
            restore
              ? `Сообщения ${argument} снова показываются.`
              : `Сообщения ${argument} скрыты. Повтори команду, чтобы вернуть их.`,
          )
        } else notice("error", "Команда не выполнена", "Укажи ник: /инфо ник или /игнор ник.")
        break
      case "/игноры":
        notice(
          "ignores",
          "Игноры",
          ignored.length ? "Скрытые чатлане:" : "Список игноров пуст.",
          [...ignored].sort().map((nickname) => ({ nickname })),
        )
        break
      default:
        notice("error", "Команда не выполнена", "Неизвестная команда. Напиши /помощь, чтобы увидеть список команд.")
    }
    return true
  }
  return {
    execute,
    results,
    notice,
    visible: messages.filter((m) => !cleared.includes(m.id) && !ignored.includes(m.author)),
  }
}
