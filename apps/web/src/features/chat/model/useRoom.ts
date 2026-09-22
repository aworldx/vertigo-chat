import { useEffect, useState, useSyncExternalStore } from "react"
import { ChatConnection } from "./connection"
export function useRoom() {
  const [connection] = useState(() => new ChatConnection())
  const state = useSyncExternalStore(connection.subscribe, connection.getSnapshot)
  useEffect(() => {
    connection.start()
    return () => {
      connection.stop()
    }
  }, [connection])
  return { state, connection }
}
