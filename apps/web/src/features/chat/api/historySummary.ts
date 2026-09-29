import type { paths } from "../../../shared/generated/chat"
import { jsonMutation, record, requestJSON } from "../../../shared/api/json"
import type { HistoryPeriod } from "./history"

export type HistorySummaryResult =
  paths["/api/v1/chat/history/summary"]["post"]["responses"][200]["content"]["application/json"]
export async function summarizeHistory(
  period: HistoryPeriod,
  csrf: string,
  signal: AbortSignal,
): Promise<HistorySummaryResult> {
  const value = await requestJSON("/api/v1/chat/history/summary", { ...jsonMutation("POST", csrf, period), signal })
  if (
    !record(value) ||
    typeof value.summary !== "string" ||
    !value.summary.trim() ||
    typeof value.messages !== "number" ||
    !Number.isInteger(value.messages) ||
    value.messages < 1 ||
    value.messages > 500
  )
    throw new Error("invalid_summary")
  return { summary: value.summary, messages: value.messages }
}
