import { createContext } from "react"
import type { ChatConnection } from "./connection"
export const ListeningContext = createContext<ChatConnection | null>(null)
