import { useCallback } from "react"
import { useRemote } from "../../../shared/model/useRemote"
import { loadLibrary, libraryError } from "../api/library"
export function useLibrary(query: string) {
  const load = useCallback((signal: AbortSignal) => loadLibrary(query, signal), [query])
  return useRemote(query, load, libraryError)
}
