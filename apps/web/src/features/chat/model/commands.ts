export const commands = [
  ["/помощь", "Список команд"],
  ["/кто", "Кто сейчас в чате"],
  ["/инфо ", "Открыть анкету"],
  ["/игнор ", "Скрыть или вернуть чатланина"],
  ["/игноры", "Список игноров"],
  ["/музыка ", "Найти трек и открыть плеер"],
  ["/гиф ", "Найти и отправить GIF"],
  ["/ютуб ", "Найти или отправить YouTube-видео"],
  ["/очистить", "Очистить окно чата только у себя"],
  ["/выход", "Выйти из чата"],
] as const
export type CommandResult = {
  id: number
  command: string
  title: string
  body: string
  items: { label?: string; description?: string; nickname?: string }[]
}
