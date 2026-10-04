import { useState } from "react"
import { uploadLibraryImage } from "../api/reading"
import { libraryError } from "../api/library"
export function useImageUpload(csrf: string, onBusy: (busy: boolean) => void) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  async function upload(file: File): Promise<string | null> {
    setPending(true)
    onBusy(true)
    setError("")
    try {
      return await uploadLibraryImage(file, csrf)
    } catch (error) {
      setError(libraryError(error))
      return null
    } finally {
      setPending(false)
      onBusy(false)
    }
  }
  return { upload, pending, error }
}
