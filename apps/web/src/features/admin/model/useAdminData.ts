import { useCallback } from "react"
import { useRemote } from "../../../shared/model/useRemote"
import { loadContent, loadDatabase, adminError } from "../api/admin"
export function useAdminData(section: string, table: string) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      section === "database"
        ? { database: await loadDatabase(table, signal), content: null }
        : { content: await loadContent(signal), database: null },
    [section, table],
  )
  const { data, error, refresh } = useRemote(section + ":" + table, load, adminError)
  return { content: data?.content ?? null, database: data?.database ?? null, error, refresh }
}
