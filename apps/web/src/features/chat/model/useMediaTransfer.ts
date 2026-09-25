import { useEffect, useRef, useState } from "react"
import { MediaTransfer } from "./mediaTransfer"
import { updateSharedFile, type PositionedFile } from "./mediaTimeline"
import { feedTimeline } from "./timeline"
import type { ChatConnection } from "./connection"
import type { Peer } from "../api/protocol"
export function useMediaTransfer(connection: ChatConnection, peers: Peer[], nickname: string) {
  const [files, setFiles] = useState<PositionedFile[]>([]),
    [error, setError] = useState("")
  const transfer = useRef<MediaTransfer | null>(null)
  useEffect(() => {
    const manager = new MediaTransfer(
      (target, body) => connection.signal(target, body),
      (file) => {
        const state = connection.getSnapshot()
        const entries = feedTimeline(state.timeline, state.ephemeral)
        setFiles((list) => updateSharedFile(list, file, entries))
      },
      setError,
      (id) => {
        setFiles((list) => list.filter((file) => file.id !== id))
      },
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
    try {
      await transfer.current?.share(file, nickname)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Не удалось прикрепить файл."
      setError(message)
      throw reason
    }
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
