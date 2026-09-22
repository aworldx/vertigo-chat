import { useEffect, useRef, useState } from "react"
import { MediaTransfer, type SharedFile } from "./mediaTransfer"
import type { ChatConnection } from "./connection"
import type { Peer } from "../api/protocol"
export function useMediaTransfer(connection: ChatConnection, peers: Peer[], nickname: string) {
  const [files, setFiles] = useState<SharedFile[]>([]),
    [error, setError] = useState("")
  const transfer = useRef<MediaTransfer | null>(null)
  useEffect(() => {
    const manager = new MediaTransfer(
      (target, body) => connection.signal(target, body),
      (file) => {
        setFiles((list) => [...list.filter((item) => item.id !== file.id), file].slice(-20))
      },
      setError,
    )
    transfer.current = manager
    const unsubscribe = connection.subscribeSignal((sender, body) => {
      void manager.accept(sender, body).catch(() => {
        setError("Не удалось установить соединение для передачи файла.")
      })
    })
    return () => {
      unsubscribe()
      manager.stop()
      transfer.current = null
    }
  }, [connection])
  const share = async (file: File) => {
    setError("")
    await transfer.current?.share(file, nickname)
  }
  return {
    files: files.map((file) => ({ ...file, author: peers.find((p) => p.id === file.author)?.nickname ?? file.author })),
    share,
    request: (id: string) => {
      transfer.current?.request(id)
    },
    error,
  }
}
