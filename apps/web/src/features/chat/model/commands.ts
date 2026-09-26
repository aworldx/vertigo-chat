import { chatCommands } from "../../../shared/chatCommands"
export const commands = chatCommands.map(({ input, description }) => [input, description] as const)
export type CommandResult = {
  id: number
  command: string
  title: string
  body: string
  items: { label?: string; description?: string; nickname?: string }[]
}
