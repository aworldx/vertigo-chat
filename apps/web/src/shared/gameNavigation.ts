import { createContext } from "react"

export type OpenGame = (id: string, join: boolean) => void
export const GameNavigation = createContext<OpenGame | null>(null)
