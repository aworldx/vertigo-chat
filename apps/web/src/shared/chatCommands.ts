import type { HelpTopic } from "./chatHelp"
// Menu, autocomplete and public help use the same command inventory.
export const chatCommands: readonly { input: string; label: string; description: string; topic: HelpTopic }[] = [
  { input: "/помощь", label: "/помощь", description: "Показывает список команд.", topic: "commands" },
  {
    input: "/кто",
    label: "/кто",
    description: "Показывает до 10 чатлан онлайн; на ник можно нажать для обращения.",
    topic: "online",
  },
  { input: "/инфо ", label: "/инфо ник", description: "Открывает анкету чатланина.", topic: "profile" },
  {
    input: "/игнор ",
    label: "/игнор ник",
    description: "Скрывает сообщения чатланина; повтор команды возвращает их.",
    topic: "ignore",
  },
  { input: "/игноры", label: "/игноры", description: "Показывает список игнорируемых чатлан.", topic: "ignore" },
  {
    input: "/музыка ",
    label: "/музыка запрос",
    description: "Ищет 10 треков: прослушай вариант и отправь его в общую комнату.",
    topic: "music",
  },
  {
    input: "/гиф ",
    label: "/гиф запрос",
    description: "Ищет GIF, которую можно выбрать и отправить в чат.",
    topic: "gif",
  },
  {
    input: "/ютуб ",
    label: "/ютуб ссылка или запрос",
    description: "По запросу покажет до пяти коротких роликов; по ссылке сразу отправит компактный плеер.",
    topic: "video",
  },
  { input: "/очистить", label: "/очистить", description: "Очищает окно чата только у тебя.", topic: "clear" },
  { input: "/выход", label: "/выход", description: "Выводит из чата.", topic: "leave" },
]
