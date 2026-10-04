const key = "vertigo.poll-notices.dismissed"

export function readDismissedNotices(nickname: string): number[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(`${key}:${nickname}`) ?? "[]")
    return Array.isArray(value)
      ? value.filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0)
      : []
  } catch {
    return []
  }
}

export function saveDismissedNotices(nickname: string, ids: number[]) {
  try {
    sessionStorage.setItem(`${key}:${nickname}`, JSON.stringify(ids.slice(-100)))
  } catch {
    // Closing still works in memory if browser storage becomes unavailable.
  }
}
